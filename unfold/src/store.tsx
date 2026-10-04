import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  caseTopics,
  createCase,
  deleteCloudEntries,
  deleteCloudEntry,
  detectCaseLanguage,
  getActiveCase,
  getCaseMessages,
  postCaseMessage,
  registerDevice,
  setCloudConsent,
  syncEntries,
  toSyncPayload,
  transitionCase,
  type BriefResponseKind,
  type SyncResult,
} from './api';
import { buildSampleEntries } from './lib/samples';
import { annotateEntry, buildDraft, shouldOfferSupport } from './lib/organise';
import { uid } from './lib/text';
import type { AttributeId, CaseItem, Draft, Entry, Message, Persisted, TopicId } from './types';

const KEY = 'unfold.v1';

const EMPTY: Persisted = {
  onboarded: false,
  entries: [],
  cases: [],
  messages: [],
  snoozeUntilCount: 0,
  draft: null,
  deviceToken: null,
  installId: null,
  cloudOrg: false,
  recentResponseKinds: [],
};

function keepAudio(uri?: string): string | undefined {
  if (!uri) return undefined;
  if (/^(file|content|blob):/i.test(uri)) return uri;
  return undefined;
}

function sanitize(raw: unknown): Persisted {
  if (!raw || typeof raw !== 'object') return EMPTY;
  const data = raw as Partial<Persisted>;
  return {
    onboarded: Boolean(data.onboarded),
    entries: Array.isArray(data.entries)
      ? data.entries.map((entry) => ({ ...entry, audioUri: keepAudio(entry.audioUri) && entry.audioUri?.startsWith('blob:') ? undefined : keepAudio(entry.audioUri) }))
      : [],
    cases: Array.isArray(data.cases) ? data.cases : [],
    messages: Array.isArray(data.messages) ? data.messages : [],
    snoozeUntilCount: typeof data.snoozeUntilCount === 'number' ? data.snoozeUntilCount : 0,
    draft: data.draft ?? null,
    deviceToken: typeof data.deviceToken === 'string' ? data.deviceToken : null,
    installId: typeof data.installId === 'string' ? data.installId : null,
    cloudOrg: Boolean(data.cloudOrg),
    recentResponseKinds: Array.isArray(data.recentResponseKinds)
      ? (data.recentResponseKinds.filter((kind) => typeof kind === 'string') as Persisted['recentResponseKinds'])
      : [],
  };
}

type Store = Persisted & {
  ready: boolean;
  shouldPrompt: boolean;
  openCase: CaseItem | null;
  completeOnboarding: () => void;
  /** Toggle the independent cloud-organisation consent. Resolves false if the server could not apply it. */
  setCloudOrg: (next: boolean) => Promise<boolean>;
  /** Record the kind of a brief response shown after saving (feeds /api/respond recentKinds). */
  noteResponseKind: (kind: BriefResponseKind) => void;
  addEntry: (transcript: string, audioUri?: string) => Entry | null;
  setEventTime: (id: string, eventAt: string) => void;
  deleteEntry: (id: string) => void;
  loadSamples: () => void;
  clearAll: () => void;
  dismissPrompt: () => void;
  prepareDraft: () => Draft | null;
  updateDraft: (mainConcerns: string, recentChange: string) => void;
  /** Approve the reviewed draft. Submits to the server when cloud organisation is on. */
  approveSharing: () => Promise<CaseItem | null>;
  /** Pull the latest server status/messages for the open remote case. Silent no-op offline. */
  refreshCaseFromServer: () => Promise<void>;
  withdrawCase: (id: string) => void;
  rematchCase: (id: string) => void;
  continueCase: (id: string) => void;
  markReplySeen: (id: string) => void;
  sendMessage: (caseId: string, from: Message['from'], text: string) => void;
  messagesFor: (caseId: string) => Message[];
};

const StoreContext = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<Persisted>(EMPTY);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(KEY)
      .then((raw) => {
        if (!active) return;
        if (raw) setData(sanitize(JSON.parse(raw)));
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
  }, []);

  function commit(next: Persisted) {
    setData(next);
    AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => undefined);
  }

  function update(recipe: (current: Persisted) => Persisted) {
    setData((current) => {
      const next = recipe(current);
      AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => undefined);
      return next;
    });
  }

  const openCase = useMemo(
    () => [...data.cases].reverse().find((item) => item.status !== 'withdrawn') ?? null,
    [data.cases],
  );

  /**
   * Lazily register this install with the server and return the device token.
   * Returns null when the server is unreachable — callers then keep working
   * fully on-device.
   */
  async function ensureDeviceToken(current: Persisted): Promise<string | null> {
    if (current.deviceToken) return current.deviceToken;
    try {
      const installId = current.installId ?? `${uid()}${uid()}`;
      const registration = await registerDevice(installId);
      update((state) => ({
        ...state,
        installId,
        deviceToken: registration.token,
        cloudOrg: Boolean(registration.cloudOrg),
      }));
      return registration.token;
    } catch {
      return null;
    }
  }

  /**
   * Merge server classification results back into local entries and mark them
   * as synced (the flag scopes later per-entry cloud deletes).
   */
  function mergeSyncResults(results: SyncResult[]) {
    update((current) => ({
      ...current,
      entries: current.entries.map((item) => {
        const result = results.find((entry) => entry.clientId === item.id);
        if (!result) return item;
        return {
          ...item,
          topics: Array.isArray(result.topics) ? (result.topics as TopicId[]) : item.topics,
          attributes: Array.isArray(result.attributes) ? (result.attributes as AttributeId[]) : item.attributes,
          uncertainty: result.uncertainty ?? item.uncertainty,
          genai: Boolean(result.genai),
          synced: true,
        };
      }),
    }));
  }

  /**
   * Fire-and-forget cloud sync for one entry. Sends deidentified text only
   * (never the transcript) and merges the returned classification back into
   * the local entry. Offline/failure silently keeps the local rules.
   */
  function syncEntryToCloud(entry: Entry) {
    if (!data.cloudOrg || !data.deviceToken) return;
    const token = data.deviceToken;
    syncEntries(token, [toSyncPayload(entry)])
      .then(({ results }) => mergeSyncResults(results))
      .catch(() => undefined);
  }

  /**
   * Backfill: when cloud organisation is switched on, push the deidentified
   * text of every existing local note (batched to the server's 200-per-call
   * limit). Failures degrade silently to the on-device rules and are logged.
   */
  function backfillCloud(entries: Entry[], token: string) {
    const batches: Entry[][] = [];
    for (let index = 0; index < entries.length; index += 200) {
      batches.push(entries.slice(index, index + 200));
    }
    void (async () => {
      for (const batch of batches) {
        try {
          const { results } = await syncEntries(token, batch.map(toSyncPayload));
          mergeSyncResults(results);
        } catch (error) {
          console.warn('[unfold] cloud backfill failed for a batch of', batch.length, 'entries', error);
        }
      }
    })();
  }

  const shouldPrompt =
    shouldOfferSupport(data.entries) && data.entries.length >= data.snoozeUntilCount && openCase == null;

  const store = useMemo<Store>(() => {
    return {
      ...data,
      ready,
      shouldPrompt,
      openCase,
      completeOnboarding: () => update((current) => ({ ...current, onboarded: true })),
      setCloudOrg: async (next) => {
        const token = await ensureDeviceToken(data);
        if (!token) return false;
        try {
          // Turning the consent off also asks the server to purge every cloud
          // copy of this device's entries (contract: purgeCloud only with off).
          const result = await setCloudConsent(token, next, next ? undefined : { purgeCloud: true });
          update((current) => ({ ...current, cloudOrg: Boolean(result.cloudOrg) }));
          // Turning it on backfills existing local notes (deidentified text only).
          if (result.cloudOrg && data.entries.length > 0) backfillCloud(data.entries, token);
          return Boolean(result.cloudOrg);
        } catch {
          return false;
        }
      },
      noteResponseKind: (kind) =>
        update((current) => ({
          ...current,
          recentResponseKinds: [...current.recentResponseKinds, kind].slice(-5),
        })),
      addEntry: (transcript, audioUri) => {
        const trimmed = transcript.trim();
        if (!trimmed) return null;
        const entry = annotateEntry(trimmed, new Date().toISOString(), uid(), audioUri);
        update((current) => ({ ...current, entries: [...current.entries, entry] }));
        syncEntryToCloud(entry);
        return entry;
      },
      setEventTime: (id, eventAt) => {
        update((current) => ({
          ...current,
          entries: current.entries.map((entry) => (entry.id === id ? { ...entry, eventAt } : entry)),
        }));
        // The server accepts eventAt updates: re-sync this note when cloud is on.
        const entry = data.entries.find((item) => item.id === id);
        if (entry) syncEntryToCloud({ ...entry, eventAt });
      },
      deleteEntry: (id) => {
        const target = data.entries.find((entry) => entry.id === id);
        // Propagate the delete to the cloud copy, but only for entries known
        // to have synced. Failure is logged and never blocks the local delete.
        if (target?.synced && data.cloudOrg && data.deviceToken) {
          void deleteCloudEntry(data.deviceToken, id).catch((error) =>
            console.warn('[unfold] cloud delete failed for entry', id, error),
          );
        }
        update((current) => ({ ...current, entries: current.entries.filter((entry) => entry.id !== id) }));
      },
      loadSamples: () => {
        const samples = buildSampleEntries();
        update((current) => ({
          ...current,
          entries: [...current.entries.filter((entry) => !entry.id.startsWith('sample-')), ...samples],
          snoozeUntilCount: 0,
        }));
      },
      clearAll: () => {
        // "Delete everything" also deletes every cloud copy of this device's
        // entries. Failure is logged and never blocks the local wipe.
        if (data.cloudOrg && data.deviceToken) {
          void deleteCloudEntries(data.deviceToken).catch((error) =>
            console.warn('[unfold] cloud delete-all failed', error),
          );
        }
        commit({ ...EMPTY, onboarded: true });
      },
      dismissPrompt: () => update((current) => ({ ...current, snoozeUntilCount: current.entries.length + 2 })),
      prepareDraft: () => {
        let created: Draft | null = data.draft;
        update((current) => {
          if (current.entries.length === 0) return current;
          const draft = buildDraft(current.entries);
          created = draft;
          if (JSON.stringify(draft) === JSON.stringify(current.draft)) return current;
          return { ...current, draft };
        });
        return created;
      },
      updateDraft: (mainConcerns, recentChange) =>
        update((current) => {
          if (!current.draft) return current;
          return {
            ...current,
            draft: {
              ...current.draft,
              mainConcerns: mainConcerns.trim() || current.draft.mainConcerns,
              recentChange: recentChange.trim() || current.draft.recentChange,
            },
          };
        }),
      approveSharing: async () => {
        if (!data.draft) return null;
        const draft = data.draft;
        let id = uid();
        let remote = false;
        if (data.cloudOrg && data.deviceToken) {
          try {
            const created = await createCase(data.deviceToken, {
              mainConcerns: draft.mainConcerns,
              recentChange: draft.recentChange,
              period: draft.period,
              excerpts: draft.excerpts,
              topics: caseTopics(data.entries),
              language: detectCaseLanguage(data.entries),
            });
            id = created.id;
            remote = true;
          } catch {
            // Server unreachable: keep a clearly-labelled local demo case.
          }
        }
        const item: CaseItem = {
          id,
          createdAt: new Date().toISOString(),
          status: 'queued',
          summary: draft,
          seenReply: true,
          remote,
        };
        update((current) => ({
          ...current,
          draft: null,
          cases: [...current.cases, item],
        }));
        return item;
      },
      refreshCaseFromServer: async () => {
        if (!data.cloudOrg || !data.deviceToken) return;
        const target = openCase;
        if (!target || !target.remote) return;
        try {
          const { case: active } = await getActiveCase(data.deviceToken);
          if (!active || active.id !== target.id) return;
          const { messages } = await getCaseMessages(data.deviceToken, active.id);
          update((current) => ({
            ...current,
            messages: [
              ...current.messages.filter((message) => message.caseId !== active.id),
              ...messages.map((message) => ({
                id: message.id,
                caseId: active.id,
                from: message.sender,
                text: message.text,
                createdAt: message.createdAt,
                ...(message.workerName ? { workerName: message.workerName } : {}),
              })),
            ],
            cases: current.cases.map((item) => {
              if (item.id !== active.id) return item;
              const newReply = active.status === 'replied' && item.status !== 'replied';
              return {
                ...item,
                status: active.status,
                claimCount: active.claimCount,
                waitingNoWorker: active.waitingNoWorker,
                seenReply: newReply ? false : item.seenReply,
              };
            }),
          }));
        } catch {
          // Offline: keep the last known local state.
        }
      },
      withdrawCase: (id) => {
        const target = data.cases.find((item) => item.id === id);
        if (target?.remote && data.deviceToken) {
          void transitionCase(data.deviceToken, id, 'withdraw').catch(() => undefined);
        }
        update((current) => ({
          ...current,
          snoozeUntilCount: current.entries.length + 2,
          cases: current.cases.map((item) => (item.id === id ? { ...item, status: 'withdrawn' } : item)),
        }));
      },
      rematchCase: (id) => {
        const target = data.cases.find((item) => item.id === id);
        if (target?.remote && data.deviceToken) {
          void transitionCase(data.deviceToken, id, 'rematch').catch(() => undefined);
        }
        update((current) => ({
          ...current,
          cases: current.cases.map((item) =>
            item.id === id
              ? item.remote
                ? // Server semantics: back to the queue with claim_count + 1.
                  { ...item, status: 'queued', claimCount: (item.claimCount ?? 0) + 1, seenReply: true }
                : { ...item, status: 'rematch', seenReply: true }
              : item,
          ),
        }));
      },
      continueCase: (id) => {
        const target = data.cases.find((item) => item.id === id);
        if (target?.remote && data.deviceToken) {
          void transitionCase(data.deviceToken, id, 'continue').catch(() => undefined);
        }
        update((current) => ({
          ...current,
          cases: current.cases.map((item) => (item.id === id ? { ...item, status: 'continued', seenReply: true } : item)),
        }));
      },
      markReplySeen: (id) =>
        update((current) => ({
          ...current,
          cases: current.cases.map((item) => (item.id === id ? { ...item, seenReply: true } : item)),
        })),
      sendMessage: (caseId, from, text) => {
        const trimmed = text.trim();
        if (!trimmed) return;
        const target = data.cases.find((item) => item.id === caseId);
        if (from === 'student' && target?.remote && data.deviceToken) {
          // Server is the source of truth; the next refresh reconciles.
          void postCaseMessage(data.deviceToken, caseId, trimmed).catch(() => undefined);
        }
        const message: Message = {
          id: uid(),
          caseId,
          from,
          text: trimmed.slice(0, 500),
          createdAt: new Date().toISOString(),
        };
        update((current) => ({
          ...current,
          messages: [...current.messages, message],
          cases: current.cases.map((item) => {
            if (item.id !== caseId) return item;
            if (from === 'worker' && (item.status === 'queued' || item.status === 'rematch')) {
              return { ...item, status: 'replied', seenReply: false };
            }
            if (from === 'worker') return { ...item, seenReply: false };
            return item;
          }),
        }));
      },
      messagesFor: (caseId) => data.messages.filter((message) => message.caseId === caseId),
    };
    // update is recreated each render and closes over the latest data for draft/approve.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, ready, shouldPrompt, openCase]);

  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const store = useContext(StoreContext);
  if (!store) throw new Error('useStore must be used within StoreProvider');
  return store;
}
