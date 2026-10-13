import type { SupabaseClient } from "@supabase/supabase-js";

/** Server-signed Auth session_id is the lease identity. No device fingerprint. */
export type ActiveLearningLease = {
  generation: number;
  expiresAt: string;
};

export type LeaseFailure = "ACTIVE_ELSEWHERE" | "OWNER_DISABLED" |
  "AUTH_REQUIRED" | "INVALID_SESSION" | "UNAVAILABLE";

export class LearningLeaseError extends Error {
  constructor(public readonly reason: LeaseFailure) {
    super(reason === "ACTIVE_ELSEWHERE"
      ? "Tài khoản đang có phiên học trực tuyến trên thiết bị khác. Bạn cần chủ động chuyển phiên học."
      : reason === "OWNER_DISABLED"
        ? "Phiên Guest cũ đã chuyển quyền dữ liệu; không thể đồng bộ từ thiết bị này."
        : "Không thể xác minh quyền phiên học trực tuyến. Dữ liệu luyện tập local vẫn được giữ.");
    this.name = "LearningLeaseError";
  }
}

/**
 * Uses the current Supabase Auth JWT (including its signed session_id claim).
 * Never silently replaces another active session: takeover requires explicit UI.
 * Cloud RPCs independently enforce the lease, so this client call is not a
 * security boundary or a replacement for server-side authorization.
 */
export async function acquireLearningLease(
  client: SupabaseClient,
  options: { takeover?: boolean } = {},
): Promise<ActiveLearningLease> {
  const { data, error } = await client.rpc("chunkdiary_lease_acquire", {
    p_takeover: options.takeover === true,
  });
  if (error || !data || typeof data !== "object") {
    throw new LearningLeaseError("UNAVAILABLE");
  }
  const result = data as Record<string, unknown>;
  if (result.allowed !== true) {
    const reason = typeof result.reason === "string" ? result.reason : "";
    const known: LeaseFailure[] = [
      "ACTIVE_ELSEWHERE", "OWNER_DISABLED", "AUTH_REQUIRED", "INVALID_SESSION",
    ];
    throw new LearningLeaseError(known.includes(reason as LeaseFailure)
      ? reason as LeaseFailure : "UNAVAILABLE");
  }
  if (typeof result.generation !== "number" ||
      !Number.isSafeInteger(result.generation) ||
      typeof result.expiresAt !== "string") {
    throw new LearningLeaseError("UNAVAILABLE");
  }
  return { generation: result.generation, expiresAt: result.expiresAt };
}
