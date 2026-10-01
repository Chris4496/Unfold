import { dayKey, entryWhen, formatDay } from './dates';
import { deidentify } from './deidentify';
import { capitalize, clip, joinAnd, sentences, uid } from './text';
import type { AttributeId, Draft, Entry, TopicId, TokenKind } from '../types';

const TOPICS: { id: TopicId; phrase: string; daily: string; words: string[] }[] = [
  {
    id: 'academic',
    phrase: 'academic pressure',
    daily: 'coursework',
    words: ['coursework', 'homework', 'exam', 'exams', 'grade', 'grades', 'study', 'studying', 'assignment', 'deadline', 'class', 'project', 'schoolwork', 'academic', 'concentrate'],
  },
  {
    id: 'family',
    phrase: 'family expectations',
    daily: 'family',
    words: ['family', 'mum', 'mom', 'dad', 'parent', 'parents'],
  },
  {
    id: 'group',
    phrase: 'group collaboration',
    daily: 'group tasks',
    words: ['group', 'allocation', 'teammate', 'teammates', 'collaboration'],
  },
  {
    id: 'sleep',
    phrase: 'sleep',
    daily: 'sleep',
    words: ['sleep', 'sleeping', 'slept', 'insomnia', 'tired', 'awake'],
  },
  {
    id: 'friends',
    phrase: 'time with friends',
    daily: 'meeting friends',
    words: ['friend', 'friends'],
  },
];

const DIFFICULT = new Set<TopicId>(['academic', 'family', 'sleep', 'group']);

function topicById(id: TopicId) {
  return TOPICS.find((topic) => topic.id === id)!;
}

export function detectTopics(transcript: string): TopicId[] {
  const lower = transcript.toLowerCase();
  return TOPICS.filter((topic) => topic.words.some((word) => new RegExp(`\\b${word}\\b`, 'i').test(lower))).map((topic) => topic.id);
}

export function detectAttributes(transcript: string): AttributeId[] {
  const lower = transcript.toLowerCase();
  const attributes: AttributeId[] = [];
  if (/\b(feel|feeling|felt|tired|stressed|stress|worried|worry|pressure|can't|cannot|unfair)\b/i.test(lower)) {
    attributes.push('feeling');
  }
  if (/\b(friend|mum|mom|dad|parent|group|teacher|classmate)\b/i.test(lower)) {
    attributes.push('interpersonal');
  }
  if (/\b(counsellor|counselor|social worker|help|support)\b/i.test(lower)) {
    attributes.push('help');
  }
  if (/\b(went|said|talked|finished|met|happened|deadline|class|home)\b/i.test(lower)) {
    attributes.push('event');
  }
  if (attributes.length === 0) attributes.push('everyday');
  return attributes;
}

export function annotateEntry(transcript: string, createdAt: string, id = uid(), audioUri?: string): Entry {
  const clean = transcript.replace(/\s+/g, ' ').trim().slice(0, 4000);
  const redacted = deidentify(clean);
  const audio = audioUri && /^(file|content):/i.test(audioUri) ? audioUri : undefined;
  return {
    id,
    createdAt,
    transcript: clean,
    deidentified: redacted.text,
    tokens: redacted.tokens,
    topics: detectTopics(clean),
    attributes: detectAttributes(clean),
    audioUri: audio,
  };
}

function sorted(entries: Entry[]): Entry[] {
  return [...entries].sort((a, b) => entryWhen(a).localeCompare(entryWhen(b)));
}

function countTopic(entries: Entry[], topic: TopicId): number {
  return entries.filter((entry) => entry.topics.includes(topic)).length;
}

export function mainConcerns(entries: Entry[]): string {
  const present = new Set(entries.flatMap((entry) => entry.topics));
  if (present.has('academic') && present.has('family')) {
    return 'Academic pressure and family expectations';
  }
  const ranked = TOPICS.map((topic) => topic.id)
    .filter((id) => present.has(id) && id !== 'sleep')
    .sort((a, b) => countTopic(entries, b) - countTopic(entries, a));
  const chosen = (ranked.length ? ranked : [...present]).slice(0, 2) as TopicId[];
  if (chosen.length === 0) return 'Notes from your recent recordings';
  return capitalize(joinAnd(chosen.map((id) => topicById(id).phrase)));
}

export function recentChange(entries: Entry[]): string {
  const list = sorted(entries);
  if (list.length < 2) return 'This is the first note, so there is no change to compare yet.';
  const mid = Math.floor(list.length / 2);
  const early = list.slice(0, Math.max(mid, 1));
  const late = list.slice(Math.max(mid, 1));
  if (countTopic(late, 'sleep') > countTopic(early, 'sleep')) {
    return 'More sleep concerns this week';
  }
  for (const topic of ['academic', 'family', 'group'] as TopicId[]) {
    if (countTopic(late, topic) > countTopic(early, topic) && countTopic(early, topic) === 0) {
      return `More ${topicById(topic).phrase} recently`;
    }
  }
  return 'Your recent notes stay on similar topics.';
}

export function dailySummary(entries: Entry[]): string {
  const phrases: string[] = [];
  for (const entry of sorted(entries)) {
    for (const topic of entry.topics) {
      const phrase = topicById(topic).daily;
      if (!phrases.includes(phrase)) phrases.push(phrase);
    }
  }
  if (phrases.length === 0) return 'You saved a note on this phone.';
  return `Today you talked about ${joinAnd(phrases)}.`;
}

export function periodLabel(entries: Entry[]): string {
  const list = sorted(entries);
  if (list.length === 0) return 'No notes yet';
  const start = formatDay(entryWhen(list[0]));
  const end = formatDay(entryWhen(list[list.length - 1]));
  if (start === end) return `Notes from ${start}`;
  return `Notes from ${start} to ${end}`;
}

export function shouldOfferSupport(entries: Entry[]): boolean {
  // Prototype pattern check only. It is not a clinical threshold or a risk score.
  if (entries.length < 3) return false;
  const days = new Set(entries.map((entry) => dayKey(entryWhen(entry))));
  if (days.size < 2) return false;
  const hard = new Set<TopicId>();
  for (const entry of entries) {
    for (const topic of entry.topics) {
      if (DIFFICULT.has(topic)) hard.add(topic);
    }
  }
  return hard.size >= 2;
}

export function supportPromptCopy(entries: Entry[]): string {
  const topics = new Set(entries.flatMap((entry) => entry.topics));
  if (topics.has('academic') && (topics.has('group') || topics.has('friends'))) {
    return 'You have mentioned difficulties with coursework and group collaboration several times recently, and they have continued for a while. Would you like to submit the relevant background to a social worker so they can contact you?';
  }
  const labels = [...topics].filter((topic) => DIFFICULT.has(topic)).map((topic) => topicById(topic).phrase);
  const subject = joinAnd(labels) || 'a few difficulties';
  return `You have mentioned ${subject} several times recently, and this has continued across more than one day. Would you like to prepare a short summary for a social worker?`;
}

export function buildDraft(entries: Entry[]): Draft {
  const list = sorted(entries);
  const tokens = new Set<TokenKind>();
  for (const entry of list) entry.tokens.forEach((token) => tokens.add(token));
  return {
    mainConcerns: mainConcerns(list),
    recentChange: recentChange(list),
    tokens: (['PERSON', 'SCHOOL', 'ADDRESS', 'PHONE', 'EMAIL'] as TokenKind[]).filter((token) => tokens.has(token)),
    period: periodLabel(list),
    excerpts: list.slice(-6).map((entry) => ({
      id: entry.id,
      createdAt: entryWhen(entry),
      text: clip(sentences(entry.deidentified)[0] ?? entry.deidentified),
    })),
  };
}

export function dayKeyOf(iso: string): string {
  return dayKey(iso);
}
