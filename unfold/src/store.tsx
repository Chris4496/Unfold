import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  caseTopics,
  createCase,
  deleteCloudEntries,
  deleteCloudEntry,
  detectCaseLanguage,
  getActiveCase,
  getCaseMessages,
  getFictionalDemoSession,
  postCaseMessage,
  registerDevice,
  setCloudConsent,
  syncEntries,
  toSyncPayload,
  transitionCase,
  type BriefResponseKind,
  type SyncResult,
} from './api';
import { annotateEntry, buildDraft, shouldOfferSupport } from './lib/organise';
import {
  buildFictionalDemoData,
  FICTIONAL_DEMO_ACTIVE_KEY,
  FICTIONAL_DEMO_STORAGE_KEY,
  PERSONAL_STORAGE_KEY,
} from './lib/fictionalDemo';
import { runIfSessionCurrent, SessionScopeGuard, type SessionScope } from './lib/sessionScope';
import { uid } from './lib/text';
import type { AttributeId, CaseItem, Draft, Entry, Message, Persisted, TopicId } from './types';

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
  isDemo: boolean;
  demoLoading: boolean;
  demoError: string | null;
  enterDemo: () => Promise<boolean>;
  exitDemo: () => Promise<void>;
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
  const [isDemo, setIsDemo] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [demoError, setDemoError] = useState<string | null>(null);
  const sessionGuardRef = useRef<SessionScopeGuard | null>(null);
  if (!sessionGuardRef.current) sessionGuardRef.current = new SessionScopeGuard();
  const sessionGuard = sessionGuardRef.current;
  const storageQueueRef = useRef<Promise<void>>(Promise.resolve());
  const transitionRef = useRef(0);
  const demoLoadingRef = useRef(false);
  const exitPendingRef = useRef(false);

  function serializeStorage<T>(operation: () => Promise<T>): Promise<T> {
    const result = storageQueueRef.current.then(operation, operation);
    storageQueueRef.current = result.then(() => undefined, () => undefined);
    return result;
  }

  useEffect(() => {
    let active = true;
    Promise.all([
      AsyncStorage.getItem(PERSONAL_STORAGE_KEY),
      AsyncStorage.getItem(FICTIONAL_DEMO_ACTIVE_KEY),
      AsyncStorage.getItem(FICTIONAL_DEMO_STORAGE_KEY),
    ])
      .then(([personalRaw, demoActive, demoRaw]) => {
        if (!active) return;
        if (demoActive === '1' && demoRaw) {
          sessionGuard.activate(true);
          setData(sanitize(JSON.parse(demoRaw)));
          setIsDemo(true);
        } else if (personalRaw) {
          setData(sanitize(JSON.parse(personalRaw)));
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
  }, []);

  function commit(next: Persisted, scope: SessionScope | null = sessionGuard.capture()) {
    if (!scope) return;
    setData((current) => {
      const result = runIfSessionCurrent(sessionGuard, scope, () => {
        void serializeStorage(() => AsyncStorage.setItem(scope.storageKey, JSON.stringify(next))).catch(() => undefined);
        return next;
      });
      return result.applied ? result.value : current;
    });
  }

  function update(
    recipe: (current: Persisted) => Persisted,
    scope: SessionScope | null = sessionGuard.capture(),
  ) {
    if (!scope) return;
    setData((current) => {
      const result = runIfSessionCurrent(sessionGuard, scope, () => {
        const next = recipe(current);
        void serializeStorage(() => AsyncStorage.setItem(scope.storageKey, JSON.stringify(next))).catch(() => undefined);
        return next;
      });
      return result.applied ? result.value : current;
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
  async function ensureDeviceToken(current: Persisted, scope: SessionScope): Promise<string | null> {
    if (current.deviceToken) return current.deviceToken;
    try {
      const installId = current.installId ?? `${uid()}${uid()}`;
      const registration = await registerDevice(installId);
      update((state) => ({
        ...state,
        installId,
        deviceToken: registration.token,
        cloudOrg: Boolean(registration.cloudOrg),
      }), scope);
      return registration.token;
    } catch {
      return null;
    }
  }

  /**
   * Merge server classification results back into local entries and mark them
   * as synced (the flag scopes later per-entry cloud deletes).
   */
  function mergeSyncResults(results: SyncResult[], scope: SessionScope) {
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
    }), scope);
  }

  /**
   * Fire-and-forget cloud sync for one entry. Sends deidentified text only
   * (never the transcript) and merges the returned classification back into
   * the local entry. Offline/failure silently keeps the local rules.
   */
  function syncEntryToCloud(entry: Entry, scope: SessionScope) {
    if (!data.cloudOrg || !data.deviceToken || !sessionGuard.isCurrent(scope)) return;
    const token = data.deviceToken;
    syncEntries(token, [toSyncPayload(entry)])
      .then(({ results }) => mergeSyncResults(results, scope))
      .catch(() => undefined);
  }

  /**
   * Backfill: when cloud organisation is switched on, push the deidentified
   * text of every existing local note (batched to the server's 200-per-call
   * limit). Failures degrade silently to the on-device rules and are logged.
   */
  function backfillCloud(entries: Entry[], token: string, scope: SessionScope) {
    const batches: Entry[][] = [];
    for (let index = 0; index < entries.length; index += 200) {
      batches.push(entries.slice(index, index + 200));
    }
    void (async () => {
      for (const batch of batches) {
        if (!sessionGuard.isCurrent(scope)) return;
        try {
          const { results } = await syncEntries(token, batch.map(toSyncPayload));
          if (!sessionGuard.isCurrent(scope)) return;
          mergeSyncResults(results, scope);
        } catch (error) {
          console.warn('[unfold] cloud backfill failed for a batch of', batch.length, 'entries', error);
        }
      }
    })();
  }

  const shouldPrompt =
    shouldOfferSupport(data.entries) && data.entries.length >= data.snoozeUntilCount && openCase == null;

  const store = useMemo<Store>(() => {
    const scope = sessionGuard.capture();
    const scopedUpdate = (recipe: (current: Persisted) => Persisted) => update(recipe, scope);
    const scopedCommit = (next: Persisted) => commit(next, scope);
    return {
      ...data,
      ready,
      isDemo,
      demoLoading,
      demoError,
      shouldPrompt,
      openCase,
      completeOnboarding: () => scopedUpdate((current) => ({ ...current, onboarded: true })),
      setCloudOrg: async (next) => {
        if (isDemo || !scope) return false;
        const token = await ensureDeviceToken(data, scope);
        if (!token || !sessionGuard.isCurrent(scope)) return false;
        try {
          // Turning the consent off also asks the server to purge every cloud
          // copy of this device's entries (contract: purgeCloud only with off).
          const result = await setCloudConsent(token, next, next ? undefined : { purgeCloud: true });
          if (!sessionGuard.isCurrent(scope)) return false;
          scopedUpdate((current) => ({ ...current, cloudOrg: Boolean(result.cloudOrg) }));
          // Turning it on backfills existing local notes (deidentified text only).
          if (result.cloudOrg && data.entries.length > 0) backfillCloud(data.entries, token, scope);
          return Boolean(result.cloudOrg);
        } catch {
          return false;
        }
      },
      noteResponseKind: (kind) =>
        scopedUpdate((current) => ({
          ...current,
          recentResponseKinds: [...current.recentResponseKinds, kind].slice(-5),
        })),
      addEntry: (transcript, audioUri) => {
        const trimmed = transcript.trim();
        if (!trimmed) return null;
        const entry = annotateEntry(trimmed, new Date().toISOString(), uid(), audioUri);
        scopedUpdate((current) => ({ ...current, entries: [...current.entries, entry] }));
        if (scope) syncEntryToCloud(entry, scope);
        return entry;
      },
      setEventTime: (id, eventAt) => {
        scopedUpdate((current) => ({
          ...current,
          entries: current.entries.map((entry) => (entry.id === id ? { ...entry, eventAt } : entry)),
        }));
        // The server accepts eventAt updates: re-sync this note when cloud is on.
        const entry = data.entries.find((item) => item.id === id);
        if (entry && scope) syncEntryToCloud({ ...entry, eventAt }, scope);
      },
      deleteEntry: (id) => {
        const target = data.entries.find((entry) => entry.id === id);
        // Propagate the delete to the cloud copy, but only for entries known
        // to have synced. Failure is logged and never blocks the local delete.
        if (target?.synced && data.cloudOrg && data.deviceToken && scope && sessionGuard.isCurrent(scope)) {
          void deleteCloudEntry(data.deviceToken, id).catch((error) =>
            console.warn('[unfold] cloud delete failed for entry', id, error),
          );
        }
        scopedUpdate((current) => ({ ...current, entries: current.entries.filter((entry) => entry.id !== id) }));
      },
      enterDemo: async () => {
        if (demoLoadingRef.current) return false;
        if (sessionGuard.capture()?.isDemo) {
          setDemoError(null);
          return true;
        }
        if (isDemo && exitPendingRef.current) {
          const transition = ++transitionRef.current;
          const transitionIsCurrent = () => transitionRef.current === transition;
          exitPendingRef.current = false;
          sessionGuard.activate(true);
          setIsDemo(true);
          try {
            const active = await serializeStorage(async () => {
              if (!transitionIsCurrent()) return false;
              await AsyncStorage.setItem(FICTIONAL_DEMO_ACTIVE_KEY, '1');
              return transitionIsCurrent();
            });
            return active && transitionIsCurrent();
          } catch {
            if (transitionIsCurrent()) {
              exitPendingRef.current = false;
              setDemoError('Could not safely cancel demo exit because local storage is unavailable. Your fictional session remains active.');
            }
            return false;
          }
        }
        demoLoadingRef.current = true;
        const transition = ++transitionRef.current;
        const transitionIsCurrent = () => transitionRef.current === transition;
        setDemoLoading(true);
        setDemoError(null);
        try {
          const session = await getFictionalDemoSession();
          if (!transitionIsCurrent()) return false;
          const { messages } = await getCaseMessages(session.deviceToken, session.case.id);
          if (!transitionIsCurrent()) return false;
          const stored = await serializeStorage(() => AsyncStorage.getItem(FICTIONAL_DEMO_STORAGE_KEY));
          if (!transitionIsCurrent()) return false;
          const previous = stored ? sanitize(JSON.parse(stored)) : null;
          const next = buildFictionalDemoData(session, messages, previous);
          const activated = await serializeStorage(async () => {
            if (!transitionIsCurrent()) return false;
            await AsyncStorage.setItem(FICTIONAL_DEMO_STORAGE_KEY, JSON.stringify(next));
            if (!transitionIsCurrent()) return false;
            await AsyncStorage.setItem(FICTIONAL_DEMO_ACTIVE_KEY, '1');
            return transitionIsCurrent();
          });
          if (!activated || !transitionIsCurrent()) return false;
          sessionGuard.activate(true);
          setData(next);
          setIsDemo(true);
          return true;
        } catch {
          if (transitionIsCurrent()) {
            setDemoError('The local demo server is unavailable or demo mode is disabled. Run ./start-all.sh, then retry; your personal records were not changed.');
          }
          return false;
        } finally {
          if (transitionIsCurrent()) {
            demoLoadingRef.current = false;
            setDemoLoading(false);
          }
        }
      },
      exitDemo: async () => {
        const activeScope = sessionGuard.capture();
        if (!activeScope?.isDemo) return;
        const transition = ++transitionRef.current;
        const transitionIsCurrent = () => transitionRef.current === transition;
        exitPendingRef.current = true;
        sessionGuard.suspend();
        demoLoadingRef.current = false;
        setDemoLoading(false);
        setDemoError(null);
        try {
          const restoration = await serializeStorage(async () => {
            if (!transitionIsCurrent()) return { current: false as const };
            await AsyncStorage.removeItem(FICTIONAL_DEMO_ACTIVE_KEY);
            if (!transitionIsCurrent()) return { current: false as const };
            return { current: true as const, personalRaw: await AsyncStorage.getItem(PERSONAL_STORAGE_KEY) };
          });
          if (!transitionIsCurrent() || !restoration.current) return;
          exitPendingRef.current = false;
          sessionGuard.activate(false);
          setData(restoration.personalRaw ? sanitize(JSON.parse(restoration.personalRaw)) : EMPTY);
          setIsDemo(false);
        } catch {
          if (transitionIsCurrent()) {
            exitPendingRef.current = false;
            sessionGuard.activate(true);
            await serializeStorage(() => AsyncStorage.setItem(FICTIONAL_DEMO_ACTIVE_KEY, '1')).catch(() => undefined);
            if (transitionIsCurrent()) {
              setDemoError('Could not safely exit the demo because local storage is unavailable. Your fictional session remains active.');
            }
          }
        }
      },
      clearAll: () => {
        if (!scope || !sessionGuard.isCurrent(scope)) return;
        // "Delete everything" also deletes every cloud copy of this device's
        // entries. Failure is logged and never blocks the local wipe.
        if (data.cloudOrg && data.deviceToken) {
          void deleteCloudEntries(data.deviceToken).catch((error) =>
            console.warn('[unfold] cloud delete-all failed', error),
          );
        }
        scopedCommit({ ...EMPTY, onboarded: true });
      },
      dismissPrompt: () => scopedUpdate((current) => ({ ...current, snoozeUntilCount: current.entries.length + 2 })),
      prepareDraft: () => {
        let created: Draft | null = data.draft;
        scopedUpdate((current) => {
          if (current.entries.length === 0) return current;
          const draft = buildDraft(current.entries);
          created = draft;
          if (JSON.stringify(draft) === JSON.stringify(current.draft)) return current;
          return { ...current, draft };
        });
        return created;
      },
      updateDraft: (mainConcerns, recentChange) =>
        scopedUpdate((current) => {
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
        if (!scope || !sessionGuard.isCurrent(scope) || !data.draft) return null;
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
        if (!sessionGuard.isCurrent(scope)) return null;
        const item: CaseItem = {
          id,
          createdAt: new Date().toISOString(),
          status: 'queued',
          summary: draft,
          seenReply: true,
          remote,
        };
        scopedUpdate((current) => ({
          ...current,
          draft: null,
          cases: [...current.cases, item],
        }));
        return item;
      },
      refreshCaseFromServer: async () => {
        if (!scope || !sessionGuard.isCurrent(scope) || (!data.cloudOrg && !isDemo) || !data.deviceToken) return;
        const target = openCase;
        if (!target || !target.remote) return;
        try {
          const { case: active } = await getActiveCase(data.deviceToken);
          if (!sessionGuard.isCurrent(scope) || !active || active.id !== target.id) return;
          const { messages } = await getCaseMessages(data.deviceToken, active.id);
          if (!sessionGuard.isCurrent(scope)) return;
          scopedUpdate((current) => ({
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
        if (!scope || !sessionGuard.isCurrent(scope)) return;
        const target = data.cases.find((item) => item.id === id);
        if (target?.remote && data.deviceToken) {
          void transitionCase(data.deviceToken, id, 'withdraw').catch(() => undefined);
        }
        scopedUpdate((current) => ({
          ...current,
          snoozeUntilCount: current.entries.length + 2,
          cases: current.cases.map((item) => (item.id === id ? { ...item, status: 'withdrawn' } : item)),
        }));
      },
      rematchCase: (id) => {
        if (!scope || !sessionGuard.isCurrent(scope)) return;
        const target = data.cases.find((item) => item.id === id);
        if (target?.remote && data.deviceToken) {
          void transitionCase(data.deviceToken, id, 'rematch').catch(() => undefined);
        }
        scopedUpdate((current) => ({
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
        if (!scope || !sessionGuard.isCurrent(scope)) return;
        const target = data.cases.find((item) => item.id === id);
        if (target?.remote && data.deviceToken) {
          void transitionCase(data.deviceToken, id, 'continue').catch(() => undefined);
        }
        scopedUpdate((current) => ({
          ...current,
          cases: current.cases.map((item) => (item.id === id ? { ...item, status: 'continued', seenReply: true } : item)),
        }));
      },
      markReplySeen: (id) =>
        scopedUpdate((current) => ({
          ...current,
          cases: current.cases.map((item) => (item.id === id ? { ...item, seenReply: true } : item)),
        })),
      sendMessage: (caseId, from, text) => {
        if (!scope || !sessionGuard.isCurrent(scope)) return;
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
        scopedUpdate((current) => ({
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
  }, [data, ready, shouldPrompt, openCase, isDemo, demoLoading, demoError]);

  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const store = useContext(StoreContext);
  if (!store) throw new Error('useStore must be used within StoreProvider');
  return store;
}
