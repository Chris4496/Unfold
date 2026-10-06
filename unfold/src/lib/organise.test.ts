import assert from 'node:assert/strict';
import { test } from 'node:test';
import { askEntries } from './ask';
import { annotateEntry, buildDraft, dailySummary, shouldOfferSupport, supportPromptCopy } from './organise';

function sampleEntries() {
  return [
    annotateEntry('Coursework and group work took longer than I expected.', '2026-09-27T20:00:00.000Z', 'test-1'),
    annotateEntry('I talked with a friend after class and felt more settled.', '2026-09-28T20:00:00.000Z', 'test-2'),
    annotateEntry('I stayed awake worrying about the presentation deadline.', '2026-09-29T20:00:00.000Z', 'test-3'),
    annotateEntry('My family asked about grades, and I slept badly; my sleep was restless.', '2026-09-30T20:00:00.000Z', 'test-4'),
  ];
}

test('case draft and support prompt summarize recorded topics without inventing assessment', () => {
  const entries = sampleEntries();
  const draft = buildDraft(entries);
  assert.equal(draft.mainConcerns, 'Academic pressure and family expectations');
  assert.equal(draft.recentChange, 'More sleep concerns this week');
  assert.deepEqual(draft.tokens, []);
  assert.equal(shouldOfferSupport(entries), true);
  assert.match(supportPromptCopy(entries), /coursework and group collaboration/);
});

test('daily summary stays neutral', () => {
  const summary = dailySummary(sampleEntries().slice(0, 2));
  assert.match(summary, /^Today you talked about/);
  assert.doesNotMatch(summary, /risk|diagnosis|anxious|score/i);
});

test('questions are answered only from recorded notes', () => {
  const entries = sampleEntries();
  const found = askEntries('What did I mention about sleep?', entries);
  assert.equal(found.found, true);
  assert.match(found.text, /sleep/);

  const missing = askEntries('When did I mention a football final?', entries);
  assert.equal(missing.found, false);
  assert.match(missing.text, /could not find/);
});
