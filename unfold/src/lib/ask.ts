import { entryWhen, formatDay } from './dates';
import type { Entry } from '../types';

const STOP = new Set([
  'what', 'when', 'where', 'who', 'did', 'does', 'do', 'i', 'me', 'my', 'about', 'the', 'a', 'an', 'of', 'to', 'and', 'or', 'in', 'on', 'for', 'is', 'was', 'were', 'it', 'that', 'this', 'with', 'from', 'have', 'has', 'had', 'mention', 'mentioned', 'say', 'said', 'find', 'show', 'tell', 'earlier', 'last', 'week', 'today', 'yesterday',
]);

export type AskHit = {
  entryId: string;
  createdAt: string;
  dateLabel: string;
  quote: string;
};

export type AskAnswer = {
  found: boolean;
  text: string;
  hits: AskHit[];
};

function words(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 2 && !STOP.has(word));
}

export function askEntries(question: string, entries: Entry[]): AskAnswer {
  const query = words(question);
  if (query.length === 0) {
    return {
      found: false,
      text: 'Try asking about something you recorded, such as coursework or sleep.',
      hits: [],
    };
  }

  const ranked = entries
    .map((entry) => {
      const haystack = words(`${entry.transcript} ${entry.deidentified}`);
      const score = query.reduce((total, word) => total + (haystack.includes(word) ? 1 : 0), 0);
      return { entry, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.entry.createdAt.localeCompare(b.entry.createdAt));

  if (ranked.length === 0) {
    return {
      found: false,
      text: 'I could not find that in the notes on this phone.',
      hits: [],
    };
  }

  const hits = ranked.slice(0, 3).map(({ entry }) => ({
    entryId: entry.id,
    createdAt: entryWhen(entry),
    dateLabel: formatDay(entryWhen(entry)),
    quote: entry.transcript,
  }));

  const lines = hits.map((hit) => `On ${hit.dateLabel} you said: “${hit.quote}”`);
  return {
    found: true,
    text: lines.join('\n\n'),
    hits,
  };
}
