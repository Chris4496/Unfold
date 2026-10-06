import type { CaseMessage, FictionalDemoSession } from '../api';
import { annotateEntry } from './organise';
import type { CaseItem, Message, Persisted } from '../types';

export const PERSONAL_STORAGE_KEY = 'unfold.v1';
export const FICTIONAL_DEMO_STORAGE_KEY = 'unfold.fictional-demo.v1';
export const FICTIONAL_DEMO_ACTIVE_KEY = 'unfold.fictional-demo.active';

export function persistedStorageKey(isDemo: boolean): string {
  return isDemo ? FICTIONAL_DEMO_STORAGE_KEY : PERSONAL_STORAGE_KEY;
}

export function buildFictionalDemoData(
  session: FictionalDemoSession,
  remoteMessages: CaseMessage[],
  previous: Persisted | null,
): Persisted {
  const previousCase = previous?.cases.find((item) => item.id === session.case.id);
  const item: CaseItem = {
    ...session.case,
    seenReply: previousCase?.seenReply ?? true,
    remote: true,
    claimCount: session.case.claimCount,
    waitingNoWorker: false,
  };
  const messages: Message[] = remoteMessages.map((message) => ({
    id: message.id,
    caseId: session.case.id,
    from: message.sender,
    text: message.text,
    createdAt: message.createdAt,
    ...(message.workerName ? { workerName: message.workerName } : {}),
  }));

  return {
    onboarded: true,
    entries: previous?.entries ?? session.entries.map((entry) => ({
      ...annotateEntry(entry.transcript, entry.createdAt, entry.id),
      ...(entry.eventAt !== entry.createdAt ? { eventAt: entry.eventAt } : {}),
    })),
    cases: [...(previous?.cases ?? []).filter((existing) => existing.id !== item.id), item],
    messages: [...(previous?.messages ?? []).filter((message) => message.caseId !== item.id), ...messages],
    snoozeUntilCount: previous?.snoozeUntilCount ?? 0,
    draft: previous?.draft ?? null,
    deviceToken: session.deviceToken,
    installId: 'fictional-maya-demo-only',
    cloudOrg: false,
    recentResponseKinds: previous?.recentResponseKinds ?? [],
  };
}
