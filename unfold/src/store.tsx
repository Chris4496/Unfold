import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { buildSampleEntries } from './lib/samples';
import { annotateEntry, buildDraft, shouldOfferSupport } from './lib/organise';
import { uid } from './lib/text';
import type { CaseItem, Draft, Entry, Message, Persisted } from './types';

const KEY = 'unfold.v1';

const EMPTY: Persisted = {
  onboarded: false,
  entries: [],
  cases: [],
  messages: [],
  snoozeUntilCount: 0,
  draft: null,
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
  };
}

type Store = Persisted & {
  ready: boolean;
  shouldPrompt: boolean;
  openCase: CaseItem | null;
  completeOnboarding: () => void;
  addEntry: (transcript: string, audioUri?: string) => Entry | null;
  setEventTime: (id: string, eventAt: string) => void;
  deleteEntry: (id: string) => void;
  loadSamples: () => void;
  clearAll: () => void;
  dismissPrompt: () => void;
  prepareDraft: () => Draft | null;
  updateDraft: (mainConcerns: string, recentChange: string) => void;
  approveSharing: () => CaseItem | null;
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

  const shouldPrompt =
    shouldOfferSupport(data.entries) && data.entries.length >= data.snoozeUntilCount && openCase == null;

  const store = useMemo<Store>(() => {
    return {
      ...data,
      ready,
      shouldPrompt,
      openCase,
      completeOnboarding: () => update((current) => ({ ...current, onboarded: true })),
      addEntry: (transcript, audioUri) => {
        const trimmed = transcript.trim();
        if (!trimmed) return null;
        const entry = annotateEntry(trimmed, new Date().toISOString(), uid(), audioUri);
        update((current) => ({ ...current, entries: [...current.entries, entry] }));
        return entry;
      },
      setEventTime: (id, eventAt) =>
        update((current) => ({
          ...current,
          entries: current.entries.map((entry) => (entry.id === id ? { ...entry, eventAt } : entry)),
        })),
      deleteEntry: (id) =>
        update((current) => ({ ...current, entries: current.entries.filter((entry) => entry.id !== id) })),
      loadSamples: () => {
        const samples = buildSampleEntries();
        update((current) => ({
          ...current,
          entries: [...current.entries.filter((entry) => !entry.id.startsWith('sample-')), ...samples],
          snoozeUntilCount: 0,
        }));
      },
      clearAll: () => commit({ ...EMPTY, onboarded: true }),
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
      approveSharing: () => {
        if (!data.draft) return null;
        const item: CaseItem = {
          id: uid(),
          createdAt: new Date().toISOString(),
          status: 'queued',
          summary: data.draft,
          seenReply: true,
        };
        update((current) => ({
          ...current,
          draft: null,
          cases: [...current.cases, item],
        }));
        return item;
      },
      withdrawCase: (id) =>
        update((current) => ({
          ...current,
          snoozeUntilCount: current.entries.length + 2,
          cases: current.cases.map((item) => (item.id === id ? { ...item, status: 'withdrawn' } : item)),
        })),
      rematchCase: (id) =>
        update((current) => ({
          ...current,
          cases: current.cases.map((item) => (item.id === id ? { ...item, status: 'rematch', seenReply: true } : item)),
        })),
      continueCase: (id) =>
        update((current) => ({
          ...current,
          cases: current.cases.map((item) => (item.id === id ? { ...item, status: 'continued', seenReply: true } : item)),
        })),
      markReplySeen: (id) =>
        update((current) => ({
          ...current,
          cases: current.cases.map((item) => (item.id === id ? { ...item, seenReply: true } : item)),
        })),
      sendMessage: (caseId, from, text) => {
        const trimmed = text.trim();
        if (!trimmed) return;
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
