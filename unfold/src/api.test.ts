import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  analysisWithFallback,
  askWithFallback,
  daySummaryWithFallback,
  detectCaseLanguage,
  respondWithFallback,
  setCloudConsent,
  syncEntries,
  toSyncPayload,
} from './api';
import { annotateEntry } from './lib/organise';
import type { Entry } from './types';

type FetchCall = { url: string; init: RequestInit };

/** Replace global fetch with a mock; returns the recorded calls and a restore fn. */
function mockFetch(handler: (call: FetchCall) => unknown): { calls: FetchCall[]; restore: () => void } {
  const calls: FetchCall[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = (async (input: unknown, init?: RequestInit) => {
    const call: FetchCall = { url: String(input), init: init ?? {} };
    calls.push(call);
    const body = handler(call);
    return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;
  return {
    calls,
    restore: () => {
      globalThis.fetch = original;
    },
  };
}

function failingFetch(): { restore: () => void } {
  const original = globalThis.fetch;
  globalThis.fetch = (async () => {
    throw new Error('network down');
  }) as typeof fetch;
  return {
    restore: () => {
      globalThis.fetch = original;
    },
  };
}

function sampleEntry(transcript: string, createdAt = '2026-10-01T09:00:00.000Z'): Entry {
  return annotateEntry(transcript, createdAt, 'entry-1');
}

test('consent toggle sends an independent cloudOrg payload with the device token', async () => {
  const { calls, restore } = mockFetch(() => ({ deviceId: 'dev-1', cloudOrg: true, created_at: 'x' }));
  try {
    const result = await setCloudConsent('token-123', true);
    assert.equal(result.cloudOrg, true);
    assert.equal(calls.length, 1);
    const call = calls[0];
    assert.ok(call.url.endsWith('/api/devices/me/consent'));
    assert.equal(call.init.method, 'PUT');
    const headers = call.init.headers as Record<string, string>;
    assert.equal(headers.authorization, 'Bearer token-123');
    assert.deepEqual(JSON.parse(String(call.init.body)), { cloudOrg: true });
  } finally {
    restore();
  }
});

test('entry sync sends deidentified text only — never the transcript', async () => {
  const entry = sampleEntry('I talked to my friend Jason about homework and felt pressure.');
  const { calls, restore } = mockFetch(() => ({
    results: [{ clientId: entry.id, topics: ['academic'], attributes: ['feeling'], uncertainty: {}, genai: false }],
  }));
  try {
    const payload = toSyncPayload(entry);
    assert.equal(payload.deidentified, entry.deidentified);
    assert.equal('transcript' in payload, false);
    assert.equal('audioUri' in payload, false);

    const { results } = await syncEntries('token-123', [payload]);
    assert.equal(results[0]?.clientId, entry.id);

    const raw = String(calls[0].init.body);
    assert.equal(raw.includes('transcript'), false, 'sync body must not contain a transcript field');
    assert.equal(raw.includes('Jason'), false, 'sync body must not contain names removed by deidentify');
    const body = JSON.parse(raw) as { entries: Record<string, unknown>[] };
    assert.deepEqual(Object.keys(body.entries[0]).sort(), ['clientId', 'createdAt', 'deidentified', 'tokens']);
    assert.equal(body.entries[0].deidentified, entry.deidentified);
  } finally {
    restore();
  }
});

test('ask falls back to the on-device search when the server is unreachable', async () => {
  const entry = sampleEntry('I could not sleep before the exam.');
  const { restore } = failingFetch();
  try {
    const outcome = await askWithFallback('token-123', 'What did I say about sleep?', [entry]);
    assert.equal(outcome.source, 'device');
    assert.equal(outcome.genai, false);
    assert.equal(outcome.found, true);
    assert.equal(outcome.hits[0]?.entryId, entry.id);
  } finally {
    restore();
  }
});

test('ask uses the server when cloud organisation is available', async () => {
  const entry = sampleEntry('I could not sleep before the exam.');
  const { restore } = mockFetch(() => ({
    found: true,
    text: 'On Wed, 1 Oct you mentioned sleep.',
    hits: [{ clientId: entry.id, dateLabel: 'Wed, 1 Oct', quote: 'sleep before the exam' }],
    genai: true,
  }));
  try {
    const outcome = await askWithFallback('token-123', 'sleep?', [entry]);
    assert.equal(outcome.source, 'cloud');
    assert.equal(outcome.genai, true);
    assert.equal(outcome.hits[0]?.entryId, entry.id);
    assert.equal(outcome.hits[0]?.createdAt, entry.createdAt);
  } finally {
    restore();
  }
});

test('day summary falls back to the local rule offline', async () => {
  const entry = sampleEntry('I could not sleep before the exam.');
  const { restore } = failingFetch();
  try {
    const outcome = await daySummaryWithFallback('token-123', '2026-10-01', [entry]);
    assert.equal(outcome.source, 'device');
    assert.equal(outcome.genai, false);
    assert.ok(outcome.text.length > 0);
  } finally {
    restore();
  }
});

test('brief response resolves null offline so the screen keeps its static copy', async () => {
  const { restore } = failingFetch();
  try {
    const outcome = await respondWithFallback('token-123', { deidentified: 'A hard day.', recentKinds: [] });
    assert.equal(outcome, null);
  } finally {
    restore();
  }
});

test('support analysis falls back to the local pattern rules offline', async () => {
  const entries = [
    annotateEntry('Exam stress and no sleep.', '2026-09-29T09:00:00.000Z', 'e1'),
    annotateEntry('More homework pressure, argued with my group.', '2026-09-30T09:00:00.000Z', 'e2'),
    annotateEntry('Still awake, worried about grades.', '2026-10-01T09:00:00.000Z', 'e3'),
  ];
  const { restore } = failingFetch();
  try {
    const outcome = await analysisWithFallback('token-123', entries);
    assert.equal(outcome.source, 'device');
    assert.equal(outcome.genai, false);
    assert.equal(outcome.approaching, true);
    assert.ok(outcome.explanation.length > 0);
  } finally {
    restore();
  }
});

test('case language detection picks zh-HK for Chinese notes and en otherwise', () => {
  const chinese = [annotateEntry('今日功課好多，瞓唔著。', '2026-10-01T09:00:00.000Z', 'e1')];
  const english = [sampleEntry('Too much homework today.')];
  assert.equal(detectCaseLanguage(chinese), 'zh-HK');
  assert.equal(detectCaseLanguage(english), 'en');
  assert.equal(detectCaseLanguage([]), 'en');
});
