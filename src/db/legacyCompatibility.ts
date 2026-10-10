/**
 * M0: read-only compatibility contract for the *existing* beta IndexedDB v4.
 * This module never opens/writes/deletes IndexedDB, uploads data or assigns users.
 * The snapshot is an in-memory test/audit shape, not an automatic backup.
 */
export const LEGACY_DB_NAME = "LanguageChunkDiaryDB";
export const LEGACY_DB_VERSION = 4;
export const LEGACY_STORY_DB_NAME = "StoryChatDB";
export const LEGACY_STORY_DB_VERSION = 1;
export const LEGACY_STORES = [
  "diaries",
  "meaningUnits",
  "chunks",
  "semanticGroups",
  "settings",
  "englishChunks",
  "userProgress",
] as const;
export type LegacyStoreName = (typeof LEGACY_STORES)[number];

export const LEGACY_LOCAL_SETTINGS_KEYS = [
  "user_settings",
  "story_chat_settings",
  "story_chat_has_seen_first_greeting",
] as const;

export type LegacyRecord = Record<string, unknown>;
export type LegacySnapshot = {
  source: {
    dbName: string;
    dbVersion: number;
    storyDbName: string;
    storyDbVersion: number;
  };
  stores: Record<LegacyStoreName, LegacyRecord[]>;
  storySessions: LegacyRecord[];
  localSettings: Record<string, string>;
};

export type LegacyIssue = {
  severity: "error" | "warning";
  code:
    | "INVALID_SNAPSHOT"
    | "SCHEMA_MISMATCH"
    | "STORE_MISSING"
    | "INVALID_RECORD"
    | "MISSING_ID"
    | "DUPLICATE_ID"
    | "DANGLING_DIARY"
    | "DANGLING_MEANING_UNIT"
    | "DANGLING_SEMANTIC_GROUP";
  store?: string;
  id?: string;
};

export type LegacyInspection = {
  compatibleShape: boolean;
  counts: Record<LegacyStoreName, number>;
  storySessionCount: number;
  practice: { totalReviews: number; timesPracticed: number };
  issues: LegacyIssue[];
};

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export function inspectLegacySnapshot(snapshot: unknown): LegacyInspection {
  const counts = Object.fromEntries(LEGACY_STORES.map((store) => [store, 0])) as Record<LegacyStoreName, number>;
  const issues: LegacyIssue[] = [];
  const report = (issue: LegacyIssue) => issues.push(issue);
  const result = (storySessionCount = 0, totalReviews = 0, timesPracticed = 0): LegacyInspection => ({
    compatibleShape: !issues.some((issue) => issue.severity === "error"),
    counts,
    storySessionCount,
    practice: { totalReviews, timesPracticed },
    issues,
  });

  if (!isObject(snapshot) || !isObject(snapshot.source) || !isObject(snapshot.stores)) {
    report({ severity: "error", code: "INVALID_SNAPSHOT" });
    return result();
  }

  if (
    snapshot.source.dbName !== LEGACY_DB_NAME ||
    snapshot.source.dbVersion !== LEGACY_DB_VERSION ||
    snapshot.source.storyDbName !== LEGACY_STORY_DB_NAME ||
    snapshot.source.storyDbVersion !== LEGACY_STORY_DB_VERSION
  ) {
    report({ severity: "error", code: "SCHEMA_MISMATCH" });
  }

  const rows: Partial<Record<LegacyStoreName, LegacyRecord[]>> = {};
  for (const store of LEGACY_STORES) {
    const values = snapshot.stores[store];
    if (!Array.isArray(values)) {
      report({ severity: "error", code: "STORE_MISSING", store });
      continue;
    }
    const valid: LegacyRecord[] = [];
    const ids = new Set<string>();
    const key = store === "settings" ? "key" : "id";
    for (const record of values) {
      if (!isObject(record)) {
        report({ severity: "error", code: "INVALID_RECORD", store });
        continue;
      }
      valid.push(record);
      const id = record[key];
      if (typeof id !== "string" || !id) {
        report({ severity: "error", code: "MISSING_ID", store });
      } else if (ids.has(id)) {
        report({ severity: "error", code: "DUPLICATE_ID", store, id });
      } else {
        ids.add(id);
      }
    }
    counts[store] = valid.length;
    rows[store] = valid;
  }

  const sessions = Array.isArray(snapshot.storySessions) ? snapshot.storySessions : null;
  if (!sessions || !isObject(snapshot.localSettings)) {
    report({ severity: "error", code: "INVALID_SNAPSHOT" });
  }
  if (sessions) {
    const sessionIds = new Set<string>();
    for (const session of sessions) {
      if (!isObject(session)) {
        report({ severity: "error", code: "INVALID_RECORD", store: "sessions" });
      } else if (typeof session.id !== "string" || !session.id) {
        report({ severity: "error", code: "MISSING_ID", store: "sessions" });
      } else if (sessionIds.has(session.id)) {
        report({ severity: "error", code: "DUPLICATE_ID", store: "sessions", id: session.id });
      } else {
        sessionIds.add(session.id);
      }
    }
  }

  const diaryIds = new Set((rows.diaries ?? []).map((d) => d.id));
  const unitIds = new Set((rows.meaningUnits ?? []).map((d) => d.id));
  const groupIds = new Set((rows.semanticGroups ?? []).map((d) => d.id));
  for (const unit of rows.meaningUnits ?? []) {
    if (typeof unit.diaryId === "string" && !diaryIds.has(unit.diaryId)) {
      report({ severity: "warning", code: "DANGLING_DIARY", store: "meaningUnits", id: String(unit.id ?? "") });
    }
  }
  for (const chunk of rows.chunks ?? []) {
    const id = String(chunk.id ?? "");
    if (typeof chunk.meaningUnitId === "string" && !unitIds.has(chunk.meaningUnitId)) {
      report({ severity: "warning", code: "DANGLING_MEANING_UNIT", store: "chunks", id });
    }
    // Beta's welcome seed references a semantic-group ID without a stored group.
    // Keep it as a warning, never drop or rewrite the chunk.
    if (typeof chunk.semanticGroupId === "string" && chunk.semanticGroupId && !groupIds.has(chunk.semanticGroupId)) {
      report({ severity: "warning", code: "DANGLING_SEMANTIC_GROUP", store: "chunks", id });
    }
  }

  const sumField = (key: "totalReviews" | "timesPracticed") =>
    (rows.chunks ?? []).reduce((sum, chunk) => sum + (typeof chunk[key] === "number" && Number.isFinite(chunk[key]) ? (chunk[key] as number) : 0), 0);
  return result(sessions?.length ?? 0, sumField("totalReviews"), sumField("timesPracticed"));
}

/** Canonical, read-only digest for before/after comparisons of test/consented snapshots. */
export async function fingerprintLegacySnapshot(snapshot: LegacySnapshot): Promise<string> {
  const sortObjectKeys = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(sortObjectKeys);
    if (!isObject(value)) return value;
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortObjectKeys(value[key])]));
  };
  const canonical = {
    ...snapshot,
    stores: Object.fromEntries(LEGACY_STORES.map((store) => [
      store,
      [...snapshot.stores[store]].sort((a, b) => String(a.id ?? a.key).localeCompare(String(b.id ?? b.key))),
    ])),
    storySessions: [...snapshot.storySessions].sort((a, b) => String(a.id).localeCompare(String(b.id))),
  };
  const data = new TextEncoder().encode(JSON.stringify(sortObjectKeys(canonical)));
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
