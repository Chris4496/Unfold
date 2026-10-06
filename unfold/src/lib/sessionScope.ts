import {
  FICTIONAL_DEMO_STORAGE_KEY,
  PERSONAL_STORAGE_KEY,
} from './fictionalDemo';

export type SessionScope = Readonly<{
  revision: number;
  isDemo: boolean;
  storageKey: string;
}>;

/** Identifies which persisted store an asynchronous callback is still allowed to update. */
export class SessionScopeGuard {
  private revision = 0;
  private scope: SessionScope | null = {
    revision: 0,
    isDemo: false,
    storageKey: PERSONAL_STORAGE_KEY,
  };

  capture(): SessionScope | null {
    return this.scope;
  }

  isCurrent(scope: SessionScope): boolean {
    return this.scope?.revision === scope.revision;
  }

  activate(isDemo: boolean): SessionScope {
    this.revision += 1;
    this.scope = {
      revision: this.revision,
      isDemo,
      storageKey: isDemo ? FICTIONAL_DEMO_STORAGE_KEY : PERSONAL_STORAGE_KEY,
    };
    return this.scope;
  }

  suspend(): void {
    this.revision += 1;
    this.scope = null;
  }
}

export function runIfSessionCurrent<T>(
  guard: SessionScopeGuard,
  scope: SessionScope,
  operation: () => T,
): { applied: true; value: T } | { applied: false } {
  if (!guard.isCurrent(scope)) return { applied: false };
  return { applied: true, value: operation() };
}
