import { EnglishChunk } from "../types";
import { openDB } from "./indexedDb";

const STORE_NAME = "englishChunks";

/**
 * Normalizes English text for reliable deduplication comparison.
 */
export function normalizeEnglishText(text: string): string {
  return text.trim().toLowerCase().replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, "").replace(/\s+/g, " ");
}

/**
 * Retrieves all English Chunks stored in the central bank.
 */
export async function getAllEnglishChunks(): Promise<EnglishChunk[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result as EnglishChunk[]);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Searches for an existing duplicate English Chunk by normalized text.
 */
export async function findDuplicateEnglishChunk(text: string): Promise<EnglishChunk | null> {
  const all = await getAllEnglishChunks();
  const targetNormalized = normalizeEnglishText(text);
  const found = all.find(c => normalizeEnglishText(c.text) === targetNormalized);
  return found || null;
}

/**
 * Saves or updates a single English Chunk in the central bank.
 */
export async function saveEnglishChunk(chunk: EnglishChunk): Promise<string> {
  const db = await openDB();
  if (!chunk.id) chunk.id = crypto.randomUUID();
  if (!chunk.createdAt) chunk.createdAt = new Date().toISOString();
  chunk.updatedAt = new Date().toISOString();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const request = store.put(chunk);
    request.onsuccess = () => resolve(chunk.id);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Saves multiple English Chunks in a single transaction.
 */
export async function saveEnglishChunks(chunks: EnglishChunk[]): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    chunks.forEach(c => {
      if (!c.id) c.id = crypto.randomUUID();
      if (!c.createdAt) c.createdAt = new Date().toISOString();
      c.updatedAt = new Date().toISOString();
      store.put(c);
    });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Retrieves all English Chunks belonging to a specific specialty domain (e.g., "Công nghệ thông tin").
 */
export async function getEnglishChunksBySpecialty(specialty: string): Promise<EnglishChunk[]> {
  const all = await getAllEnglishChunks();
  return all.filter(c => c.specialty === specialty);
}

/**
 * SINGLE RESPONSIBILITY MERGE ENGINE:
 * Takes datasets from multiple sources (e.g. Dev A + Dev B dataset),
 * performs smart deduplication based on normalized English text,
 * tags with commercial package metadata, and outputs a clean merged package.
 */
export async function mergeAndPackageData(
  datasetA: EnglishChunk[],
  datasetB: EnglishChunk[],
  packageMetadata: {
    packageId: string;
    specialty: string;
    subSpecialty?: string;
  }
): Promise<{ mergedPackage: EnglishChunk[]; duplicatesRemoved: number }> {
  const seenTexts = new Set<string>();
  const mergedPackage: EnglishChunk[] = [];
  let duplicatesRemoved = 0;

  const combined = [...datasetA, ...datasetB];

  for (const item of combined) {
    const norm = normalizeEnglishText(item.text);
    if (seenTexts.has(norm)) {
      duplicatesRemoved++;
      continue;
    }
    seenTexts.add(norm);

    const packagedItem: EnglishChunk = {
      ...item,
      id: crypto.randomUUID(),
      packageId: packageMetadata.packageId,
      specialty: packageMetadata.specialty || item.specialty,
      subSpecialty: packageMetadata.subSpecialty || item.subSpecialty,
      updatedAt: new Date().toISOString()
    };

    mergedPackage.push(packagedItem);
  }

  // Persist the merged package to local central bank
  await saveEnglishChunks(mergedPackage);

  return { mergedPackage, duplicatesRemoved };
}
