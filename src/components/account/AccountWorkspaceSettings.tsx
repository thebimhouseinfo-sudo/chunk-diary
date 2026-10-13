import React, { useEffect, useState } from "react";
import { isVerifiedAccountOwner } from "./identityGate";
import { acquireLearningLease, LearningLeaseError } from "../../services/supabase/learningLease";
import { isSupabaseConfigured, supabase, ensureGuestSession } from "../../services/supabase/client";
import { captureLegacyBackup } from "../../db/legacySnapshot";
import { importIntoScopedWorkspace, previewScopedImport } from "../../db/scopedWorkspace";
import {
  createManualWorkspaceBackup, inspectManualCloudBackup,
  restoreManualCloudBackup, restoreAccountPreferences,
} from "../../services/supabase/manualBackup";
import {
  enqueueBackup, sendQueuedBackup, inspectBackupQueue, discardQueuedBackup,
  type BackupQueueJob,
} from "../../services/supabase/backupQueue";
import type { LegacyBackup } from "../../db/legacySnapshot";
import {
  activeWorkspaceOwner, chooseAccountWorkspace, chooseGuestWorkspace, chooseLocalWorkspace,
  type VerifiedWorkspaceUser,
} from "../../db/workspaceRouter";

export default function AccountWorkspaceSettings() {
  const [email, setEmail] = useState("");
  const [identity, setIdentity] = useState<VerifiedWorkspaceUser | null>(null);
  const [identityCheck, setIdentityCheck] = useState<"checking" | "verified" | "unverified">("checking");
  const [busy, setBusy] = useState(false);
  const [queued, setQueued] = useState<BackupQueueJob | null>(null);
  const [cloudPreview, setCloudPreview] = useState<Awaited<ReturnType<typeof inspectManualCloudBackup>> | null>(null);
  const [betaPreview, setBetaPreview] = useState<{
    backup: LegacyBackup; count: number; canImport: boolean;
  } | null>(null);
  const [status, setStatus] = useState("Chưa kiểm tra phiên đăng nhập.");
  const owner = activeWorkspaceOwner();
  const ownerId = owner?.kind === "account" ? owner.userId : null;
  const ownerVerified = isVerifiedAccountOwner(ownerId, identity, identityCheck);
  useEffect(() => {
    if (!ownerId) return;
    let alive = true;
    void inspectBackupQueue(ownerId).then(state => { if (alive) setQueued(state); })
      .catch(() => { if (alive) setStatus("Không đọc được hàng đợi sao lưu của tài khoản."); });
    return () => { alive = false; };
  }, [ownerId]);

  const verify = async (): Promise<VerifiedWorkspaceUser | null> => {
    if (!supabase) return null;
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) return null;
    return { id: data.user.id, isAnonymous: Boolean(data.user.is_anonymous) };
  };
  useEffect(() => {
    let current = true;
    void verify().then((result) => {
      if (!current) return;
      setIdentity(result);
      setIdentityCheck(result ? "verified" : "unverified");
      setStatus(result
        ? (result.isAnonymous ? "Phiên ẩn danh chỉ dành cho AI, không đảm bảo phục hồi liên thiết bị."
          : "Đã xác minh tài khoản. Chỉ khi chọn, ứng dụng mới mở workspace của tài khoản này.")
        : "Đang học bằng dữ liệu local; chưa có tài khoản liên kết.");
    }).catch(() => { if (current) { setIdentityCheck("unverified"); setStatus("Không thể kiểm tra Auth; thao tác cloud bị khoá. Có thể quay về Local an toàn."); } });
    return () => { current = false; };
  }, []);

  const run = async (callback: () => Promise<void>) => {
    setBusy(true);
    try { await callback(); }
    catch (error) {
      setStatus(error instanceof Error ? error.message : "Thao tác tài khoản thất bại.");
    } finally { setBusy(false); }
  };

  const onTakeoverLearning = () => run(async () => {
    if (!supabase) throw new Error("Supabase chưa được cấu hình.");
    const fresh = await verify();
    if (!fresh || !ownerId || fresh.id !== ownerId) {
      throw new Error("Chỉ được chuyển phiên cho tài khoản hiện đang sử dụng.");
    }
    // No hidden takeover during sign-in or on page load.
    if (!window.confirm(
      "Chuyển phiên học trực tuyến về thiết bị này? Thiết bị trước không thể gửi AI hoặc đồng bộ cloud; dữ liệu luyện tập local của máy cũ được giữ nguyên."
    )) return;
    const lease = await acquireLearningLease(supabase, { takeover: true });
    setStatus("Đã kích hoạt phiên học trực tuyến trên thiết bị này. Phiên trước không còn quyền ghi cloud. Thời hạn: " +
      new Date(lease.expiresAt).toLocaleTimeString("vi-VN"));
  });

  const onCheckLearningLease = () => run(async () => {
    if (!supabase || !ownerId || identity?.id !== ownerId) {
      throw new Error("Cần xác minh tài khoản đang sử dụng.");
    }
    try {
      const lease = await acquireLearningLease(supabase);
      setStatus("Phiên học trực tuyến đang hoạt động. Hết hạn nếu không gia hạn: " +
        new Date(lease.expiresAt).toLocaleTimeString("vi-VN"));
    } catch (error) {
      if (error instanceof LearningLeaseError && error.reason === "ACTIVE_ELSEWHERE") {
        setStatus("Tài khoản đang học trực tuyến trên thiết bị khác. Bạn vẫn có thể luyện tập dữ liệu local tại đây hoặc chủ động chuyển phiên.");
        return;
      }
      throw error;
    }
  });

  const onAnonymous = () => run(async () => {
    const session = await ensureGuestSession();
    if (!session) throw new Error("Chưa cấu hình Supabase");
    setIdentity({ id: session.user.id, isAnonymous: Boolean(session.user.is_anonymous) });
    setIdentityCheck("verified");
    setStatus(session.user.is_anonymous
      ? "Guest Auth đã xác minh. Có thể chọn workspace Guest riêng; dữ liệu Local beta không bị thay đổi."
      : "Đã có phiên đăng nhập liên kết. Không tạo Guest mới hoặc tự nhận dữ liệu Local beta.");
  });

  const onGoogle = () => run(async () => {
    if (!supabase) throw new Error("Chưa cấu hình Supabase");
    if (identity?.isAnonymous) {
      const { error } = await supabase.auth.linkIdentity({ provider: "google" });
      if (error) throw error;
    } else {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google", options: { redirectTo: window.location.origin + window.location.pathname },
      });
      if (error) throw error;
    }
    setStatus("Hoàn tất Google Auth trước khi kích hoạt workspace.");
  });

  const onEmail = () => run(async () => {
    if (!supabase) throw new Error("Chưa cấu hình Supabase");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Email không hợp lệ");
    if (identity?.isAnonymous) {
      const { error } = await supabase.auth.updateUser({ email });
      if (error) throw error;
    } else {
      const { error } = await supabase.auth.signInWithOtp({
        email, options: { emailRedirectTo: window.location.origin + window.location.pathname },
      });
      if (error) throw error;
    }
    setStatus("Vui lòng xác nhận liên kết đăng nhập đã gửi tới email.");
  });

  const onGuestWorkspace = () => run(async () => {
    const fresh = await verify();
    if (!fresh?.isAnonymous) throw new Error("Cần phiên Guest ẩn danh đã xác minh.");
    if (!window.confirm(
      "Dùng workspace Guest riêng theo tài khoản Supabase hiện tại? Dữ liệu Local beta sẽ KHÔNG bị chuyển, xóa hoặc tự upload. Đồng ý?"
    )) return;
    await chooseGuestWorkspace(fresh.id, verify, localStorage);
    window.location.reload();
  });

  const onAccount = () => run(async () => {
    const fresh = await verify();
    if (!fresh || fresh.isAnonymous) throw new Error("Phải liên kết và xác minh tài khoản trước.");
    if (!window.confirm(
      "Chuyển sang workspace riêng của tài khoản này? Nhật ký beta Local sẽ KHÔNG được tự động chuyển hoặc xóa. " +
      "Bạn có thể quay lại Local bất cứ lúc nào. Không bật sao lưu cloud."
    )) return;
    await chooseAccountWorkspace(fresh.id, verify, localStorage);
    window.location.reload(); // Drop stale React refs before reading another owner.
  });

  const onLocal = () => {
    chooseLocalWorkspace(localStorage);
    window.location.reload();
  };

  const onPreviewLegacy = () => run(async () => {
    if (!ownerVerified || owner?.kind !== "account") throw new Error("Cần xác minh lại tài khoản trước khi truy cập dữ liệu.");
    const backup = await captureLegacyBackup();
    const preview = await previewScopedImport(backup, owner);
    setBetaPreview({ backup, count: preview.recordCount, canImport: preview.canImport });
    setStatus(preview.canImport
      ? "Dữ liệu Local beta có thể được SAO CHÉP vào workspace trống, chưa upload cloud."
      : "Workspace tài khoản đã có dữ liệu; không thể nhập đè. Dữ liệu beta vẫn được giữ nguyên.");
  });

  const onAdoptLocal = () => run(async () => {
    if (!ownerVerified || owner?.kind !== "account" || !betaPreview?.canImport) throw new Error("Cần xác minh lại tài khoản trước khi nhập dữ liệu.");
    if (!window.confirm(
      "Chỉ SAO CHÉP dữ liệu Local beta vào tài khoản đang mở? Dữ liệu beta KHÔNG bị xóa " +
      "và KHÔNG tự động tải lên Supabase. Đồng ý?"
    )) return;
    await importIntoScopedWorkspace(betaPreview.backup, owner, { confirmed: true });
    restoreAccountPreferences(owner.userId, betaPreview.backup);
    window.location.reload();
  });

  const onBackup = () => run(async () => {
    if (!supabase || !ownerVerified || owner?.kind !== "account") throw new Error("Tài khoản chưa được xác minh để sao lưu.");
    const previous = cloudPreview?.receipt.checksum ?? null;
    if (!window.confirm(previous
      ? "THAY THẾ bản backup cloud vừa xem trước? Chỉ ghi nếu checksum hiện tại vẫn khớp; " +
        "mọi chỉnh sửa mới từ thiết bị khác sẽ được bảo vệ. Xác nhận?"
      : "TẠO bản sao cloud lần đầu? Nếu đã có bản backup từ thiết bị khác, " +
        "ứng dụng sẽ từ chối ghi đè và yêu cầu xem trước. Không chia sẻ corpus. Đồng ý?"
    )) return;
    const backup = await createManualWorkspaceBackup(owner.userId);
    await enqueueBackup(owner.userId, backup, previous, { confirmed: true });
    setQueued(await inspectBackupQueue(owner.userId));
    const outcome = await sendQueuedBackup(supabase, owner.userId);
    setQueued(await inspectBackupQueue(owner.userId));
    if (outcome.status === "synced") {
      setCloudPreview(null); // Force fresh preview before any new replacement.
      setStatus("Sao lưu cloud thành công, đã xác minh checksum.");
    } else {
      setStatus("Backup vẫn được lưu an toàn trên thiết bị: " + outcome.status +
        ". Chỉ thử lại khi bạn bấm nút Retry.");
    }
  });

  const onRetryQueuedBackup = () => run(async () => {
    if (!supabase || !ownerVerified || owner?.kind !== "account") throw new Error("Tài khoản chưa được xác minh để gửi lại bản sao.");
    const outcome = await sendQueuedBackup(supabase, owner.userId);
    setQueued(await inspectBackupQueue(owner.userId));
    if (outcome.status === "synced") setCloudPreview(null);
    setStatus(outcome.status === "synced"
      ? "Đã đồng bộ bản sao bị gián đoạn. Không gửi thêm dữ liệu."
      : "Hàng đợi: " + outcome.status + ". " +
        (outcome.errorCode ? "Mã lỗi: " + outcome.errorCode : "Chờ thêm trước khi retry."));
  });

  const onDiscardQueue = () => run(async () => {
    if (!ownerVerified || owner?.kind !== "account") throw new Error("Cần xác minh tài khoản trước khi xoá hàng đợi.");
    if (!window.confirm("XÓA bản sao chưa gửi đang chờ trên thiết bị? " +
      "Nhật ký và chunks trong workspace KHÔNG bị xóa.")) return;
    await discardQueuedBackup(owner.userId, { confirmed: true });
    setQueued(null);
    setStatus("Đã bỏ hàng đợi. Dữ liệu học gốc vẫn còn nguyên.");
  });

  const onPreviewCloud = () => run(async () => {
    if (!supabase || !ownerVerified || owner?.kind !== "account") throw new Error("Tài khoản chưa được xác minh để xem bản sao.");
    const result = await inspectManualCloudBackup(supabase, owner.userId);
    setCloudPreview(result);
    setStatus("Cloud backup hợp lệ: " + result.receipt.recordCount + " bản ghi. " +
      (result.preview.canImport ? "Workspace trống, có thể phục hồi." :
        "Workspace có dữ liệu; từ chối nhập đè."));
  });

  const onRestoreCloud = () => run(async () => {
    if (!supabase || !ownerVerified || owner?.kind !== "account" || !cloudPreview?.preview.canImport) throw new Error("Cần xác minh tài khoản và xem trước bản sao trước khi phục hồi.");
    if (!window.confirm(
      "Phục hồi bản sao cloud đã xem trước vào workspace TRỐNG này? " +
      "Không thay đổi dữ liệu Local beta. Xác nhận?"
    )) return;
    await restoreManualCloudBackup(supabase, owner.userId, cloudPreview.backup, { confirmed: true });
    window.location.reload();
  });

  const onSignOut = () => run(async () => {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    // Only clear the local account view AFTER Auth has signed out.
    chooseLocalWorkspace(localStorage);
    window.location.reload();
  });

  return (
    <section className="bg-white p-6 sm:p-8 rounded-[2rem] border border-slate-100 shadow-sm space-y-4"
      aria-label="Tài khoản và vùng dữ liệu">
      <h3 className="font-display text-lg font-black text-slate-900">Tài khoản & dữ liệu riêng</h3>
      <p className="text-sm font-semibold text-slate-700">
        Đang sử dụng: {owner?.kind === "account" ? "Workspace tài khoản đã xác minh" : "Local beta trên thiết bị"}
      </p>
      <p className="text-xs text-slate-500">
        Đăng nhập KHÔNG tự tải nhật ký hoặc chia sẻ chunks. Chỉ sao lưu thủ công khi bạn xác nhận; đồng bộ tự động vẫn tắt.
        Dữ liệu beta chỉ chuyển khi bạn xem trước và đồng ý nhập riêng.
      </p>
      <div className="rounded-xl border border-slate-200 p-4 space-y-2" aria-label="Các loại quyền xử lý dữ liệu">
        <p className="text-sm font-bold text-slate-800">Quyền dữ liệu tách biệt</p>
        <p className="text-xs text-slate-600"><strong>AI processing:</strong> chỉ gửi nội dung khi bạn chủ động tạo bài với AI. Không đồng nghĩa lưu bản sao lên cloud.</p>
        <p className="text-xs text-slate-600"><strong>Backup sync:</strong> chỉ gửi bản sao khi bạn xác nhận nút Sao lưu thủ công bên dưới. Đăng nhập không tự động upload.</p>
        <p className="text-xs text-slate-600"><strong>Corpus sharing:</strong> đang TẮT; không chia sẻ các chunks vào kho dữ liệu chung. Hiện chưa có thao tác bật chia sẻ.</p>
      </div>
      {!isSupabaseConfigured && (
        <p className="text-xs text-orange-700">Supabase chưa được cấu hình ở môi trường development.</p>
      )}
      <p role="status" className="text-xs text-slate-600">{status}</p>
      {owner?.kind === "account" && !ownerVerified && (
        <p role="alert" className="rounded-xl border border-orange-200 p-3 text-xs text-orange-800">
          {identityCheck === "checking" ? "Đang xác minh quyền sở hữu workspace; các thao tác cloud tạm khoá." : "Chưa xác minh được tài khoản sở hữu workspace này. Thao tác dữ liệu đã bị khoá; chọn Local để tiếp tục an toàn."}
        </p>
      )}
      {isSupabaseConfigured && (
        <div className="space-y-3">
          {!identity && (
            <button type="button" disabled={busy} onClick={onAnonymous}
              className="w-full rounded-xl bg-slate-100 text-slate-700 p-3 text-sm font-bold disabled:opacity-50">
              Tạo phiên ẩn danh cho AI (không sao lưu)
            </button>
          )}
          {(identity?.isAnonymous || !identity) && (
            <>
              <button type="button" disabled={busy} onClick={onGoogle}
                className="w-full rounded-xl bg-vibrant-indigo text-white p-3 text-sm font-bold disabled:opacity-50">
                {identity?.isAnonymous ? "Liên kết Google" : "Đăng nhập bằng Google"}
              </button>
              <div className="flex gap-2">
                <input type="email" aria-label="Email đăng nhập" placeholder="Email"
                  value={email} onChange={(event) => setEmail(event.target.value)}
                  className="min-w-0 flex-1 rounded-xl border p-3 text-sm" />
                <button type="button" disabled={busy} onClick={onEmail}
                  className="rounded-xl bg-slate-800 px-4 text-white text-sm disabled:opacity-50">
                  {identity?.isAnonymous ? "Liên kết" : "Gửi mã"}
                </button>
              </div>
            </>
          )}
          {identity?.isAnonymous && (owner?.kind !== "account" || owner.userId !== identity.id) && (
            <button type="button" disabled={busy} onClick={onGuestWorkspace}
              className="w-full rounded-xl bg-vibrant-indigo text-white p-3 text-sm font-bold disabled:opacity-50">
              Dùng workspace Guest riêng (chưa đồng bộ cloud)
            </button>
          )}
          {identity && !identity.isAnonymous && owner?.kind !== "account" && (
            <button type="button" disabled={busy} onClick={onAccount}
              className="w-full rounded-xl bg-vibrant-indigo text-white p-3 text-sm font-bold disabled:opacity-50">
              Dùng workspace của tài khoản đã xác minh
            </button>
          )}
          {owner?.kind === "account" && identity?.id === owner.userId && (
            <div className="space-y-2 rounded-xl border border-slate-100 p-3">
              <p className="text-xs text-slate-600">Chỉ một phiên học trực tuyến có quyền gọi AI và ghi cloud. Luyện tập chunks đã lưu vẫn dùng được khi offline.</p>
              <button type="button" disabled={busy} onClick={onCheckLearningLease}
                className="w-full rounded-xl border p-3 text-sm font-semibold disabled:opacity-50">
                Kiểm tra quyền phiên học trực tuyến
              </button>
              <button type="button" disabled={busy} onClick={onTakeoverLearning}
                className="w-full rounded-xl border border-vibrant-indigo p-3 text-sm font-bold disabled:opacity-50">
                Chuyển phiên học sang thiết bị này
              </button>
            </div>
          )}
          {owner?.kind === "account" && (
            <button type="button" disabled={busy} onClick={onLocal}
              className="w-full rounded-xl border border-vibrant-indigo p-3 text-sm font-bold">
              Trở về dữ liệu Local beta (không xóa workspace)
            </button>
          )}
          {owner?.kind === "account" && ownerVerified && (
            <div className="space-y-2 rounded-xl border border-slate-100 p-4">
              <p className="text-xs font-bold text-slate-700">Chuyển dữ liệu có xác nhận</p>
              <button type="button" disabled={busy} onClick={onPreviewLegacy}
                className="w-full rounded-xl border p-3 text-sm font-semibold disabled:opacity-50">
                Xem trước dữ liệu Local beta để sao chép
              </button>
              {betaPreview && (
                <p className="text-xs text-slate-600">
                  Local beta: {betaPreview.count} bản ghi.
                  {betaPreview.canImport ? " Có thể sao chép vào workspace trống." : " Không được nhập đè."}
                </p>
              )}
              {betaPreview?.canImport && (
                <button type="button" disabled={busy} onClick={onAdoptLocal}
                  className="w-full rounded-xl bg-slate-100 p-3 text-sm font-bold disabled:opacity-50">
                  Xác nhận sao chép vào workspace tài khoản (không upload)
                </button>
              )}
              {queued && queued.status !== "synced" && (
                <div className="rounded-xl bg-slate-50 p-3 space-y-2" role="status">
                  <p className="text-xs font-semibold text-slate-700">
                    Backup {queued.status === "pending" ? "Pending" : "Failed"} ·
                    Đã thử {queued.attempts} lần ·
                    {queued.errorCode ?? "Chưa có lỗi"}
                  </p>
                  <p className="text-xs text-slate-500">
                    Chỉ lưu trên thiết bị khi lỗi mạng; không tự động upload lại.
                  </p>
                  <button type="button" disabled={busy}
                    onClick={onRetryQueuedBackup}
                    className="w-full rounded-xl bg-slate-200 p-2 text-sm font-bold disabled:opacity-50">
                    Thử lại bản sao đang chờ
                  </button>
                  <button type="button" disabled={busy} onClick={onDiscardQueue}
                    className="w-full rounded-xl border p-2 text-sm font-semibold disabled:opacity-50">
                    Hủy hàng đợi (giữ dữ liệu học)
                  </button>
                </div>
              )}
              <button type="button" disabled={busy} onClick={onBackup}
                className="w-full rounded-xl bg-vibrant-indigo p-3 text-sm font-bold text-white disabled:opacity-50">
                Sao lưu thủ công workspace lên Supabase
              </button>
              <button type="button" disabled={busy} onClick={onPreviewCloud}
                className="w-full rounded-xl border p-3 text-sm font-bold disabled:opacity-50">
                Kiểm tra bản sao trên Supabase
              </button>
              {cloudPreview && (
                <p className="text-xs text-slate-600">
                  Cloud: {cloudPreview.receipt.recordCount} bản ghi,
                  SHA-256 {cloudPreview.receipt.checksum.slice(0, 12)}….
                  {cloudPreview.preview.canImport ? " Có thể phục hồi." : " Không thể nhập đè workspace có dữ liệu."}
                </p>
              )}
              {cloudPreview?.preview.canImport && (
                <button type="button" disabled={busy} onClick={onRestoreCloud}
                  className="w-full rounded-xl bg-slate-100 p-3 text-sm font-bold disabled:opacity-50">
                  Xác nhận phục hồi cloud vào workspace trống
                </button>
              )}
            </div>
          )}
          {identity && (
            <button type="button" disabled={busy} onClick={onSignOut}
              className="w-full rounded-xl bg-slate-100 p-3 text-sm font-semibold disabled:opacity-50">
              Đăng xuất (giữ nguyên dữ liệu trên thiết bị)
            </button>
          )}
        </div>
      )}
    </section>
  );
}
