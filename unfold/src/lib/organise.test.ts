import assert from 'node:assert/strict';
import { test } from 'node:test';
import { askEntries } from './ask';
import { buildSampleEntries } from './samples';
import { buildDraft, dailySummary, shouldOfferSupport, supportPromptCopy } from './organise';

test('sample week matches the review summary', () => {
  const entries = buildSampleEntries(new Date('2026-10-01T12:00:00'));
  const draft = buildDraft(entries);
  assert.equal(draft.mainConcerns, 'Academic pressure and family expectations');
  assert.equal(draft.recentChange, 'More sleep concerns this week');
  assert.deepEqual(draft.tokens, ['PERSON', 'SCHOOL', 'ADDRESS']);

  const shared = JSON.stringify(draft);
  for (const hidden of ['Jamie', 'Westview', 'Harbour', 'Chan']) {
    assert.equal(new RegExp(`\\b${hidden}\\b`).test(shared), false, hidden);
  }
  assert.equal(/\b88\b/.test(shared), false);
  assert.equal(shouldOfferSupport(entries), true);
  assert.match(supportPromptCopy(entries), /coursework and group collaboration/);
});

test('daily summary stays neutral', () => {
  const entries = buildSampleEntries(new Date('2026-10-01T12:00:00')).slice(0, 2);
  const summary = dailySummary(entries);
  assert.match(summary, /^Today you talked about/);
  assert.doesNotMatch(summary, /risk|diagnosis|anxious|score/i);
});

test('questions are answered only from recorded notes', () => {
  const entries = buildSampleEntries(new Date('2026-10-01T12:00:00'));
  const found = askEntries('What did I mention about sleep?', entries);
  assert.equal(found.found, true);
  assert.match(found.text, /sleep concerns/);

  const missing = askEntries('When did I mention a football final?', entries);
  assert.equal(missing.found, false);
  assert.match(missing.text, /could not find/);
});
