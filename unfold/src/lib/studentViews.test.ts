import assert from 'node:assert/strict';
import { test } from 'node:test';
import { dayKey } from './dates';
import { entriesForTopic, entriesInDateRange, sharedTopicLinks, sortEntriesNewest, weekDateKeys, weeklyStats } from './studentViews';
import type { Entry, TopicId } from '../types';

function localDate(year: number, month: number, day: number, hour = 12): string {
  return new Date(year, month - 1, day, hour).toISOString();
}

function entry(id: string, eventAt: string, topics: TopicId[] = [], createdAt = eventAt): Entry {
  return {
    id,
    createdAt,
    eventAt,
    transcript: id,
    deidentified: id,
    tokens: [],
    topics,
    attributes: [],
  };
}

test('week date keys use local Monday through Sunday boundaries', () => {
  const now = new Date(2026, 3, 15, 9);
  assert.deepEqual(weekDateKeys(now), Array.from({ length: 7 }, (_, index) => `2026-04-${String(13 + index).padStart(2, '0')}`));
  assert.deepEqual(weekDateKeys(new Date(2026, 3, 19, 23)), weekDateKeys(now));
});

test('weekly stats count event dates, note topics, and activity days from local calendar dates', () => {
  const entries = [
    entry('monday', localDate(2026, 4, 13), ['academic']),
    entry('monday-again', localDate(2026, 4, 13, 18), ['friends'], localDate(2026, 4, 20)),
    entry('sunday', localDate(2026, 4, 19), ['academic', 'sleep']),
    entry('outside-week', localDate(2026, 4, 20), ['family']),
  ];
  const stats = weeklyStats(entries, new Date(2026, 3, 15, 10));
  assert.equal(stats.noteCount, 3);
  assert.equal(stats.uniqueTopicCount, 3);
  assert.deepEqual(stats.activity.map(({ key, count }) => [key, count]), [
    ['2026-04-13', 2], ['2026-04-14', 0], ['2026-04-15', 0], ['2026-04-16', 0],
    ['2026-04-17', 0], ['2026-04-18', 0], ['2026-04-19', 1],
  ]);
});

test('date ranges use eventAt and return newest dated notes first', () => {
  const entries = [
    entry('april-first', localDate(2026, 4, 1), [], localDate(2026, 5, 3)),
    entry('march', localDate(2026, 3, 31)),
    entry('april-last', localDate(2026, 4, 30)),
    entry('may', localDate(2026, 5, 1)),
  ];
  const month = entriesInDateRange(entries, 'month', new Date(2026, 3, 15));
  assert.deepEqual(month.map(({ id }) => id), ['april-last', 'april-first']);
  assert.deepEqual(entriesForTopic([...entries, entry('tagged', localDate(2026, 4, 10), ['sleep'])], 'sleep').map(({ id }) => id), ['tagged']);
  assert.equal(dayKey(month[1].eventAt!), '2026-04-01');
});

test('newest sorting prioritizes event date, then save time, then a stable id', () => {
  const sameEventDate = localDate(2026, 4, 10);
  const entries = [
    entry('zeta', sameEventDate, [], localDate(2026, 4, 10, 9)),
    entry('older', localDate(2026, 4, 9)),
    entry('late', sameEventDate, [], localDate(2026, 4, 10, 18)),
    entry('alpha', sameEventDate, [], localDate(2026, 4, 10, 9)),
  ];
  assert.deepEqual(sortEntriesNewest(entries).map(({ id }) => id), ['late', 'alpha', 'zeta', 'older']);
});

test('shared-topic graph links include only pairs with shared topic tags', () => {
  const links = sharedTopicLinks([
    entry('note-c', localDate(2026, 4, 3), ['sleep']),
    entry('note-b', localDate(2026, 4, 2), ['friends', 'academic']),
    entry('note-a', localDate(2026, 4, 1), ['academic']),
    entry('note-d', localDate(2026, 4, 4), ['academic', 'friends']),
  ]);
  assert.deepEqual(links, [
    { fromId: 'note-a', toId: 'note-b', topics: ['academic'] },
    { fromId: 'note-a', toId: 'note-d', topics: ['academic'] },
    { fromId: 'note-b', toId: 'note-d', topics: ['friends', 'academic'] },
  ]);
});
