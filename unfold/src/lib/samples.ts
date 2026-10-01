import { daysAgo } from './dates';
import { annotateEntry } from './organise';
import type { Entry } from '../types';

const SAMPLE_NOTES = [
  {
    days: 6,
    text: 'Coursework is piling up at Westview Secondary. Ms Chan said the deadline is Friday and I can\'t concentrate.',
  },
  {
    days: 4,
    text: 'Group task allocation felt unfair. I talked to my friend Jamie about it after class.',
  },
  {
    days: 2,
    text: 'I went back to 88 Harbour Road. Mum keeps asking about grades, and family expectations are a lot.',
  },
  {
    days: 1,
    text: 'I have more sleep concerns this week. I keep thinking about the group project and academic pressure.',
  },
];

export function buildSampleEntries(now = new Date()): Entry[] {
  return SAMPLE_NOTES.map((note, index) => annotateEntry(note.text, daysAgo(note.days, now), `sample-${index}`));
}
