      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction([...LEGACY_STORES], "readwrite");
        for (const name of LEGACY_STORES) {
          const key = name === "settings" ? "key" : "id";
          for (const row of rows[name]) tx.objectStore(name).delete(row[key] as IDBValidKey);
        }
        tx.objectStore("settings").clear();
        for (const oldSetting of priorSettings) tx.objectStore("settings").add(oldSetting);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      throw error;
    }
    for (const [key, value] of Object.entries(backup.snapshot.localSettings)) {
      localStorage.setItem(key, value);
    }
  } finally { db.close(); story.close(); }
  // Post-import verification is deliberately strict; caller shows success only after counts match.
  const verification = await previewLocalImportAfterWrite();
  const expected = LEGACY_STORES.reduce((sum, name) => sum + backup.counts[name], backup.storySessionCount);
  if (verification !== expected) throw new Error("Import count verification failed");
}

async function previewLocalImportAfterWrite(): Promise<number> {
  const db = await openDB();
  const story = await openStoryDb(indexedDB);
  try {
    return await countStores(db, LEGACY_STORES) + await countStores(story, ["sessions"]);
  } finally { db.close(); story.close(); }
}
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction([...LEGACY_STORES], "readwrite");
        for (const name of LEGACY_STORES) {
          tx.objectStore(name).clear();
          for (const row of originalRecords[name] ?? []) tx.objectStore(name).add(row);
        }
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      throw error;
    }
    for (const [key, value] of Object.entries(backup.snapshot.localSettings)) {
      localStorage.setItem(key, value);
    }
  } finally { db.close(); story.close(); }
  // Post-import verification is deliberately strict; caller shows success only after counts match.
  const verification = await previewLocalImportAfterWrite();
  const expected = LEGACY_STORES.reduce((sum, name) => sum + backup.counts[name], backup.storySessionCount);
  if (verification !== expected) throw new Error("Import count verification failed");
}

async function previewLocalImportAfterWrite(): Promise<number> {
  const db = await openDB();
  const story = await openStoryDb(indexedDB);
  try {
    return await countStores(db, LEGACY_STORES) + await countStores(story, ["sessions"]);
  } finally { db.close(); story.close(); }
}
