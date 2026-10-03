// Unit tests for src/genai.js (node:test). All network access is mocked by
// replacing globalThis.fetch, so no real Moonshot API key or network is needed.
import { afterEach, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';

import {
  classifyEntry,
  linkEntries,
  dailySummary,
  briefResponse,
  analyseBackground,
  ask,
  caseSummary,
} from './genai.js';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

const originalFetch = globalThis.fetch;
const ENV_KEYS = ['MOONSHOT_API_KEY', 'MOONSHOT_BASE_URL', 'GENAI_MODEL', 'GENAI_TIMEOUT_MS'];
const savedEnv = {};

let fetchCalls;

beforeEach(() => {
  for (const key of ENV_KEYS) {
    savedEnv[key] = process.env[key];
    delete process.env[key];
  }
  fetchCalls = [];
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
});

function mockFetchResponding(content, { status = 200 } = {}) {
  globalThis.fetch = async (url, options) => {
    fetchCalls.push({ url, options });
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => ({
        choices: [{ message: { content: typeof content === 'string' ? content : JSON.stringify(content) } }],
      }),
    };
  };
}

function setKey() {
  process.env.MOONSHOT_API_KEY = 'test-key';
}

// ---------------------------------------------------------------------------
// classifyEntry
// ---------------------------------------------------------------------------

describe('classifyEntry', () => {
  test('parses a valid GenAI classification', async () => {
    setKey();
    mockFetchResponding({
      topics: ['academic', 'family'],
      attributes: ['feeling', 'event'],
      eventTimeHint: 'last night',
      uncertainty: ['whether the deadline passed'],
    });
    const { result, genai } = await classifyEntry({ text: 'Stressed about the exam, mum called last night.' });
    assert.equal(genai, true);
    assert.deepEqual(result.topics, ['academic', 'family']);
    assert.deepEqual(result.attributes, ['feeling', 'event']);
    assert.equal(result.eventTimeHint, 'last night');
    assert.deepEqual(result.uncertainty, ['whether the deadline passed']);
    // Verify request shape: OpenAI-compatible, JSON mode, model.
    // kimi-k3 accepts only temperature=1, so the client omits the field.
    assert.equal(fetchCalls.length, 1);
    const { url, options } = fetchCalls[0];
    assert.equal(url, 'https://api.moonshot.ai/v1/chat/completions');
    assert.equal(options.method, 'POST');
    assert.equal(options.headers.Authorization, 'Bearer test-key');
    const body = JSON.parse(options.body);
    assert.equal(body.model, 'kimi-k3');
    assert.equal(body.temperature, undefined);
    assert.deepEqual(body.response_format, { type: 'json_object' });
  });

  test('repairs fenced JSON and filters out-of-vocabulary values', async () => {
    setKey();
    mockFetchResponding('```json\n{"topics":["academic","politics"],"attributes":["feeling","unknown"],"eventTimeHint":null,"uncertainty":[]}\n```');
    const { result, genai } = await classifyEntry({ text: 'exam stress' });
    assert.equal(genai, true);
    assert.deepEqual(result.topics, ['academic']);
    assert.deepEqual(result.attributes, ['feeling']);
    assert.equal(result.eventTimeHint, null);
  });
});

// ---------------------------------------------------------------------------
// Fallback paths (shared mechanics)
// ---------------------------------------------------------------------------

describe('fallback mechanics', () => {
  test('invalid JSON from the model falls back with reason invalid-json', async () => {
    setKey();
    mockFetchResponding('this is definitely not json');
    const { result, genai, reason } = await classifyEntry({ text: 'I have an exam tomorrow' });
    assert.equal(genai, false);
    assert.equal(reason, 'invalid-json');
    assert.ok(result.topics.includes('academic'));
  });

  test('HTTP error falls back with reason http-error', async () => {
    setKey();
    mockFetchResponding({}, { status: 500 });
    const { genai, reason } = await classifyEntry({ text: 'I have an exam tomorrow' });
    assert.equal(genai, false);
    assert.equal(reason, 'http-error');
  });

  test('timeout falls back with reason timeout', async () => {
    setKey();
    process.env.GENAI_TIMEOUT_MS = '30';
    globalThis.fetch = (url, options) =>
      new Promise((resolve, reject) => {
        fetchCalls.push({ url, options });
        options.signal.addEventListener('abort', () => {
          reject(Object.assign(new Error('The operation was aborted'), { name: 'AbortError' }));
        });
      });
    const { result, genai, reason } = await classifyEntry({ text: 'I have an exam tomorrow' });
    assert.equal(genai, false);
    assert.equal(reason, 'timeout');
    assert.ok(result.topics.includes('academic'));
  });

  test('missing API key falls back with reason no-api-key and never calls fetch', async () => {
    let called = 0;
    globalThis.fetch = async () => {
      called += 1;
      throw new Error('should not be called');
    };
    const { result, genai, reason } = await classifyEntry({ text: 'I have an exam tomorrow' });
    assert.equal(genai, false);
    assert.equal(reason, 'no-api-key');
    assert.equal(called, 0);
    assert.ok(result.topics.includes('academic'));
  });
});

// ---------------------------------------------------------------------------
// Fallback rule correctness
// ---------------------------------------------------------------------------

describe('classifyEntry fallback rules', () => {
  test('detects topics and attributes from keywords', async () => {
    const { result, genai } = await classifyEntry({
      text: 'I feel stressed about the exam and my mum keeps talking about grades.',
    });
    assert.equal(genai, false);
    assert.ok(result.topics.includes('academic'));
    assert.ok(result.topics.includes('family'));
    assert.ok(result.attributes.includes('feeling'));
    assert.ok(result.attributes.includes('interpersonal'));
    assert.equal(result.eventTimeHint, null);
    assert.ok(result.uncertainty.length > 0);
  });

  test('detects an event time hint and defaults to everyday attribute', async () => {
    const { result } = await classifyEntry({ text: 'The sky was grey yesterday.' });
    assert.equal(result.eventTimeHint, 'yesterday');
    assert.deepEqual(result.topics, []);
    assert.deepEqual(result.attributes, ['everyday']);
    assert.ok(result.uncertainty.includes('no clear topic detected'));
  });
});

describe('ask fallback rules', () => {
  const entries = [
    { id: 'e1', day: '2025-01-02', text: 'The coursework deadline moved to Friday.' },
    { id: 'e2', day: '2025-01-01', text: 'I could not sleep before the exam.' },
    { id: 'e3', day: '2025-01-03', text: 'Group coursework meeting went badly.' },
  ];

  test('finds entries by word overlap, hits ordered by date ascending with verbatim quotes', async () => {
    const { result, genai } = await ask({ question: 'What did I say about coursework?', entries });
    assert.equal(genai, false);
    assert.equal(result.found, true);
    assert.deepEqual(
      result.hits.map((hit) => hit.entryId),
      ['e1', 'e3'],
    );
    for (const hit of result.hits) {
      const source = entries.find((entry) => entry.id === hit.entryId);
      assert.equal(hit.quote, source.text);
      assert.equal(hit.dateLabel, source.day);
    }
  });

  test('honestly reports when nothing is found', async () => {
    const { result } = await ask({ question: 'Anything about basketball?', entries });
    assert.equal(result.found, false);
    assert.equal(result.hits.length, 0);
    assert.match(result.text, /could not find/i);
  });

  test('handles empty query words', async () => {
    const { result } = await ask({ question: 'what is the?', entries });
    assert.equal(result.found, false);
    assert.match(result.text, /try asking/i);
  });
});

describe('dailySummary fallback rules', () => {
  test('mentions detected topic phrases without inventing content', async () => {
    const { result, genai } = await dailySummary({
      day: '2025-01-02',
      entries: [
        { id: 'e1', day: '2025-01-02', text: 'I studied all evening for the exam.' },
        { id: 'e2', day: '2025-01-02', text: 'Slept badly again, still tired.' },
      ],
    });
    assert.equal(genai, false);
    assert.match(result.text, /2025-01-02/);
    assert.match(result.text, /coursework/);
    assert.match(result.text, /sleep/);
  });

  test('handles days with no clear topic', async () => {
    const { result } = await dailySummary({
      day: '2025-01-02',
      entries: [{ id: 'e1', day: '2025-01-02', text: 'It was a day.' }],
    });
    assert.match(result.text, /did not mention/i);
  });

  test('returns immediately when there are no entries', async () => {
    const { result, genai, reason } = await dailySummary({ day: '2025-01-02', entries: [] });
    assert.equal(genai, false);
    assert.equal(reason, 'no-entries');
    assert.match(result.text, /no notes/i);
  });
});

// ---------------------------------------------------------------------------
// briefResponse
// ---------------------------------------------------------------------------

describe('briefResponse', () => {
  test('parses a valid GenAI response', async () => {
    setKey();
    mockFetchResponding({ kind: 'acknowledgement', text: 'Noted and saved.' });
    const { result, genai } = await briefResponse({ text: 'A quiet day.', recentKinds: [] });
    assert.equal(genai, true);
    assert.equal(result.kind, 'acknowledgement');
    assert.equal(result.text, 'Noted and saved.');
  });

  test('repairs a repeated invite-elaboration into an acknowledgement', async () => {
    setKey();
    mockFetchResponding({ kind: 'invite-elaboration', text: 'Want to say more?' });
    const { result, genai } = await briefResponse({ text: 'More thoughts.', recentKinds: ['invite-elaboration'] });
    assert.equal(genai, true);
    assert.equal(result.kind, 'acknowledgement');
    assert.doesNotMatch(result.text, /more\?/i);
  });

  test('fallback never invites twice in a row', async () => {
    const { result, genai } = await briefResponse({ text: 'A short note.', recentKinds: ['invite-elaboration'] });
    assert.equal(genai, false);
    assert.notEqual(result.kind, 'invite-elaboration');
  });
});

// ---------------------------------------------------------------------------
// linkEntries
// ---------------------------------------------------------------------------

describe('linkEntries', () => {
  const entries = [
    { id: 'a', day: '2025-01-01', text: 'The coursework deadline moved and I am worried about the exam.' },
    { id: 'b', day: '2025-01-03', text: 'The coursework deadline is tomorrow and the exam revision is not done.' },
    { id: 'c', day: '2025-01-05', text: 'Had dinner with my friend.' },
  ];

  test('parses and validates GenAI links, dropping unknown ids and relations', async () => {
    setKey();
    mockFetchResponding({
      links: [
        { fromEntryId: 'a', toEntryId: 'b', relation: 'continues', note: 'Both about the same deadline.' },
        { fromEntryId: 'a', toEntryId: 'zzz', relation: 'updates', note: 'Unknown id, must be dropped.' },
        { fromEntryId: 'a', toEntryId: 'c', relation: 'related', note: 'Bad relation, must be dropped.' },
        { fromEntryId: 'a', toEntryId: 'a', relation: 'same-event', note: 'Self link, must be dropped.' },
      ],
    });
    const { result, genai } = await linkEntries(entries);
    assert.equal(genai, true);
    assert.deepEqual(result.links, [
      { fromEntryId: 'a', toEntryId: 'b', relation: 'continues', note: 'Both about the same deadline.' },
    ]);
  });

  test('fallback conservatively links only cross-day notes sharing distinctive words', async () => {
    const { result, genai } = await linkEntries(entries);
    assert.equal(genai, false);
    assert.equal(result.links.length, 1);
    assert.equal(result.links[0].fromEntryId, 'a');
    assert.equal(result.links[0].toEntryId, 'b');
    assert.equal(result.links[0].relation, 'continues');
  });

  test('returns no links for fewer than two entries', async () => {
    const { result, genai, reason } = await linkEntries([entries[0]]);
    assert.equal(genai, false);
    assert.equal(reason, 'too-few-entries');
    assert.deepEqual(result.links, []);
  });
});

// ---------------------------------------------------------------------------
// analyseBackground
// ---------------------------------------------------------------------------

describe('analyseBackground', () => {
  const persistent = [
    { id: 'p1', day: '2025-01-01', text: 'Exam stress is building and I cannot sleep.' },
    { id: 'p2', day: '2025-01-03', text: 'Still awake at night worrying about grades.' },
    { id: 'p3', day: '2025-01-05', text: 'Mum called about my grades again, more pressure.' },
  ];

  test('parses GenAI analysis and drops evidence ids that do not exist', async () => {
    setKey();
    mockFetchResponding({
      approaching: true,
      explanation: 'Sleep and academic worries repeat across Jan 1-5. This is not a clinical judgement.',
      evidence: ['p1', 'p2', 'nope'],
    });
    const { result, genai } = await analyseBackground({ entries: persistent });
    assert.equal(genai, true);
    assert.equal(result.approaching, true);
    assert.deepEqual(result.evidence, ['p1', 'p2']);
    assert.match(result.explanation, /not a clinical judgement/i);
  });

  test('GenAI flag without any valid evidence is forced conservative', async () => {
    setKey();
    mockFetchResponding({ approaching: true, explanation: 'Pattern seen.', evidence: ['nope'] });
    const { result, genai } = await analyseBackground({ entries: persistent });
    assert.equal(genai, true);
    assert.equal(result.approaching, false);
    assert.deepEqual(result.evidence, []);
  });

  test('fallback flags persistence across days with difficult topics', async () => {
    const { result, genai } = await analyseBackground({ entries: persistent });
    assert.equal(genai, false);
    assert.equal(result.approaching, true);
    assert.ok(result.evidence.length > 0);
    assert.match(result.explanation, /not a clinical judgement/i);
    assert.match(result.explanation, /days/i);
  });

  test('fallback stays conservative for sparse or single-day notes', async () => {
    const single = [
      { id: 's1', day: '2025-01-01', text: 'Exam stress.' },
      { id: 's2', day: '2025-01-01', text: 'Cannot sleep.' },
    ];
    const { result } = await analyseBackground({ entries: single });
    assert.equal(result.approaching, false);
    assert.deepEqual(result.evidence, []);
  });

  test('returns immediately with no entries', async () => {
    const { result, genai, reason } = await analyseBackground({ entries: [] });
    assert.equal(genai, false);
    assert.equal(reason, 'no-entries');
    assert.equal(result.approaching, false);
  });
});

// ---------------------------------------------------------------------------
// ask (GenAI path)
// ---------------------------------------------------------------------------

describe('ask GenAI path', () => {
  const entries = [
    { id: 'e1', day: '2025-01-01', text: 'I could not sleep before the exam.' },
    { id: 'e2', day: '2025-01-03', text: 'Slept better after talking to mum.' },
  ];

  test('keeps only verbatim quotes and orders hits by date ascending', async () => {
    setKey();
    mockFetchResponding({
      found: true,
      text: 'Sleep came up twice.',
      hits: [
        { entryId: 'e2', dateLabel: '2025-01-03', quote: 'Slept better after talking to mum.' },
        { entryId: 'e1', dateLabel: '2025-01-01', quote: 'I could not sleep before the exam.' },
        { entryId: 'e1', dateLabel: '2025-01-01', quote: 'I never said this sentence.' },
      ],
    });
    const { result, genai } = await ask({ question: 'How has my sleep been?', entries });
    assert.equal(genai, true);
    assert.equal(result.found, true);
    assert.deepEqual(
      result.hits.map((hit) => hit.entryId),
      ['e1', 'e2'],
    );
  });

  test('found=true with no valid hits becomes an honest not-found', async () => {
    setKey();
    mockFetchResponding({ found: true, text: 'Made up.', hits: [{ entryId: 'e9', dateLabel: 'x', quote: 'fake' }] });
    const { result } = await ask({ question: 'Anything about sleep?', entries });
    assert.equal(result.found, false);
    assert.deepEqual(result.hits, []);
    assert.match(result.text, /could not find/i);
  });
});

// ---------------------------------------------------------------------------
// caseSummary
// ---------------------------------------------------------------------------

describe('caseSummary', () => {
  const entries = [
    { id: 'c1', day: '2025-01-01', text: 'Exam stress and mum asking about grades.' },
    { id: 'c2', day: '2025-01-04', text: 'Coursework deadline moved, more stress.' },
    { id: 'c3', day: '2025-01-06', text: 'Dad called about my study plan.' },
  ];

  test('parses GenAI case summary and filters excerpt ids', async () => {
    setKey();
    mockFetchResponding({
      mainConcerns: ['academic pressure', 'family expectations'],
      recentChange: 'More family contact recently.',
      period: 'Notes from 2025-01-01 to 2025-01-06',
      excerptIds: ['c1', 'c3', 'nope'],
    });
    const { result, genai } = await caseSummary({ entries });
    assert.equal(genai, true);
    assert.deepEqual(result.mainConcerns, ['academic pressure', 'family expectations']);
    assert.deepEqual(result.excerptIds, ['c1', 'c3']);
  });

  test('fallback mirrors the on-device organise heuristics', async () => {
    const { result, genai } = await caseSummary({ entries });
    assert.equal(genai, false);
    assert.deepEqual(result.mainConcerns, ['academic pressure', 'family expectations']);
    assert.equal(result.period, 'Notes from 2025-01-01 to 2025-01-06');
    assert.deepEqual(result.excerptIds, ['c1', 'c2', 'c3']);
    assert.ok(result.recentChange.length > 0);
  });

  test('returns immediately with no entries', async () => {
    const { result, genai, reason } = await caseSummary({ entries: [] });
    assert.equal(genai, false);
    assert.equal(reason, 'no-entries');
    assert.equal(result.period, 'No notes yet');
  });
});
