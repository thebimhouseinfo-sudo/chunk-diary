/** UI gate only. Storage/RLS services must independently revalidate linked Auth. */
export interface LinkedIdentity { id: string; isAnonymous: boolean }
export function isVerifiedAccountOwner(ownerUserId: string | null, identity: LinkedIdentity | null, check: "checking" | "verified" | "unverified"): boolean {
  return check === "verified" && Boolean(ownerUserId && identity && !identity.isAnonymous &&
    identity.id.toLowerCase() === ownerUserId.toLowerCase());
}
