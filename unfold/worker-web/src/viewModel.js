const ACTIVE_STATUSES = new Set(['claimed', 'replied', 'continued']);

export function excerptText(excerpt) {
  if (excerpt && typeof excerpt === 'object') {
    return excerpt.text ?? excerpt.deidentified ?? excerpt.excerpt ?? '';
  }
  return String(excerpt ?? '');
}

export function excerptDate(excerpt) {
  if (excerpt && typeof excerpt === 'object') {
    return excerpt.date ?? excerpt.eventAt ?? excerpt.event_at ?? excerpt.createdAt ?? excerpt.created_at ?? null;
  }
  return null;
}

function timestamp(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Messages also update updated_at, so it is a continuation timestamp only when
 * it follows all available message timestamps. Otherwise retain an undated
 * status event instead of attributing a later message's date to the transition.
 */
function continuationDate(caseData, messages) {
  const updated = timestamp(caseData.updated_at);
  const messageDates = messages.map((message) => timestamp(message.created_at));
  if (!updated || messageDates.length === 0 || messageDates.some((date) => !date)) return null;
  return messageDates.every((date) => updated.getTime() > date.getTime()) ? caseData.updated_at : null;
}

function explicitTopics(excerpt, caseTopics) {
  if (!excerpt || typeof excerpt !== 'object') return [];
  const assigned = Array.isArray(excerpt.topics)
    ? excerpt.topics
    : typeof excerpt.topic === 'string'
      ? [excerpt.topic]
      : [];
  return assigned.filter((topic) => caseTopics.includes(topic));
}

/**
 * Build chronology only from server timestamps and the actual approved excerpts/messages.
 * Missing or invalid dates remain explicitly undated rather than being inferred.
 */
export function buildTimelineEvents(caseData, messages = []) {
  const events = [];
  const add = (event) => {
    const date = timestamp(event.date);
    events.push({ ...event, dateKnown: Boolean(date), time: date?.getTime() ?? null });
  };

  add({
    id: 'case-shared',
    kind: 'case',
    label: 'Case shared',
    text: 'The student-approved case summary was shared with you.',
    date: caseData.created_at,
    topics: [],
  });

  if (caseData.claimed_at || ACTIVE_STATUSES.has(caseData.status)) {
    add({
      id: 'case-claimed',
      kind: 'case',
      label: 'Case claimed',
      text: 'This case was claimed by a worker.',
      date: caseData.claimed_at,
      topics: [],
    });
  }

  if (caseData.status === 'continued') {
    const date = continuationDate(caseData, messages);
    add({
      id: 'case-continued',
      kind: 'case',
      label: 'Student continued',
      text: date
        ? 'The student chose to continue the conversation after a worker reply.'
        : 'The student has chosen to continue. The exact transition date is not separately recorded.',
      date,
      topics: [],
    });
  }

  const caseTopics = Array.isArray(caseData.topics) ? caseData.topics : [];
  (Array.isArray(caseData.excerpts) ? caseData.excerpts : []).forEach((excerpt, index) => {
    add({
      id: `excerpt-${excerpt && typeof excerpt === 'object' && excerpt.id ? excerpt.id : index}`,
      kind: 'excerpt',
      label: excerpt && typeof excerpt === 'object' && excerpt.id ? `Approved source record · ${excerpt.id}` : 'Student-approved excerpt',
      text: excerptText(excerpt),
      date: excerptDate(excerpt),
      topics: explicitTopics(excerpt, caseTopics),
    });
  });

  messages.forEach((message, index) => {
    add({
      id: `message-${message.id ?? index}`,
      kind: 'message',
      label: message.sender === 'worker' ? 'Worker message' : 'Student message',
      text: message.text ?? '',
      date: message.created_at,
      sender: message.sender,
      topics: [],
    });
  });

  return events
    .map((event, index) => ({ ...event, sourceOrder: index }))
    .sort((a, b) => {
      if (a.dateKnown && b.dateKnown) return a.time - b.time || a.sourceOrder - b.sourceOrder;
      if (a.dateKnown) return -1;
      if (b.dateKnown) return 1;
      return a.sourceOrder - b.sourceOrder;
    })
    .map((event, index, ordered) => {
      const { sourceOrder, ...viewEvent } = event;
      return { ...viewEvent, chronologicalNext: event.dateKnown && Boolean(ordered[index + 1]?.dateKnown) };
    });
}

function normalizedText(value) {
  return String(value ?? '').toLocaleLowerCase().trim();
}

/** Literal, case-insensitive text match only; it does not infer semantic links. */
export function matchingTopics(event, caseTopics) {
  const text = normalizedText(event.text);
  const explicit = event.topics || [];
  return caseTopics.filter((topic) => {
    const normalizedTopic = normalizedText(topic);
    return explicit.includes(topic) || (normalizedTopic && text.includes(normalizedTopic));
  });
}

/** Apply date and optional theme filters without assigning undated records a date. */
export function filterMapEvents(events, { topic = '', range = 'all', now = new Date() } = {}, caseTopics = []) {
  const selectedTopic = normalizedText(topic);
  const days = range === '30' || range === '90' ? Number(range) : null;
  const cutoff = days ? now.getTime() - days * 24 * 60 * 60 * 1000 : null;

  return events.filter((event) => {
    if (selectedTopic && !matchingTopics(event, caseTopics).some((match) => normalizedText(match) === selectedTopic)) {
      return false;
    }
    if (cutoff === null || !event.dateKnown) return true;
    return event.time >= cutoff && event.time <= now.getTime();
  });
}

/** Derive dashboard activity only from case timestamps and each case's API-provided latest message. */
export function buildRecentActivity(cases, queueCases = [], limit = 5) {
  const activity = [];
  for (const item of cases) {
    if (item.status === 'continued') {
      activity.push({
        id: `continued-${item.id}`,
        caseId: item.id,
        label: 'Student continued',
        detail: item.period || 'Your active case',
        date: continuationDate(item, item.lastMessage ? [item.lastMessage] : []),
      });
    }
    if (item.claimed_at) {
      activity.push({
        id: `claim-${item.id}`,
        caseId: item.id,
        label: 'Case claimed',
        detail: item.period || 'Your active case',
        date: item.claimed_at,
      });
    }
    if (item.lastMessage) {
      activity.push({
        id: `message-${item.id}`,
        caseId: item.id,
        label: item.lastMessage.sender === 'worker' ? 'You sent a message' : 'Student replied',
        detail: item.period || 'Your active case',
        date: item.lastMessage.created_at,
      });
    }
  }
  for (const item of queueCases) {
    activity.push({
      id: `available-${item.id}`,
      caseId: null,
      label: 'Matched case in queue',
      detail: item.period || 'Case queue',
      date: item.created_at,
      href: '/queue',
    });
  }

  return activity
    .map((item, index) => ({ ...item, time: timestamp(item.date)?.getTime() ?? null, sourceOrder: index }))
    .sort((a, b) => {
      if (a.time !== null && b.time !== null) return b.time - a.time || a.sourceOrder - b.sourceOrder;
      if (a.time !== null) return -1;
      if (b.time !== null) return 1;
      return a.sourceOrder - b.sourceOrder;
    })
    .slice(0, limit)
    .map(({ time, sourceOrder, ...item }) => item);
}

export function awaitingWorkerReplyCount(cases) {
  return cases.filter((item) => item.status === 'continued').length;
}
