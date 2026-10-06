import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PERSONAL_STORAGE_KEY, FICTIONAL_DEMO_STORAGE_KEY } from './fictionalDemo';
import { runIfSessionCurrent, SessionScopeGuard } from './sessionScope';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

test('late personal cloud callback cannot update or persist over the active fictional session', async () => {
  const guard = new SessionScopeGuard();
  const personalScope = guard.capture()!;
  const response = deferred<string>();
  let state = 'personal';
  const writes: string[] = [];
  const pending = response.promise.then((value) =>
    runIfSessionCurrent(guard, personalScope, () => {
      state = value;
      writes.push(personalScope.storageKey);
    }),
  );

  guard.activate(true);
  state = 'fictional';
  response.resolve('stale personal sync result');
  const result = await pending;

  assert.equal(result.applied, false);
  assert.equal(state, 'fictional');
  assert.deepEqual(writes, []);
  assert.equal(personalScope.storageKey, PERSONAL_STORAGE_KEY);
});

test('late fictional case refresh cannot update or persist after exit restores personal state', async () => {
  const guard = new SessionScopeGuard();
  const demoScope = guard.activate(true);
  const response = deferred<string>();
  let state = 'fictional messages';
  const writes: string[] = [];
  const pending = response.promise.then((messages) =>
    runIfSessionCurrent(guard, demoScope, () => {
      state = messages;
      writes.push(demoScope.storageKey);
    }),
  );

  guard.suspend();
  guard.activate(false);
  state = 'restored personal messages';
  response.resolve('stale fictional refresh');
  const result = await pending;

  assert.equal(result.applied, false);
  assert.equal(state, 'restored personal messages');
  assert.deepEqual(writes, []);
  assert.equal(demoScope.storageKey, FICTIONAL_DEMO_STORAGE_KEY);
});

test('current session callback updates only its own storage scope', () => {
  const guard = new SessionScopeGuard();
  const scope = guard.activate(true);
  let persistedTo = '';
  const result = runIfSessionCurrent(guard, scope, () => { persistedTo = scope.storageKey; });
  assert.equal(result.applied, true);
  assert.equal(persistedTo, FICTIONAL_DEMO_STORAGE_KEY);
});
