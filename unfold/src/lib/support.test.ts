import assert from 'node:assert/strict';
import { test } from 'node:test';
import { daysAgo } from './dates';
import { annotateEntry, shouldOfferSupport } from './organise';

test('ordinary notes do not trigger a support prompt', () => {
  const now = new Date('2026-10-01T12:00:00');
  const entries = [
    annotateEntry('I had lunch and listened to music.', daysAgo(2, now)),
    annotateEntry('Walked to the library and borrowed a novel.', daysAgo(1, now)),
    annotateEntry('Cooked noodles and called it a quiet day.', daysAgo(0, now)),
  ];
  assert.equal(shouldOfferSupport(entries), false);
});
