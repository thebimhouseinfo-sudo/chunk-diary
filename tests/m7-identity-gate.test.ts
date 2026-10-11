import assert from "node:assert/strict";
import test from "node:test";
import { isVerifiedAccountOwner } from "../src/components/account/identityGate.ts";

const a = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const b = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

test("M7 UI gate rejects missing, pending, anonymous and cross-account auth", () => {
  assert.equal(isVerifiedAccountOwner(a, null, "verified"), false);
  assert.equal(isVerifiedAccountOwner(a, { id: a, isAnonymous: false }, "checking"), false);
  assert.equal(isVerifiedAccountOwner(a, { id: a, isAnonymous: false }, "unverified"), false);
  assert.equal(isVerifiedAccountOwner(a, { id: a, isAnonymous: true }, "verified"), false);
  assert.equal(isVerifiedAccountOwner(a, { id: b, isAnonymous: false }, "verified"), false);
  assert.equal(isVerifiedAccountOwner(null, { id: a, isAnonymous: false }, "verified"), false);
  assert.equal(isVerifiedAccountOwner(a, { id: a.toUpperCase(), isAnonymous: false }, "verified"), true);
});

test("M7 UI gate is denied after verification failure/account switch", () => {
  const oldSession = { id: a, isAnonymous: false };
  assert.equal(isVerifiedAccountOwner(a, oldSession, "verified"), true);
  assert.equal(isVerifiedAccountOwner(a, oldSession, "unverified"), false);
  assert.equal(isVerifiedAccountOwner(b, oldSession, "verified"), false);
});
