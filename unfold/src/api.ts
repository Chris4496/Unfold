import { askEntries, type AskAnswer, type AskHit } from './lib/ask';
import { entryWhen } from './lib/dates';
import { dailySummary, shouldOfferSupport, supportPromptCopy } from './lib/organise';
import type { AttributeId, CaseStatus, Draft, Entry, TokenKind, TopicId } from './types';

/**
 * Typed client for the Unfold backend (see server/CONTRACT.md).
 *
 * Data boundary: only DEIDENTIFIED text is ever sent, and only when the
 * student has explicitly enabled the independent cloud-organisation consent.
 * Original transcripts and audio never leave the device. No API key is
 * bundled here — every GenAI call happens server-side (Gemini,
 * key from the server environment only).
 *
 * Every GenAI feature has a deterministic local fallback: the *WithFallback
 * helpers below resolve a local on-device result whenever the server is
 * unreachable, and carry `genai: false` / `source: 'device'` so the UI can
 * disclose that the output is not GenAI.
 */

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8787';

const TIMEOUT_MS = 8000;

export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  token?: string | null;
  body?: unknown;
};

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: options.method ?? (options.body === undefined ? 'GET' : 'POST'),
      headers: {
        'content-type': 'application/json',
        ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: controller.signal,
    });
    const data = (await response.json().catch(() => null)) as unknown;
    if (!response.ok) {
      const code =
        data && typeof data === 'object' && typeof (data as { error?: unknown }).error === 'string'
          ? (data as { error: string }).error
          : undefined;
      throw new ApiError(code ?? `Request failed with status ${response.status}`, response.status, code);
    }
    return data as T;
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Contract shapes
// ---------------------------------------------------------------------------

export type DeviceRegistration = {
  deviceId: string;
  token: string;
  cloudOrg: boolean;
  created_at: string;
};

export type ConsentResult = {
  deviceId: string;
  cloudOrg: boolean;
  created_at: string;
};

/** The only per-entry payload allowed to leave the device. NEVER includes the transcript. */
export type SyncEntryInput = {
  clientId: string;
  createdAt: string;
  eventAt?: string;
  deidentified: string;
  tokens: TokenKind[];
};

export type SyncResult = {
  clientId: string;
  topics: TopicId[];
  attributes: AttributeId[] | Record<string, unknown>;
  uncertainty: unknown;
  genai: boolean;
};

export type DaySummaryResult = { day: string; text: string; genai: boolean };

export type ServerAskHit = { clientId: string; dateLabel: string; quote: string };
export type ServerAskResult = { found: boolean; text: string; hits: ServerAskHit[]; genai: boolean };

export type BriefResponseKind = 'acknowledgement' | 'encouragement' | 'invite-elaboration';
export type BriefResponseResult = { kind: BriefResponseKind; text: string; genai: boolean };

export type AnalysisResult = {
  approaching: boolean;
  explanation: string | null;
  evidence: unknown[];
  genai: boolean;
  updatedAt: string | null;
};

export type ActiveCase = {
  id: string;
  status: CaseStatus;
  createdAt: string;
  updatedAt: string;
  claimCount: number;
  claimed: boolean;
  waitingNoWorker: boolean;
  messages: number;
};

export type CaseMessage = { id: string; sender: 'worker' | 'student'; text: string; createdAt: string; workerName?: string | null };

// ---------------------------------------------------------------------------
// Raw endpoints
// ---------------------------------------------------------------------------

export function registerDevice(installId: string): Promise<DeviceRegistration> {
  return request<DeviceRegistration>('/api/devices/register', { method: 'POST', body: { installId } });
}

export function setCloudConsent(
  token: string,
  cloudOrg: boolean,
  options?: { purgeCloud?: boolean },
): Promise<ConsentResult> {
  return request<ConsentResult>('/api/devices/me/consent', {
    method: 'PUT',
    token,
    body: { cloudOrg, ...(options?.purgeCloud ? { purgeCloud: true } : {}) },
  });
}

export function syncEntries(token: string, entries: SyncEntryInput[]): Promise<{ results: SyncResult[] }> {
  return request<{ results: SyncResult[] }>('/api/entries/sync', { method: 'POST', token, body: { entries } });
}

/** Delete every synced entry for this device (paired with "Delete everything"). */
export function deleteCloudEntries(token: string): Promise<{ deleted: number }> {
  return request<{ deleted: number }>('/api/entries', { method: 'DELETE', token });
}

/** Delete one synced entry by its client id (paired with deleting a note). */
export function deleteCloudEntry(token: string, clientId: string): Promise<{ deleted: number }> {
  return request<{ deleted: number }>(`/api/entries/${encodeURIComponent(clientId)}`, { method: 'DELETE', token });
}

export function getDaySummary(token: string, day: string): Promise<DaySummaryResult> {
  return request<DaySummaryResult>(`/api/summaries/${encodeURIComponent(day)}`, { token });
}

export function askOnServer(token: string, question: string): Promise<ServerAskResult> {
  return request<ServerAskResult>('/api/ask', { method: 'POST', token, body: { question } });
}

export function respondOnServer(
  token: string,
  input: { deidentified: string; recentKinds: BriefResponseKind[] },
): Promise<BriefResponseResult> {
  return request<BriefResponseResult>('/api/respond', { method: 'POST', token, body: input });
}

export function getAnalysis(token: string): Promise<AnalysisResult> {
  return request<AnalysisResult>('/api/analysis', { token });
}

export function createCase(
  token: string,
  input: {
    mainConcerns: string;
    recentChange: string;
    period: string;
    excerpts: Draft['excerpts'];
    topics: TopicId[];
    language?: string;
  },
): Promise<{ id: string }> {
  return request<{ id: string }>('/api/cases', { method: 'POST', token, body: input });
}

export function getActiveCase(token: string): Promise<{ case: ActiveCase | null }> {
  return request<{ case: ActiveCase | null }>('/api/cases/active', { token });
}

export function transitionCase(
  token: string,
  id: string,
  action: 'withdraw' | 'continue' | 'rematch',
): Promise<{ id: string; status: CaseStatus }> {
  return request<{ id: string; status: CaseStatus }>(`/api/cases/${encodeURIComponent(id)}/${action}`, {
    method: 'POST',
    token,
    body: {},
  });
}

export function getCaseMessages(token: string, id: string): Promise<{ messages: CaseMessage[] }> {
  return request<{ messages: CaseMessage[] }>(`/api/cases/${encodeURIComponent(id)}/messages`, { token });
}

export function postCaseMessage(token: string, id: string, text: string): Promise<{ message: CaseMessage }> {
  return request<{ message: CaseMessage }>(`/api/cases/${encodeURIComponent(id)}/messages`, {
    method: 'POST',
    token,
    body: { text },
  });
}

// ---------------------------------------------------------------------------
// Pure client helpers (unit-tested)
// ---------------------------------------------------------------------------

/**
 * Map a local entry to the sync payload. The transcript and audio URI are
 * deliberately NOT copied — only deidentified text may leave the device.
 */
export function toSyncPayload(entry: Entry): SyncEntryInput {
  return {
    clientId: entry.id,
    createdAt: entry.createdAt,
    ...(entry.eventAt ? { eventAt: entry.eventAt } : {}),
    deidentified: entry.deidentified,
    tokens: entry.tokens,
  };
}

/** Guess the case language for worker matching: Cantonese/Chinese notes -> zh-HK, else en. */
export function detectCaseLanguage(entries: Entry[]): string {
  const hasCjk = entries.some((entry) => /[㐀-鿿豈-﫿]/.test(entry.deidentified));
  return hasCjk ? 'zh-HK' : 'en';
}

/** Union of the locally detected topics, used for worker expertise matching. */
export function caseTopics(entries: Entry[]): TopicId[] {
  const topics = new Set<TopicId>();
  for (const entry of entries) for (const topic of entry.topics) topics.add(topic);
  return [...topics];
}

export type Source = 'cloud' | 'device';

export type AskOutcome = AskAnswer & { genai: boolean; source: Source };

/**
 * Ask over the diary: server NL Q&A when a device token is available
 * (cloud organisation enabled), otherwise the deterministic on-device
 * keyword search. Server hits are mapped back to local entries by clientId
 * so the UI can link to the right day.
 */
export async function askWithFallback(
  token: string | null,
  question: string,
  entries: Entry[],
): Promise<AskOutcome> {
  if (token) {
    try {
      const result = await askOnServer(token, question);
      const byId = new Map(entries.map((entry) => [entry.id, entry]));
      const hits: AskHit[] = result.hits.map((hit) => {
        const local = byId.get(hit.clientId);
        return {
          entryId: hit.clientId,
          createdAt: local ? entryWhen(local) : '',
          dateLabel: hit.dateLabel,
          quote: hit.quote,
        };
      });
      return { found: result.found, text: result.text, hits, genai: result.genai, source: 'cloud' };
    } catch {
      // Offline or server error: fall through to the on-device search.
    }
  }
  const local = askEntries(question, entries);
  return { ...local, genai: false, source: 'device' };
}

export type SummaryOutcome = { text: string; genai: boolean; source: Source };

/** Daily summary: server-cached summary when possible, else the local rule. */
export async function daySummaryWithFallback(
  token: string | null,
  day: string,
  entries: Entry[],
): Promise<SummaryOutcome> {
  if (token) {
    try {
      const result = await getDaySummary(token, day);
      return { text: result.text, genai: result.genai, source: 'cloud' };
    } catch {
      // Offline or server error: fall through to the on-device rule.
    }
  }
  return { text: dailySummary(entries), genai: false, source: 'device' };
}

/**
 * Brief response after saving a note. Returns null when the server cannot
 * be reached — the screen then keeps its existing static copy (the local
 * fallback), and saving is never blocked.
 */
export async function respondWithFallback(
  token: string | null,
  input: { deidentified: string; recentKinds: BriefResponseKind[] },
): Promise<(BriefResponseResult & { source: Source }) | null> {
  if (!token) return null;
  try {
    const result = await respondOnServer(token, input);
    return { ...result, source: 'cloud' };
  } catch {
    return null;
  }
}

export type AnalysisOutcome = {
  approaching: boolean;
  explanation: string;
  genai: boolean;
  source: Source;
};

/**
 * Background support analysis: server-side pattern analysis when possible,
 * else the existing local shouldOfferSupport/supportPromptCopy rules.
 * Either way it is a pattern check, not a clinical judgement.
 */
export async function analysisWithFallback(token: string | null, entries: Entry[]): Promise<AnalysisOutcome> {
  if (token) {
    try {
      const result = await getAnalysis(token);
      if (result.updatedAt !== null) {
        return {
          approaching: result.approaching,
          explanation: result.explanation ?? supportPromptCopy(entries),
          genai: result.genai,
          source: 'cloud',
        };
      }
    } catch {
      // Offline or server error: fall through to the local rule.
    }
  }
  return {
    approaching: shouldOfferSupport(entries),
    explanation: supportPromptCopy(entries),
    genai: false,
    source: 'device',
  };
}
