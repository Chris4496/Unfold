import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { CaseMessage, FictionalDemoSession } from '../api';
import {
  buildFictionalDemoData,
  FICTIONAL_DEMO_STORAGE_KEY,
  PERSONAL_STORAGE_KEY,
  persistedStorageKey,
} from './fictionalDemo';

function demoSession(): FictionalDemoSession {
  const entries = Array.from({ length: 18 }, (_, index) => {
    const id = `maya-note-${String(index + 1).padStart(2, '0')}`;
    const text = `Complete simulated source text ${index + 1}.`;
    const eventAt = `2025-01-${String(index + 1).padStart(2, '0')}T12:00:00.000Z`;
    return {
      id,
      createdAt: eventAt,
      eventAt,
      transcript: text,
      deidentified: text,
      tokens: [],
    };
  });
  return {
    deviceToken: 'fictional-device-token-only',
    persona: { name: 'Maya', context: 'Fictional student.' },
    entries,
    case: {
      id: 'case_unfold_fictional_maya_v1',
      createdAt: '2025-01-20T10:00:00.000Z',
      status: 'continued',
      claimCount: 1,
      summary: {
        mainConcerns: 'Simulated concern.',
        recentChange: 'Simulated follow-up.',
        period: 'Fictional student demo · three-week history',
        tokens: [],
        excerpts: entries.map((entry) => ({ id: entry.id, createdAt: entry.eventAt, text: entry.deidentified })),
      },
    },
  };
}

const messages: CaseMessage[] = [
  { id: 'worker-1', sender: 'worker', text: 'A supportive simulated reply.', createdAt: '2025-01-21T09:00:00.000Z', workerName: 'Demo Worker' },
  { id: 'student-1', sender: 'student', text: 'A simulated follow-up.', createdAt: '2025-01-21T12:00:00.000Z' },
];

test('fictional student data stays separate from personal storage and remains complete on re-entry', () => {
  assert.notEqual(PERSONAL_STORAGE_KEY, FICTIONAL_DEMO_STORAGE_KEY);
  assert.equal(persistedStorageKey(false), PERSONAL_STORAGE_KEY);
  assert.equal(persistedStorageKey(true), FICTIONAL_DEMO_STORAGE_KEY);

  const session = demoSession();
  const first = buildFictionalDemoData(session, messages, null);
  assert.equal(first.entries.length, 18);
  assert.equal(first.cases.length, 1);
  assert.equal(first.messages.length, 2);
  assert.equal(first.cloudOrg, false);
  assert.equal(first.deviceToken, 'fictional-device-token-only');
  for (const [index, entry] of first.entries.entries()) {
    assert.equal(entry.id, session.case.summary.excerpts[index].id);
    assert.equal(entry.eventAt ?? entry.createdAt, session.case.summary.excerpts[index].createdAt);
    assert.equal(entry.deidentified, session.case.summary.excerpts[index].text);
    assert.equal(entry.audioUri, undefined);
  }

  const changedLocalNote = { ...first.entries[0], transcript: 'A local-only demo edit.' };
  const previousDemo = { ...first, entries: [changedLocalNote, ...first.entries.slice(1)] };
  const workerAddedMessage: CaseMessage = {
    id: 'worker-2',
    sender: 'worker',
    text: 'A later simulated follow-up.',
    createdAt: '2025-01-22T14:00:00.000Z',
    workerName: 'Demo Worker',
  };
  const reopened = buildFictionalDemoData(session, [...messages, workerAddedMessage], previousDemo);
  assert.equal(reopened.entries[0].transcript, 'A local-only demo edit.');
  assert.equal(reopened.entries.length, 18);
  assert.equal(reopened.cases.length, 1);
  assert.deepEqual(reopened.messages.map((message) => message.id), ['worker-1', 'student-1', 'worker-2']);
});
