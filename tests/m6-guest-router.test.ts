import test from "node:test";
import assert from "node:assert/strict";
import {
  chooseGuestWorkspace, chooseAccountWorkspace, chooseLocalWorkspace,
  initializeWorkspaceRouting, resetWorkspaceRuntime,
  activeWorkspaceOwner, selectedWorkspaceUser, requiresExplicitLocalChoice,
} from "../src/db/workspaceRouter";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";

function store() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => { m.set(k, v); },
    removeItem: (k: string) => { m.delete(k); },
    value: (k: string) => m.get(k),
  };
}
const anonymous = (id = A) => async () => ({ id, isAnonymous: true });
const linked = (id = A) => async () => ({ id, isAnonymous: false });

test("Guest workspace is UUID-scoped and cannot silently adopt beta", async () => {
  resetWorkspaceRuntime();
  const storage = store();
  assert.equal(activeWorkspaceOwner(), null);
  await chooseGuestWorkspace(A, anonymous(), storage);
  assert.deepEqual(activeWorkspaceOwner(), { kind: "account", userId: A });
  assert.equal(selectedWorkspaceUser(storage), A);
  assert.equal(storage.value("chunkdiary.activeWorkspaceGuest.v1"), A);
  resetWorkspaceRuntime();
  await initializeWorkspaceRouting(anonymous(), storage);
  assert.deepEqual(activeWorkspaceOwner(), { kind: "account", userId: A });
  chooseLocalWorkspace(storage);
  assert.equal(activeWorkspaceOwner(), null);
  assert.equal(selectedWorkspaceUser(storage), null);
});

test("Guest cannot activate someone else's ID or use a linked identity", async () => {
  resetWorkspaceRuntime();
  const storage = store();
  await assert.rejects(chooseGuestWorkspace(A, anonymous(B), storage), /Guest ownership/);
  await assert.rejects(chooseGuestWorkspace(A, linked(), storage), /Guest ownership/);
  assert.equal(selectedWorkspaceUser(storage), null);
  assert.equal(activeWorkspaceOwner(), null);
});

test("Remembered Guest owner mismatch fails closed without local beta fallback", async () => {
  resetWorkspaceRuntime();
  const storage = store();
  await chooseGuestWorkspace(A, anonymous(), storage);
  resetWorkspaceRuntime();
  assert.equal(await initializeWorkspaceRouting(anonymous(B), storage), null);
  assert.equal(requiresExplicitLocalChoice(storage), true);
  assert.equal(activeWorkspaceOwner(), null);
});

test("Linking an existing Guest preserves local UUID, but account selection rejects anonymous", async () => {
  resetWorkspaceRuntime();
  const storage = store();
  await chooseGuestWorkspace(A, anonymous(), storage);
  resetWorkspaceRuntime();
  assert.deepEqual(await initializeWorkspaceRouting(linked(), storage), { kind: "account", userId: A });
  await assert.rejects(chooseAccountWorkspace(B, anonymous(B), storage), /Account ownership/);
  assert.deepEqual(activeWorkspaceOwner(), { kind: "account", userId: A });
  chooseLocalWorkspace(storage);
  await chooseAccountWorkspace(B, linked(B), storage);
  resetWorkspaceRuntime();
  assert.equal(await initializeWorkspaceRouting(anonymous(B), storage), null);
  assert.equal(requiresExplicitLocalChoice(storage), true);
});

test("Offline reload preserves only the selected cached workspace, never beta", async () => {
  resetWorkspaceRuntime();
  const storage = store();
  await chooseGuestWorkspace(A, anonymous(), storage);
  resetWorkspaceRuntime();
  const offlineOwner = await initializeWorkspaceRouting(
    async () => { throw new Error("network offline"); },
    storage, { offlineLocalAccess: true },
  );
  assert.deepEqual(offlineOwner, { kind: "account", userId: A });
  assert.equal(requiresExplicitLocalChoice(storage), false);
  resetWorkspaceRuntime();
  const onlineMismatch = await initializeWorkspaceRouting(anonymous(B), storage);
  assert.equal(onlineMismatch, null);
  assert.equal(requiresExplicitLocalChoice(storage), true);
  chooseLocalWorkspace(storage);
  const none = await initializeWorkspaceRouting(async () => null, storage, { offlineLocalAccess: true });
  assert.equal(none, null);
  assert.equal(activeWorkspaceOwner(), null);
});
