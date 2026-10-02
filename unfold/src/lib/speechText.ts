import { readableTranscript } from './transcriptText';

export type TranscriptDraft = {
  committed: string;
  interim: string;
};

export type RecognitionChoice = {
  lang: string;
  onDevice: boolean;
};

const PREFERRED_LANGUAGES = ['yue-Hant-HK', 'yue-HK', 'zh-HK', 'zh-yue', 'en-HK', 'en-US', 'en-GB'];

export function emptyDraft(): TranscriptDraft {
  return { committed: '', interim: '' };
}

export function chooseRecognitionLanguage(
  locales: readonly string[],
  installedLocales: readonly string[],
  fallback = 'zh-HK',
): RecognitionChoice {
  const installed = matchLanguage(installedLocales, PREFERRED_LANGUAGES);
  if (installed) return { lang: installed, onDevice: true };
  const supported = matchLanguage(locales, PREFERRED_LANGUAGES);
  if (supported) return { lang: supported, onDevice: false };
  if (installedLocales[0]) return { lang: installedLocales[0], onDevice: true };
  if (locales[0]) return { lang: locales[0], onDevice: false };
  return { lang: fallback, onDevice: false };
}

export function languageSwitchLocales(installedLocales: readonly string[]): string[] | null {
  const chinese = installedLocales.filter((locale) => /^(yue|zh)(-|$)/i.test(normalizeLocale(locale)));
  const english = installedLocales.filter((locale) => /^en(-|$)/i.test(normalizeLocale(locale)));
  if (chinese.length === 0 || english.length === 0) return null;
  return [...chinese, ...english];
}

export function applyRecognitionResult(
  draft: TranscriptDraft,
  result: { isFinal: boolean; transcript: string },
): TranscriptDraft {
  const piece = result.transcript.replace(/\s+/g, ' ').trim();
  if (!result.isFinal) return { committed: draft.committed, interim: piece };
  if (!piece) {
    if (!draft.committed && draft.interim) return { committed: draft.interim, interim: '' };
    return { committed: draft.committed, interim: '' };
  }
  if (!draft.committed || extendsCommitted(draft.committed, piece)) return { committed: piece, interim: '' };
  return { committed: joinSpeech(draft.committed, piece), interim: '' };
}

export function readDraft(draft: TranscriptDraft): string {
  const committed = draft.committed.trim();
  const interim = draft.interim.trim();
  if (!interim) return readableTranscript(committed);
  if (!committed || extendsCommitted(committed, interim)) return readableTranscript(interim);
  return readableTranscript(joinSpeech(committed, interim));
}

export function joinSpeech(left: string, right: string): string {
  const first = left.trim();
  const second = right.trim();
  if (!first) return second;
  if (!second) return first;
  if (/[\u4E00-\u9FFF]$/.test(first) && /^[\u4E00-\u9FFF]/.test(second)) return `${first}${second}`;
  return `${first} ${second}`;
}

function matchLanguage(available: readonly string[], preferred: readonly string[]): string | null {
  for (const candidate of preferred) {
    const found = available.find((locale) => sameLocale(locale, candidate));
    if (found) return found;
  }
  return null;
}

function sameLocale(left: string, right: string): boolean {
  const a = normalizeLocale(left);
  const b = normalizeLocale(right);
  if (a === b) return true;
  return a.split('-')[0] === 'yue' && b.split('-')[0] === 'yue';
}

function normalizeLocale(locale: string): string {
  return locale.replace(/_/g, '-').trim().toLowerCase();
}

function extendsCommitted(committed: string, piece: string): boolean {
  if (piece === committed) return true;
  if (!piece.startsWith(committed)) return false;
  const next = piece.charAt(committed.length);
  if (!next || /\s/.test(next)) return true;
  return /[\u4E00-\u9FFF]$/.test(committed);
}
