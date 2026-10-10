import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, readdirSync } from "node:fs";

const dir = "supabase/migrations";
const applied = [
  ["20261010113631", "chunkdiary_dev_cloud_sync_owner_scoped"],
  ["20261010113727", "chunkdiary_dev_ai_quota_disabled"],
  ["20261010113946", "chunkdiary_dev_quota_edge_only"],
  ["20261010142026", "chunkdiary_dev_snapshot_cas_owner_guard"],
  ["20261010142312", "chunkdiary_dev_linked_only_cloud_rls"],
  ["20261010142447", "chunkdiary_dev_cas_deny_anonymous_identity"],
  ["20261010191845", "chunkdiary_dev_private_snapshot_cas"],
] as const;
const sql = ([version,name]:readonly [string,string]) =>
  readFileSync(dir + "/" + version + "_" + name + ".sql", "utf8");

test("M6: all known staging migration versions match the repository ledger", () => {
  const files = readdirSync(dir).filter(name => name.endsWith(".sql"));
  for(const [version,name] of applied) {
    assert.ok(files.includes(version + "_" + name + ".sql"));
    assert.equal(files.filter(file => file.startsWith(version + "_")).length,1,
      "Version collision in dev migration history: " + version);
    assert.ok(sql([version,name]).length > 500);
  }
  const versions=applied.map(row=>row[0]);
  assert.deepEqual([...versions].sort(),versions);
});

test("M6: RLS, owner keys, server-only quota and invoker CAS regressions",()=>{
  const owner=sql(applied[0]), quota=sql(applied[2]),
        rls=sql(applied[4]), security=sql(applied[6]);
  assert.match(owner,/primary key\s*\(user_id,\s*id\)/i);
  for(const table of ["user_settings","user_progress","sync_snapshots","generated_chunk_corpus"]){
    assert.match(owner,new RegExp("alter table public\\." + table + " enable row level security","i"));
  }
  assert.match(rls,/is_anonymous/);
  assert.match(quota,/to service_role/i);
  assert.match(quota,/revoke all on function public\.chunkdiary_ai_quota_claim/i);
  assert.match(security,/chunkdiary_private\.snapshot_cas_write_internal/);
  assert.match(security,/public\.chunkdiary_snapshot_cas_write/);
  assert.match(security,/security invoker/i);
  assert.match(security,/security definer/i);
  assert.match(security,/revoke insert,\s*update on public\.sync_snapshots from authenticated/i);
  assert.match(security,/is_anonymous/);
});
