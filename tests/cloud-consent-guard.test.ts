import assert from "node:assert/strict";
import test from "node:test";
import { cloudSync } from "../src/services/storage/cloudSyncAdapter.ts";

test("M1 privacy: cloud sync adapter fails closed without explicit consent flow", async () => {
  const existingFetch = globalThis.fetch;
  let transmitted = 0;
  globalThis.fetch = (async () => {
    transmitted += 1;
    throw new Error("Unexpected network call from cloud adapter");
  }) as typeof fetch;
  try {
    assert.equal(await cloudSync.syncUserProfile({
      nickname: "Synthetic", nativeLanguage: "Vietnamese",
      learningLanguages: ["English"], learningPurpose: "hobby",
      onboarded: true,
    }), false);
    assert.equal(await cloudSync.syncUserProgress(), false);
    assert.equal(await cloudSync.syncGeneratedChunks?.([]), false);
    assert.equal(await cloudSync.downloadPurchasedPackage("user-progress"), null);
    assert.equal(transmitted, 0, "profile/progress/corpus cannot be uploaded without consent");
  } finally {
    globalThis.fetch = existingFetch;
  }
});
