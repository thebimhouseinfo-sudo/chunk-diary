/**
 * M6: one explicitly selected owner per browser application session.
 *
 * No implicit guest adoption. Default is the existing beta v4 database.
 * An account workspace is activated ONLY after server-verified Supabase Auth
 * for that exact UUID and an explicit user click. Reload re-verifies identity.
 * Local storage holds ONLY a requested owner UUID, not an access token.
 */
import { workspaceDatabaseName, type WorkspaceOwner } from "./scopedWorkspace";

const PREF_KEY = "chunkdiary.activeWorkspaceAccount.v1";
const GUEST_PREF_KEY = "chunkdiary.activeWorkspaceGuest.v1";
let activeAccount: string | null = null;

export interface VerifiedWorkspaceUser {
  id: string;
  isAnonymous: boolean;
}
export type VerifyWorkspaceUser = () => Promise<VerifiedWorkspaceUser | null>;
const normalize = (value: string): string => {
  const name = workspaceDatabaseName({ kind: "account", userId: value });
  return name.slice("ChunkDiaryWorkspace-v1-account-".length);
};

export function activeWorkspaceOwner(): WorkspaceOwner | null {
  return activeAccount ? { kind: "account", userId: activeAccount } : null;
}

export function activeWorkspaceDatabaseName(): string {
  return activeAccount ? workspaceDatabaseName({ kind: "account", userId: activeAccount }) : "LanguageChunkDiaryDB";
}

/** Namespaced preferences only; NEVER copy previous user's localStorage. */
export function workspaceLocalKey(key: string): string {
  if (!activeAccount) return key; // exact legacy key while operating in beta mode
  return "chunkdiary.account." + activeAccount + "." + key;
}

export function resetWorkspaceRuntime(): void {
  activeAccount = null;
}

export async function initializeWorkspaceRouting(
  verifyUser: VerifyWorkspaceUser,
  storage: Pick<Storage, "getItem">,
  options: { offlineLocalAccess?: boolean } = {},
): Promise<WorkspaceOwner | null> {
  activeAccount = null; // fail closed while session verification is pending
  const chosenAccount = storage.getItem(PREF_KEY);
  const chosenGuest = storage.getItem(GUEST_PREF_KEY);
  const chosen = chosenAccount || chosenGuest;
  if (!chosen) return null;
  let canonical: string;
  try { canonical = normalize(chosen); }
  catch { return null; }
  try {
    const user = await verifyUser();
    // A Guest that linked Google/Apple retains its original User ID and local
    // workspace. A registered-account selection never silently becomes Guest.
    if (!user || (chosenAccount && user.isAnonymous) || normalize(user.id) !== canonical) {
      // Offline access is strictly local: cloud RPCs must verify fresh Auth and lease.
      if (options.offlineLocalAccess) {
        activeAccount = canonical;
        return { kind: "account", userId: canonical };
      }
      return null;
    }
    activeAccount = canonical;
    return { kind: "account", userId: canonical };
  } catch {
    // Offline mode may reopen only the previously selected local workspace.
    // Cloud API calls still require fresh server verification and active lease.
    if (options.offlineLocalAccess) {
      activeAccount = canonical;
      return { kind: "account", userId: canonical };
    }
    return null;
  }
}

/**
 * Mutates ONLY a preference and current runtime routing, not any data stores.
 * Callers MUST reload immediately after returning to unmount stale React views.
 */
export async function chooseAccountWorkspace(
  userId: string,
  verifyUser: VerifyWorkspaceUser,
  storage: Pick<Storage, "setItem">,
): Promise<WorkspaceOwner> {
  const canonical = normalize(userId);
  const verified = await verifyUser();
  if (!verified || verified.isAnonymous || normalize(verified.id) !== canonical) {
    throw new Error("Account ownership could not be verified");
  }
  storage.setItem(PREF_KEY, canonical);
  activeAccount = canonical;
  return { kind: "account", userId: canonical };
}

export async function chooseGuestWorkspace(
  userId: string,
  verifyUser: VerifyWorkspaceUser,
  storage: Pick<Storage, "setItem" | "removeItem">,
): Promise<WorkspaceOwner> {
  const canonical = normalize(userId);
  const verified = await verifyUser();
  if (!verified || !verified.isAnonymous || normalize(verified.id) !== canonical) {
    throw new Error("Guest ownership could not be verified");
  }
  // Guest shares UUID-scoped account storage, never the generic guest/beta DB.
  storage.removeItem(PREF_KEY);
  storage.setItem(GUEST_PREF_KEY, canonical);
  activeAccount = canonical;
  return { kind: "account", userId: canonical };
}

export function chooseLocalWorkspace(storage: Pick<Storage, "removeItem">): void {
  activeAccount = null;
  storage.removeItem(PREF_KEY);
  storage.removeItem(GUEST_PREF_KEY);
}

export function selectedWorkspaceUser(storage: Pick<Storage, "getItem">): string | null {
  const value = storage.getItem(PREF_KEY) || storage.getItem(GUEST_PREF_KEY);
  if (!value) return null;
  try { return normalize(value); } catch { return null; }
}

export const ACTIVE_WORKSPACE_KEY = PREF_KEY;
export const ACTIVE_GUEST_WORKSPACE_KEY = GUEST_PREF_KEY;

/** Remembered linked account could not be verified. The app must display
 * an explicit owner choice rather than silently opening beta Local data.
 */
export function requiresExplicitLocalChoice(storage: Pick<Storage, "getItem">): boolean {
  return selectedWorkspaceUser(storage) !== null && activeAccount === null;
}
