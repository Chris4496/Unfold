import type { TokenKind } from '../types';

const TOKEN_ORDER: TokenKind[] = ['PERSON', 'SCHOOL', 'ADDRESS', 'PHONE', 'EMAIL'];

const NAME_STOP = new Set([
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
  'Today',
  'Yesterday',
  'Tomorrow',
  'January',
  'February',
  'March',
  'April',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
  'Secondary',
  'Primary',
  'School',
  'College',
  'University',
  'The',
  'This',
  'That',
  'Mum',
  'Mom',
  'Dad',
  'More',
  'Really',
  'Very',
  'Just',
  'Not',
]);

export type Redaction = {
  text: string;
  tokens: TokenKind[];
};

function pushToken(tokens: TokenKind[], token: TokenKind): string {
  tokens.push(token);
  return `[${token}]`;
}

export function uniqueTokens(tokens: TokenKind[]): TokenKind[] {
  return TOKEN_ORDER.filter((token) => tokens.includes(token));
}

export function deidentify(input: string): Redaction {
  const tokens: TokenKind[] = [];
  let text = input;

  text = text.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, () => pushToken(tokens, 'EMAIL'));
  text = text.replace(/\b(?:\+?852[\s-]?)?[569]\d{3}[\s-]?\d{4}\b/g, () => pushToken(tokens, 'PHONE'));
  text = text.replace(
    /\b\d{1,5}[A-Za-z]?(?:\/\d{1,4})?\s+(?:[A-Z][\w'’.-]+\s+){0,4}(?:Road|Street|Rd|St|Avenue|Ave|Lane|Drive|Path|Estate|Building|Court|Crescent|Square)\b/g,
    () => pushToken(tokens, 'ADDRESS'),
  );
  text = text.replace(
    /\b(?:[A-Z][\w'’.-]+\s+){1,4}(?:Secondary|Primary|College|University|Academy|Institute|School)\b/g,
    () => pushToken(tokens, 'SCHOOL'),
  );
  text = text.replace(/\b(?:Mr|Mrs|Ms|Miss|Dr|Prof)\.?\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\b/g, () =>
    pushToken(tokens, 'PERSON'),
  );
  text = text.replace(
    /\b(friend|classmate|teacher|tutor)\s+([A-Z][a-z]+)\b/g,
    (full, relation: string, name: string) => {
      if (NAME_STOP.has(name)) return full;
      return `${relation} ${pushToken(tokens, 'PERSON')}`;
    },
  );
  text = text.replace(/\b(?:my name is|i am called|i'm called|named)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b/gi, (full, name: string) => {
    if (NAME_STOP.has(name)) return full;
    const prefix = full.slice(0, full.length - name.length);
    return `${prefix}${pushToken(tokens, 'PERSON')}`;
  });
  text = text.replace(/\b([A-Z][a-z]+)\s+said\b/g, (full, name: string) => {
    if (NAME_STOP.has(name) || name.startsWith('[')) return full;
    return `${pushToken(tokens, 'PERSON')} said`;
  });

  return { text, tokens: uniqueTokens(tokens) };
}
