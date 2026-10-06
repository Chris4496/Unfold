import test from 'node:test';
import assert from 'node:assert/strict';
import {
  awaitingWorkerReplyCount,
  buildRecentActivity,
  buildTimelineEvents,
  excerptDate,
  excerptText,
  filterMapEvents,
  matchingTopics,
} from './viewModel.js';

const caseData = {
  id: 'case-1',
  status: 'continued',
  created_at: '2025-01-01T10:00:00Z',
  claimed_at: '2025-01-02T10:00:00Z',
  topics: ['Academic', 'Friends'],
  excerpts: [
    { text: 'Academic work felt difficult.', date: '2025-01-03T10:00:00Z' },
    { deidentified: 'A shared excerpt without a date.' },
    { text: 'Tagged excerpt', topics: ['Friends'] },
  ],
};

test('excerpt helpers preserve only supplied text and dates', () => {
  assert.equal(excerptText({ text: 'Approved text', date: '2025-01-01' }), 'Approved text');
  assert.equal(excerptText('Plain approved text'), 'Plain approved text');
  assert.equal(excerptDate({ event_at: '2025-01-03' }), '2025-01-03');
  assert.equal(excerptDate({ createdAt: '2025-01-04T10:00:00Z' }), '2025-01-04T10:00:00Z');
  assert.equal(excerptDate('No metadata'), null);
});

test('timeline uses known timestamps and explicitly leaves absent dates unknown', () => {
  const events = buildTimelineEvents(caseData, [
    { id: 'm1', sender: 'student', text: 'Thanks', created_at: '2025-01-04T10:00:00Z' },
    { id: 'm2', sender: 'worker', text: 'Actual reply', created_at: null },
  ]);
  assert.deepEqual(events.slice(0, 3).map((event) => event.label), [
    'Case shared', 'Case claimed', 'Student-approved excerpt',
  ]);
  assert.ok(events.findIndex((event) => event.id === 'excerpt-0') < events.findIndex((event) => event.id === 'message-m1'));
  assert.equal(events.find((event) => event.id === 'excerpt-0').dateKnown, true);
  assert.equal(events.find((event) => event.id === 'excerpt-1').dateKnown, false);
  assert.equal(events.find((event) => event.id === 'message-m2').dateKnown, false);
  assert.equal(events.find((event) => event.id === 'excerpt-1').chronologicalNext, false);
  assert.equal(events.find((event) => event.id === 'excerpt-2').topics[0], 'Friends');
});

test('theme matching is literal or uses actual per-excerpt tags, not semantic inference', () => {
  const events = buildTimelineEvents(caseData);
  assert.deepEqual(matchingTopics(events.find((event) => event.id === 'excerpt-0'), caseData.topics), ['Academic']);
  assert.deepEqual(matchingTopics(events.find((event) => event.id === 'excerpt-1'), caseData.topics), []);
  assert.deepEqual(matchingTopics(events.find((event) => event.id === 'excerpt-2'), caseData.topics), ['Friends']);
});

test('date filter excludes old dated events but retains unknown dates transparently', () => {
  const events = buildTimelineEvents(caseData);
  const filtered = filterMapEvents(events, { range: '30', now: new Date('2025-02-01T00:00:00Z') }, caseData.topics);
  assert.equal(filtered.some((event) => event.id === 'case-shared'), false);
  assert.equal(filtered.some((event) => event.id === 'excerpt-1'), true);
  assert.deepEqual(
    filterMapEvents(events, { topic: 'friends' }, caseData.topics).map((event) => event.id),
    ['excerpt-2'],
  );
});

test('real student excerpt payload retains its date, chronological order and range filtering', () => {
  const events = buildTimelineEvents({
    ...caseData,
    status: 'claimed',
    excerpts: [
      { id: 'newer', createdAt: '2025-01-04T10:00:00Z', text: 'Recent note' },
      { id: 'older', createdAt: '2024-12-01T10:00:00Z', text: 'Older note' },
    ],
  });
  assert.equal(events.find((event) => event.id === 'excerpt-newer').dateKnown, true);
  assert.ok(events.findIndex((event) => event.id === 'excerpt-older') < events.findIndex((event) => event.id === 'excerpt-newer'));
  const filtered = filterMapEvents(events, { range: '30', now: new Date('2025-01-05T10:00:00Z') });
  assert.equal(filtered.some((event) => event.id === 'excerpt-newer'), true);
  assert.equal(filtered.some((event) => event.id === 'excerpt-older'), false);
});

test('rolling date ranges include both boundaries but exclude future events', () => {
  const now = new Date('2025-04-01T00:00:00Z');
  for (const range of ['30', '90']) {
    const cutoff = now.getTime() - Number(range) * 86400000;
    const events = [
      { id: 'before', dateKnown: true, time: cutoff - 1 },
      { id: 'cutoff', dateKnown: true, time: cutoff },
      { id: 'now', dateKnown: true, time: now.getTime() },
      { id: 'future', dateKnown: true, time: now.getTime() + 1 },
      { id: 'undated', dateKnown: false, time: null },
    ];
    assert.deepEqual(filterMapEvents(events, { range, now }).map((event) => event.id), ['cutoff', 'now', 'undated']);
    assert.equal(filterMapEvents(events, { range: 'all', now }).length, events.length);
  }
});

test('continuing without a new message appears at the actual case transition time', () => {
  const reply = { id: 'reply', sender: 'worker', text: 'A reply', created_at: '2025-01-04T10:00:00Z' };
  const continued = { ...caseData, updated_at: '2025-01-05T10:00:00Z', lastMessage: reply };
  const event = buildTimelineEvents(continued, [reply]).find((item) => item.id === 'case-continued');
  assert.equal(event.label, 'Student continued');
  assert.equal(event.date, continued.updated_at);
  assert.equal(event.dateKnown, true);
  const activity = buildRecentActivity([continued]);
  assert.equal(activity[0].label, 'Student continued');
  assert.equal(activity[0].date, continued.updated_at);
  assert.equal(activity[0].caseId, continued.id);
  assert.equal(buildTimelineEvents({ ...continued, status: 'replied' }, [reply]).some((item) => item.id === 'case-continued'), false);
});

test('later messages do not fabricate a continuation timestamp from updated_at', () => {
  const message = { id: 'student', sender: 'student', text: 'Following up', created_at: '2025-01-06T10:00:00Z' };
  const continued = { ...caseData, updated_at: message.created_at, lastMessage: message };
  const event = buildTimelineEvents(continued, [message]).find((item) => item.id === 'case-continued');
  assert.equal(event.dateKnown, false);
  assert.equal(event.date, null);
  assert.equal(buildRecentActivity([continued]).find((item) => item.label === 'Student continued').date, null);
});

test('dashboard activity sorts only by actual API timestamps and counts student continuations', () => {
  const activity = buildRecentActivity(
    [{ id: 'mine', period: 'recent', claimed_at: '2025-01-01T00:00:00Z', lastMessage: { sender: 'student', created_at: '2025-01-03T00:00:00Z' } }],
    [{ id: 'queue', period: 'queued', created_at: '2025-01-02T00:00:00Z' }],
  );
  assert.deepEqual(activity.map((event) => event.label), [
    'Student replied', 'Matched case in queue', 'Case claimed',
  ]);
  assert.equal(awaitingWorkerReplyCount([{ status: 'continued' }, { status: 'replied' }]), 1);
});
