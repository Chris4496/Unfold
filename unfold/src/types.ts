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
  /** Set when the cloud organiser classified this entry (false = server fallback rules). */
  genai?: boolean;
  /** Server-reported classification uncertainty, when synced (shape owned by the server). */
  uncertainty?: unknown;
  /** True once the cloud organiser has acknowledged this entry (scopes cloud deletes). */
  synced?: boolean;
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

export type CaseStatus = 'queued' | 'claimed' | 'replied' | 'continued' | 'rematch' | 'withdrawn';

export type CaseItem = {
  id: string;
  createdAt: string;
  status: CaseStatus;
  summary: Draft;
  seenReply: boolean;
  /** True when the case lives on the server (cloud organisation on at submit time). */
  remote?: boolean;
  /** Server-side claim counter, refreshed from GET /api/cases/active. */
  claimCount?: number;
  /** Server read-time flag: queued/rematch longer than the unclaimed timeout. */
  waitingNoWorker?: boolean;
};

export type Message = {
  id: string;
  caseId: string;
  from: 'worker' | 'student';
  text: string;
  createdAt: string;
  /** Display name of the replying social worker, when the server provides one. */
  workerName?: string;
};

export type Persisted = {
  onboarded: boolean;
  entries: Entry[];
  cases: CaseItem[];
  messages: Message[];
  snoozeUntilCount: number;
  draft: Draft | null;
  /** Opaque device token from POST /api/devices/register (null until first cloud use). */
  deviceToken: string | null;
  /** Stable install identifier used for idempotent device registration. */
  installId: string | null;
  /** Independent cloud-organisation consent. Only deidentified text syncs when on. */
  cloudOrg: boolean;
  /** Kinds of the last few brief responses shown after saving (for /api/respond). */
  recentResponseKinds: ('acknowledgement' | 'encouragement' | 'invite-elaboration')[];
};
