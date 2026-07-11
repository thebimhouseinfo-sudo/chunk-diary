import React, { useState, useEffect } from "react";
import {
  User,
  Download,
  Upload,
  Check,
  Sparkles,
  BookOpen,
  Briefcase,
  Heart,
  AlertCircle
} from "lucide-react";
import { UserSettings } from "../types";

export default function SettingsView() {
  const [settings, setSettings] = useState<UserSettings>({
    nickname: "",
    nativeLanguage: "Vietnamese",
    learningLanguages: ["English"],
    appScriptUrl: "https://script.google.com/macros/s/AKfycbxLmRVOSZXYzipNowTNuRPesNoErVlTZiRdaJVZ-I6zfergemuax1UIYDUaeB0pa2O7/exec",
    hobby: "",
    learningPurpose: "hobby",
    specialty: "",
    subSpecialty: "",
    onboarded: true
  });

  const [learningLanguageText, setLearningLanguageText] = useState("English");
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [placeholderMessage, setPlaceholderMessage] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("user_settings");
    if (saved) {
      const parsed = JSON.parse(saved);
      // Ensure appScriptUrl is populated if it was missing in old settings
      if (!parsed.appScriptUrl) {
        parsed.appScriptUrl = "https://script.google.com/macros/s/AKfycbxLmRVOSZXYzipNowTNuRPesNoErVlTZiRdaJVZ-I6zfergemuax1UIYDUaeB0pa2O7/exec";
      }
      setSettings(parsed);
      if (parsed.learningLanguages && parsed.learningLanguages.length > 0) {
        setLearningLanguageText(parsed.learningLanguages.join(", "));
      }
    }
  }, []);

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();

    // Parse target languages from comma-separated string
    const parsedLangs = learningLanguageText
      .split(",")
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    const updated: UserSettings = {
      ...settings,
      learningLanguages: parsedLangs.length > 0 ? parsedLangs : ["English"],
      onboarded: true
    };

    setSettings(updated);
    localStorage.setItem("user_settings", JSON.stringify(updated));
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
  };

  const handlePlaceholderClick = (action: string) => {
    setPlaceholderMessage(
      action === "download"
        ? "Tính năng Tải xuống dữ liệu (Backup) đang được phát triển và sẽ sớm ra mắt."
        : "Tính năng Phục hồi dữ liệu (Restore) yêu cầu tài khoản Premium để đồng bộ đám mây đám mây."
    );
    setTimeout(() => setPlaceholderMessage(null), 4000);
  };

  return (
    <div className="animate-pageFadeIn max-w-5xl mx-auto space-y-6 sm:space-y-8">
      {/* Header */}
      <div className="bg-white p-6 sm:p-8 rounded-[2rem] border border-slate-100 shadow-sm text-left">
        <h2 className="font-display text-xl sm:text-2xl font-black text-slate-900 flex items-center gap-2.5">
          <User className="text-vibrant-indigo" />
          Cấu Hình Tài Khoản
        </h2>
        <p className="text-[10px] sm:text-xs text-slate-500 font-medium mt-1">
          Quản lý thông tin cá nhân, mục tiêu học tập và thiết lập hệ thống.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 text-left">
        {/* Main Settings Card */}
        <form onSubmit={handleSaveSettings} className="lg:col-span-8 space-y-6">
          {/* Profile / Lang */}
          <div className="bg-white p-6 sm:p-8 rounded-[2rem] border border-slate-100 shadow-sm space-y-6">
            <div className="flex items-center gap-3 text-vibrant-indigo border-b border-slate-50 pb-4">
              <Sparkles size={20} className="text-vibrant-coral" />
              <h3 className="font-display font-black text-lg text-slate-900">Thông tin cá nhân</h3>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nickname của bạn</label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Minh, Anna..."
                  value={settings.nickname || ""}
                  onChange={(e) => setSettings({ ...settings, nickname: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-sm font-semibold outline-none focus:border-vibrant-indigo transition-all"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ngôn ngữ mẹ đẻ</label>
                  <input
                    type="text"
                    required
                    value={settings.nativeLanguage}
                    onChange={(e) => setSettings({ ...settings, nativeLanguage: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-sm font-semibold outline-none focus:border-vibrant-indigo transition-all"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ngôn ngữ muốn học</label>
                  <input
                    type="text"
                    required
                    placeholder="Ví dụ: English, Japanese"
                    value={learningLanguageText}
                    onChange={(e) => setLearningLanguageText(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-sm font-semibold outline-none focus:border-vibrant-indigo transition-all"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Learning Purpose Card */}
          <div className="bg-white p-6 sm:p-8 rounded-[2rem] border border-slate-100 shadow-sm space-y-6">
            <div className="flex items-center gap-3 text-vibrant-indigo border-b border-slate-50 pb-4">
              <BookOpen size={20} className="text-vibrant-coral" />
              <h3 className="font-display font-black text-lg text-slate-900">Mục đích học tập</h3>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Bạn học vì sở thích hay công việc?</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setSettings({ ...settings, learningPurpose: "hobby" })}
                    className={`flex items-center justify-center gap-2 p-3.5 rounded-2xl text-xs font-black uppercase tracking-tight border transition-all cursor-pointer ${
                      settings.learningPurpose === "hobby"
                        ? "bg-vibrant-indigo text-white border-vibrant-indigo shadow-md"
                        : "bg-slate-50 text-slate-600 border-slate-100 hover:bg-slate-100"
                    }`}
                  >
                    <Heart size={14} /> Sở thích
                  </button>
                  <button
                    type="button"
                    onClick={() => setSettings({ ...settings, learningPurpose: "work" })}
                    className={`flex items-center justify-center gap-2 p-3.5 rounded-2xl text-xs font-black uppercase tracking-tight border transition-all cursor-pointer ${
                      settings.learningPurpose === "work"
                        ? "bg-vibrant-indigo text-white border-vibrant-indigo shadow-md"
                        : "bg-slate-50 text-slate-600 border-slate-100 hover:bg-slate-100"
                    }`}
                  >
                    <Briefcase size={14} /> Công việc
                  </button>
                </div>
              </div>

              {settings.learningPurpose === "work" ? (
                <div className="space-y-4 p-4 sm:p-5 bg-slate-50 rounded-2xl border border-slate-100 animate-pageFadeIn">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Chuyên ngành</label>
                    <select
                      value={settings.specialty || "Công nghệ thông tin"}
                      onChange={(e) => setSettings({ ...settings, specialty: e.target.value })}
                      className="w-full bg-white border border-slate-100 rounded-2xl px-4 py-3 text-sm font-semibold outline-none focus:border-vibrant-indigo transition-all cursor-pointer"
                    >
                      <option value="Công nghệ thông tin">Công nghệ thông tin</option>
                      <option value="Y học / Y tế">Y học / Y tế</option>
                      <option value="Kinh tế / Tài chính">Kinh tế / Tài chính</option>
                      <option value="Kỹ thuật / Sản xuất">Kỹ thuật / Sản xuất</option>
                      <option value="Ngôn ngữ / Sư phạm">Ngôn ngữ / Sư phạm</option>
                      <option value="Khác">Khác</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ngành con / Mô tả chi tiết</label>
                    <input
                      type="text"
                      placeholder="Ví dụ: Lập trình Web, Quản trị mạng, Tim mạch..."
                      value={settings.subSpecialty || ""}
                      onChange={(e) => setSettings({ ...settings, subSpecialty: e.target.value })}
                      className="w-full bg-white border border-slate-100 rounded-2xl px-4 py-3 text-sm font-semibold outline-none focus:border-vibrant-indigo transition-all"
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-1.5 animate-pageFadeIn">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sở thích / Chủ đề quan tâm</label>
                  <textarea
                    value={settings.hobby || ""}
                    onChange={(e) => setSettings({ ...settings, hobby: e.target.value })}
                    placeholder="Ví dụ: Công nghệ, nấu ăn, du lịch, bóng đá..."
                    rows={3}
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-sm font-medium outline-none focus:border-vibrant-indigo transition-all resize-none"
                  />
                </div>
              )}
            </div>
          </div>

          {/* AI & Google Sheets Configuration Card */}
          <div className="bg-white p-6 sm:p-8 rounded-[2rem] border border-slate-100 shadow-sm space-y-6">
            <div className="flex items-center gap-3 text-vibrant-indigo border-b border-slate-50 pb-4">
              <Sparkles size={20} className="text-vibrant-coral" />
              <h3 className="font-display font-black text-lg text-slate-900">Cấu hình AI & Google Sheets</h3>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Google Apps Script Web App URL</label>
                <input
                  type="url"
                  required
                  placeholder="https://script.google.com/macros/s/.../exec"
                  value={settings.appScriptUrl || ""}
                  onChange={(e) => setSettings({ ...settings, appScriptUrl: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-sm font-semibold outline-none focus:border-vibrant-indigo transition-all"
                />
                <p className="text-[10px] text-slate-400 leading-relaxed">
                  Nhập URL của Google Apps Script Web App đã được triển khai từ Google Sheet của bạn. Cả API key và tên mô hình AI sẽ được cấu hình và gọi trực tiếp từ endpoint trong Apps Script URL này để đảm bảo hiệu suất tốt nhất.
                </p>
              </div>
            </div>
          </div>

          {/* Action Row */}
          <div className="flex justify-end">
            <button
              type="submit"
              className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-7 py-4 rounded-2xl text-xs font-black uppercase tracking-wider shadow-lg active:scale-95 transition-all cursor-pointer"
            >
              <Check size={16} /> Lưu Thay Đổi
            </button>
          </div>
        </form>

        {/* Side / Backup Panel */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white p-6 sm:p-8 rounded-[2rem] border border-slate-100 shadow-sm space-y-5">
            <div className="flex items-center gap-2 text-vibrant-indigo">
              <Briefcase size={20} className="text-vibrant-coral" />
              <h3 className="font-display font-black text-base uppercase tracking-wider">Sao lưu & Đồng bộ</h3>
            </div>

            <p className="text-xs text-slate-400 font-medium leading-relaxed">
              Quản lý toàn bộ dữ liệu học tập của bạn. Tải xuống bản sao lưu để giữ an toàn hoặc nhập lại trên một thiết bị khác.
            </p>

            <div className="space-y-3 pt-2">
              <button
                type="button"
                onClick={() => handlePlaceholderClick("download")}
                className="w-full flex items-center justify-center gap-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 py-3.5 rounded-2xl text-xs font-bold transition-all cursor-pointer border-none"
              >
                <Download size={15} /> Tải xuống dữ liệu
              </button>

              <button
                type="button"
                onClick={() => handlePlaceholderClick("restore")}
                className="w-full flex items-center justify-center gap-2.5 bg-vibrant-indigo/5 hover:bg-vibrant-indigo/10 text-vibrant-indigo py-3.5 rounded-2xl text-xs font-black transition-all cursor-pointer border-none relative overflow-hidden"
              >
                <Upload size={15} /> Phục hồi dữ liệu
                <span className="absolute top-1 right-2 bg-vibrant-coral text-white font-mono font-black text-[7px] px-1.5 py-0.5 rounded-md uppercase tracking-wider">PREMIUM</span>
              </button>
            </div>
          </div>

          {/* Dynamic feedback / toast inside card */}
          {placeholderMessage && (
            <div className="bg-vibrant-indigo/10 border border-vibrant-indigo/20 p-4 rounded-2xl flex items-start gap-2.5 text-vibrant-indigo animate-pageFadeIn text-left shadow-xs">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <p className="text-[10px] font-bold leading-normal">{placeholderMessage}</p>
            </div>
          )}
        </div>
      </div>

      {saveSuccess && (
        <div className="fixed bottom-20 sm:bottom-8 right-1/2 translate-x-1/2 sm:translate-x-0 sm:right-8 bg-emerald-600 text-white px-6 py-3 rounded-2xl shadow-xl flex items-center gap-2 text-xs font-black animate-pageFadeIn z-[60]">
          <Check size={16} /> Đã lưu cài đặt!
        </div>
      )}
    </div>
  );
}
