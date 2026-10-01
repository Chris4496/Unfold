export type TokenKind = 'PERSON' | 'SCHOOL' | 'ADDRESS' | 'PHONE' | 'EMAIL';

export type TopicId = 'academic' | 'family' | 'sleep' | 'group' | 'friends';

export type AttributeId = 'event' | 'feeling' | 'interpersonal' | 'help' | 'everyday';

export type Entry = {
  id: string;
  createdAt: string;
  eventAt?: string;
  transcript: string;
  deidentified: string;
  tokens: TokenKind[];
  topics: TopicId[];
  attributes: AttributeId[];
  audioUri?: string;
};

export type Excerpt = {
  id: string;
  createdAt: string;
  text: string;
};

export type Draft = {
  mainConcerns: string;
  recentChange: string;
  tokens: TokenKind[];
  period: string;
  excerpts: Excerpt[];
};

export type CaseStatus = 'queued' | 'replied' | 'continued' | 'rematch' | 'withdrawn';

export type CaseItem = {
  id: string;
  createdAt: string;
  status: CaseStatus;
  summary: Draft;
  seenReply: boolean;
};

export type Message = {
  id: string;
  caseId: string;
  from: 'worker' | 'student';
  text: string;
  createdAt: string;
};

export type Persisted = {
  onboarded: boolean;
  entries: Entry[];
  cases: CaseItem[];
  messages: Message[];
  snoozeUntilCount: number;
  draft: Draft | null;
};
