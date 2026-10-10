import assert from "node:assert/strict";
import test from "node:test";
import { IDBFactory as FakeIDBFactory } from "fake-indexeddb";
import {
  activeWorkspaceOwner, activeWorkspaceDatabaseName, chooseAccountWorkspace,
  chooseLocalWorkspace, initializeWorkspaceRouting, resetWorkspaceRuntime,
  selectedWorkspaceUser, workspaceLocalKey,
} from "../src/db/workspaceRouter.ts";
import { openDB, getDiaries, saveDiary, getChunks, saveChunk } from "../src/db/indexedDb.ts";
import { getSettings, saveSettings } from "../src/db/userDb.ts";
import { getActiveSession, saveSession } from "../src/components/story_chat/db/storySessionDb.ts";

const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
function localStorageStub() {
  const m = new Map<string,string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => { m.set(k,v); },
    removeItem: (k: string) => { m.delete(k); },
  };
}
const verifier = (id: string, isAnonymous = false) =>
  async () => ({ id, isAnonymous });

test("M6: local beta default; accounts A and B never share identical record IDs or StoryChat", async () => {
  (globalThis as {indexedDB: IDBFactory}).indexedDB = new FakeIDBFactory() as unknown as IDBFactory;
  const storage = localStorageStub();
  resetWorkspaceRuntime();

  let verified = 0;
  assert.equal(await initializeWorkspaceRouting(async () => { verified++; return null; },storage), null);
  assert.equal(verified, 0, "No account preference must not silently sign in");
  assert.equal(activeWorkspaceDatabaseName(), "LanguageChunkDiaryDB");
  const baseline = { id: "same-id", createdAt: new Date().toISOString(), nativeText: "LOCAL BETA" };
  await saveDiary(baseline as never);
  assert.equal((await getDiaries()).length, 1);

  await assert.rejects(chooseAccountWorkspace(A, verifier(B), storage), /ownership/);
  assert.equal(selectedWorkspaceUser(storage), null);
  await assert.rejects(chooseAccountWorkspace(A, verifier(A,true), storage), /ownership/);

  await chooseAccountWorkspace(A, verifier(A), storage);
  assert.equal(activeWorkspaceOwner()?.kind, "account");
  assert.equal(activeWorkspaceOwner()?.userId, A);
  assert.match(activeWorkspaceDatabaseName(), /account-aaaaaaaa/);
  assert.equal((await getDiaries()).length, 0, "Account A must not read beta");
  await saveDiary({ ...baseline, nativeText:"ACCOUNT A" } as never);
  await saveChunk({ id:"same-chunk", text:"A", meaning:"owner A" } as never);
  await saveSettings({ nickname:"Owner A", nativeLanguage:"English",
    learningLanguages:["Japanese"], learningPurpose:"hobby", onboarded:true });
  await saveSession({ id:"active", messages:[{content:"A"}] } as never);
  assert.equal(workspaceLocalKey("story_chat_settings").includes(A),true);

  await chooseAccountWorkspace(B, verifier(B), storage);
  assert.equal((await getDiaries()).length, 0, "Account B must not see A diaries");
  assert.equal((await getChunks()).length, 0, "Account B must not see A chunks");
  assert.equal(await getSettings(), null, "Account B must not see A settings");
  assert.equal(await getActiveSession(), null, "Account B must not see A StoryChat");
  await saveDiary({ ...baseline, nativeText:"ACCOUNT B" } as never);
  await saveChunk({ id:"same-chunk", text:"B", meaning:"owner B" } as never);
  await saveSession({ id:"active", messages:[{content:"B"}] } as never);

  // Returning to A must expose only A's own stores even with the SAME IDs.
  await chooseAccountWorkspace(A, verifier(A), storage);
  assert.equal((await getDiaries())[0]?.nativeText, "ACCOUNT A");
  assert.equal((await getChunks())[0]?.meaning, "owner A");
  assert.equal((await getSettings())?.nickname, "Owner A");
  assert.equal((await getActiveSession() as any)?.messages?.[0]?.content,"A");
  assert.equal(workspaceLocalKey("story_chat_settings").includes(B), false);

  chooseLocalWorkspace(storage);
  assert.equal(activeWorkspaceOwner(),null);
  assert.equal(activeWorkspaceDatabaseName(),"LanguageChunkDiaryDB");
  assert.equal((await getDiaries())[0]?.nativeText, "LOCAL BETA");
  assert.equal((await getChunks()).length,0);
  assert.equal(selectedWorkspaceUser(storage),null);
});

test("M6 negative controls: stale/anonymous/mismatched Auth never reopens private account", async () => {
  const storage = localStorageStub();
  resetWorkspaceRuntime();
  await chooseAccountWorkspace(A, verifier(A), storage);
  resetWorkspaceRuntime(); // simulate browser reload
  assert.equal(await initializeWorkspaceRouting(verifier(B), storage), null, "wrong JWT must fail closed");
  assert.equal(activeWorkspaceDatabaseName(), "LanguageChunkDiaryDB");
  assert.equal(await initializeWorkspaceRouting(verifier(A,true), storage), null, "anonymous cannot reopen linked owner");
  assert.equal(await initializeWorkspaceRouting(async () => { throw new Error("network failure"); },storage),null);
  assert.deepEqual(await initializeWorkspaceRouting(verifier(A),storage),{kind:"account",userId:A});
});

test("M6 negative controls: arbitrary account string and cross-user preference are rejected", async () => {
  const s=localStorageStub();
  resetWorkspaceRuntime();
  await assert.rejects(chooseAccountWorkspace("../../evil", verifier(A),s),/UUID/);
  assert.equal(selectedWorkspaceUser(s),null);
  s.setItem("chunkdiary.activeWorkspaceAccount.v1","garbage");
  assert.equal(await initializeWorkspaceRouting(verifier(A),s),null);
  assert.equal(activeWorkspaceOwner(),null);
  s.removeItem("chunkdiary.activeWorkspaceAccount.v1");
  assert.equal(workspaceLocalKey("story_chat_settings"),"story_chat_settings");
  await chooseAccountWorkspace(A,verifier(A),s);
  assert.notEqual(workspaceLocalKey("story_chat_settings"),"story_chat_settings");
});
