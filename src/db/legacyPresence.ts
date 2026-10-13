/**
 * Non-destructive legacy-origin guard for first-run Guest bootstrap.
 *
 * We must NOT activate a new empty Guest workspace over a browser that already
 * holds beta learning data, even if only a welcome diary is present.
 * Opening an absent IndexedDB database invokes onupgradeneeded; abort that
 * transaction so the probe does not create or modify legacy storage.
 *
 * Unknown errors fail closed (treat the old store as potentially present).
 */
export async function hasExistingLegacyWorkspace(
  factory: IDBFactory = indexedDB,
): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false;
    let newlyCreated = false;
    const finish = (exists: boolean) => {
      if (settled) return;
      settled = true;
      resolve(exists);
    };
    let request: IDBOpenDBRequest;
    try {
      request = factory.open("LanguageChunkDiaryDB");
    } catch {
      finish(true);
      return;
    }
    request.onupgradeneeded = () => {
      newlyCreated = true;
      request.transaction?.abort();
    };
    request.onsuccess = () => {
      request.result.close();
      finish(!newlyCreated);
    };
    request.onerror = () => finish(!newlyCreated);
    request.onblocked = () => finish(true);
  });
}
