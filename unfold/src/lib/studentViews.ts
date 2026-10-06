import { dayKey, entryWhen } from './dates';
import type { Entry, TopicId } from '../types';

export const TOPIC_LABELS: Record<TopicId, string> = {
  academic: 'Schoolwork',
  family: 'Family',
  sleep: 'Sleep',
  group: 'Group work',
  friends: 'Friends',
};

export const TOPIC_ORDER: TopicId[] = ['academic', 'family', 'group', 'friends', 'sleep'];
export type StudentDateRange = 'week' | 'month' | 'all';

export type ActivityDay = {
  key: string;
  label: string;
  count: number;
};

export type WeeklyStats = {
  noteCount: number;
  uniqueTopicCount: number;
  activity: ActivityDay[];
};

function localKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function mondayOf(date: Date): Date {
  const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12);
  const daysSinceMonday = (monday.getDay() + 6) % 7;
  monday.setDate(monday.getDate() - daysSinceMonday);
  return monday;
}

export function weekDateKeys(now = new Date()): string[] {
  const monday = mondayOf(now);
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + index);
    return localKey(date);
  });
}

export function sortEntriesNewest(entries: Entry[]): Entry[] {
  return [...entries].sort((a, b) => {
    const dateOrder = entryWhen(b).localeCompare(entryWhen(a));
    return dateOrder || b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id);
  });
}

export function entriesInDateRange(
  entries: Entry[],
  range: StudentDateRange,
  now = new Date(),
): Entry[] {
  if (range === 'all') return sortEntriesNewest(entries);

  let firstKey: string;
  let lastKey: string;
  if (range === 'week') {
    const keys = weekDateKeys(now);
    firstKey = keys[0];
    lastKey = keys[keys.length - 1];
  } else {
    firstKey = localKey(new Date(now.getFullYear(), now.getMonth(), 1, 12));
    lastKey = localKey(new Date(now.getFullYear(), now.getMonth() + 1, 0, 12));
  }

  return sortEntriesNewest(entries).filter((entry) => {
    const key = dayKey(entryWhen(entry));
    return key >= firstKey && key <= lastKey;
  });
}

export function weeklyStats(entries: Entry[], now = new Date()): WeeklyStats {
  const keys = weekDateKeys(now);
  const counts = new Map(keys.map((key) => [key, 0]));
  const thisWeek = entries.filter((entry) => counts.has(dayKey(entryWhen(entry))));
  const topics = new Set(thisWeek.flatMap((entry) => entry.topics));
  thisWeek.forEach((entry) => {
    const key = dayKey(entryWhen(entry));
    counts.set(key, (counts.get(key) ?? 0) + 1);
  });

  return {
    noteCount: thisWeek.length,
    uniqueTopicCount: topics.size,
    activity: keys.map((key) => ({
      key,
      label: new Date(`${key}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'short' }),
      count: counts.get(key) ?? 0,
    })),
  };
}

export function entriesForTopic(entries: Entry[], topic: TopicId): Entry[] {
  return sortEntriesNewest(entries.filter((entry) => entry.topics.includes(topic)));
}

export type SharedTopicLink = {
  fromId: string;
  toId: string;
  topics: TopicId[];
};

/** A link means two notes carry at least one identical topic tag; it implies no cause or judgement. */
export function sharedTopicLinks(entries: Entry[]): SharedTopicLink[] {
  const ordered = [...entries].sort((a, b) => a.id.localeCompare(b.id));
  const links: SharedTopicLink[] = [];
  for (let left = 0; left < ordered.length; left += 1) {
    for (let right = left + 1; right < ordered.length; right += 1) {
      const topics = ordered[left].topics.filter((topic) => ordered[right].topics.includes(topic));
      if (topics.length > 0) {
        links.push({ fromId: ordered[left].id, toId: ordered[right].id, topics });
      }
    }
  }
  return links;
}

export function topicsInEntries(entries: Entry[]): TopicId[] {
  const found = new Set(entries.flatMap((entry) => entry.topics));
  return TOPIC_ORDER.filter((topic) => found.has(topic));
}
