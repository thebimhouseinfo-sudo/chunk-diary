import React, { useEffect, useState } from "react";
import { isSupabaseConfigured, supabase, ensureGuestSession } from "../../services/supabase/client";
import {
  activeWorkspaceOwner, chooseAccountWorkspace, chooseLocalWorkspace,
  type VerifiedWorkspaceUser,
} from "../../db/workspaceRouter";

export default function AccountWorkspaceSettings() {
  const [email, setEmail] = useState("");
  const [identity, setIdentity] = useState<VerifiedWorkspaceUser | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("Chưa kiểm tra phiên đăng nhập.");
  const owner = activeWorkspaceOwner();

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
      setStatus(result
        ? (result.isAnonymous ? "Phiên ẩn danh chỉ dành cho AI, không đảm bảo phục hồi liên thiết bị."
          : "Đã xác minh tài khoản. Chỉ khi chọn, ứng dụng mới mở workspace của tài khoản này.")
        : "Đang học bằng dữ liệu local; chưa có tài khoản liên kết.");
    }).catch(() => { if (current) setStatus("Không thể kiểm tra Auth; giữ chế độ Local an toàn."); });
    return () => { current = false; };
  }, []);

  const run = async (callback: () => Promise<void>) => {
    setBusy(true);
    try { await callback(); }
    catch (error) {
      setStatus(error instanceof Error ? error.message : "Thao tác tài khoản thất bại.");
    } finally { setBusy(false); }
  };

  const onAnonymous = () => run(async () => {
    const session = await ensureGuestSession();
    if (!session) throw new Error("Chưa cấu hình Supabase");
    setIdentity({ id: session.user.id, isAnonymous: true });
    setStatus("Đã tạo phiên AI ẩn danh; dữ liệu học local chưa được upload.");
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

  const onSignOut = () => run(async () => {
    if (!supabase) return;
    // Remove the active workspace pointer BEFORE clearing Auth credentials.
    chooseLocalWorkspace(localStorage);
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
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
        Đăng nhập KHÔNG đồng nghĩa với upload nhật ký hoặc chia sẻ chunks. Sao lưu đám mây hiện chưa bật.
        Dữ liệu beta chỉ chuyển khi bạn xem trước và đồng ý nhập riêng.
      </p>
      {!isSupabaseConfigured && (
        <p className="text-xs text-orange-700">Supabase chưa được cấu hình ở môi trường development.</p>
      )}
      <p role="status" className="text-xs text-slate-600">{status}</p>
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
          {identity && !identity.isAnonymous && owner?.kind !== "account" && (
            <button type="button" disabled={busy} onClick={onAccount}
              className="w-full rounded-xl bg-vibrant-indigo text-white p-3 text-sm font-bold disabled:opacity-50">
              Dùng workspace của tài khoản đã xác minh
            </button>
          )}
          {owner?.kind === "account" && (
            <button type="button" disabled={busy} onClick={onLocal}
              className="w-full rounded-xl border border-vibrant-indigo p-3 text-sm font-bold">
              Trở về dữ liệu Local beta (không xóa workspace)
            </button>
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
