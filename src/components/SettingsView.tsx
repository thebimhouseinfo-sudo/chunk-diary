import { getSettings, saveSettings } from "../db/userDb";
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
import { clearAllIndexedDb } from "../db/indexedDb"; // Import to clear IndexedDB
import { clearAllUserDb } from "../db/userDb"; // Import to clear userDb

export default function SettingsView() {
  const [settings, setSettings] = useState<UserSettings>({
    nickname: "",
    nativeLanguage: "Vietnamese",
    learningLanguages: ["English"],
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
        ? "Tính năng Tải xuống dữ liệu (Backup) yêu cầu tài khoản Premium để đồng bộ đám mây."
        : "Tính năng Phục hồi dữ liệu (Restore) yêu cầu tài khoản Premium để đồng bộ đám mây."
    );
    setTimeout(() => setPlaceholderMessage(null), 4000);
  };

  const handleResetData = async () => {
    if (window.confirm("Bạn có chắc chắn muốn xóa tất cả dữ liệu ứng dụng? Hành động này không thể hoàn tác!")) {
      try {
        await clearAllIndexedDb();
        await clearAllUserDb();
        localStorage.clear();
        alert("Tất cả dữ liệu đã được xóa. Ứng dụng sẽ tải lại.");
        window.location.reload();
      } catch (error) {
        console.error("Lỗi khi xóa dữ liệu:", error);
        alert("Đã xảy ra lỗi khi xóa dữ liệu. Vui lòng thử lại.");
      }
    }
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
                  <select
                    value={settings.nativeLanguage}
                    onChange={(e) => setSettings({ ...settings, nativeLanguage: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-sm font-semibold outline-none focus:border-vibrant-indigo transition-all cursor-pointer"
                  >
                    <option value="Vietnamese">Tiếng Việt</option>
                    <option value="English">Tiếng Anh</option>
                    <option value="Japanese">Tiếng Nhật</option>
                    <option value="Korean">Tiếng Hàn</option>
                    <option value="Chinese">Tiếng Trung</option>
                    <option value="French">Tiếng Pháp</option>
                    <option value="German">Tiếng Đức</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ngôn ngữ muốn học</label>
                  <select
                    value={learningLanguageText}
                    onChange={(e) => setLearningLanguageText(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-sm font-semibold outline-none focus:border-vibrant-indigo transition-all cursor-pointer"
                  >
                    <option value="English">Tiếng Anh (English)</option>
                    <option value="Japanese">Tiếng Nhật (Japanese)</option>
                    <option value="Korean">Tiếng Hàn (Korean)</option>
                    <option value="Chinese">Tiếng Trung (Chinese)</option>
                    <option value="French">Tiếng Pháp (French)</option>
                    <option value="German">Tiếng Đức (German)</option>
                    <option value="Spanish">Tiếng Tây Ban Nha (Spanish)</option>
                    <option value="Italian">Tiếng Ý (Italian)</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* CEFR Level Card */}
          <div className="bg-white p-6 sm:p-8 rounded-[2rem] border border-slate-100 shadow-sm space-y-6">
            <div className="flex items-center gap-3 text-vibrant-indigo border-b border-slate-50 pb-4">
              <Sparkles size={20} className="text-vibrant-coral" />
              <h3 className="font-display font-black text-lg text-slate-900">Trình độ ngôn ngữ</h3>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Trình độ CEFR</label>
                <select
                  value={settings.cefrLevel || "A2"}
                  onChange={(e) => setSettings({ ...settings, cefrLevel: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-sm font-semibold outline-none focus:border-vibrant-indigo transition-all cursor-pointer"
                >
                  <option value="A1">A1 – Mới bắt đầu</option>
                  <option value="A2">A2 – Sơ cấp</option>
                  <option value="B1">B1 – Trung cấp</option>
                  <option value="B2">B2 – Trung cấp nâng cao</option>
                  <option value="C1">C1 – Cao cấp</option>
                  <option value="C2">C2 – Thành thạo</option>
                </select>
                <p className="text-[10px] text-slate-400 leading-relaxed">
                  Hệ thống sẽ tạo các câu (chunks) phù hợp với trình độ CEFR của bạn. Chunks sẽ bao gồm Common (câu phổ thông) và Personalized (câu cá nhân hóa theo nghề nghiệp/sở thích).
                </p>
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
                    className={`flex items-center justify-center gap-2 p-3.5 rounded-2xl text-xs font-black uppercase tracking-tight border transition-all cursor-pointer ${settings.learningPurpose === "hobby"
                        ? "bg-vibrant-indigo text-white border-vibrant-indigo shadow-md"
                        : "bg-slate-50 text-slate-600 border-slate-100 hover:bg-slate-100"
                      }`}
                  >
                    <Heart size={14} /> Sở thích
                  </button>
                  <button
                    type="button"
                    onClick={() => setSettings({ ...settings, learningPurpose: "work" })}
                    className={`flex items-center justify-center gap-2 p-3.5 rounded-2xl text-xs font-black uppercase tracking-tight border transition-all cursor-pointer ${settings.learningPurpose === "work"
                        ? "bg-vibrant-indigo text-white border-vibrant-indigo shadow-md"
                        : "bg-slate-50 text-slate-600 border-slate-100 hover:bg-slate-100"
                      }`}
                  >
                    <Briefcase size={14} /> Công việc
                  </button>
                </div>
              </div>

              {settings.learningPurpose === "work" && (
                <div className="space-y-4 p-4 bg-slate-50 rounded-2xl border border-slate-100 animate-pageFadeIn">
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
                      <option value="Marketing / Truyền thông">Marketing / Truyền thông</option>
                      <option value="Thiết kế / Nghệ thuật">Thiết kế / Nghệ thuật</option>
                      <option value="Xây dựng / Bất động sản">Xây dựng / Bất động sản</option>
                      <option value="Du lịch / Khách sạn">Du lịch / Khách sạn</option>
                      <option value="Nhà hàng / F&B">Nhà hàng / F&B</option>
                      <option value="Logistics / Chuỗi cung ứng">Logistics / Chuỗi cung ứng</option>
                      <option value="Luật / Pháp lý">Luật / Pháp lý</option>
                      <option value="Nhân sự / Hành chính">Nhân sự / Hành chính</option>
                      <option value="Bán lẻ / Thương mại điện tử">Bán lẻ / Thương mại điện tử</option>
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
              )}
            </div>
          </div>

          <button
            type="submit"
            className={`w-full flex items-center justify-center gap-2 px-5 py-4 rounded-2xl text-sm font-black uppercase tracking-wider transition-all shadow-lg
              ${saveSuccess
                ? "bg-emerald-500 text-white shadow-emerald-500/30"
                : "bg-vibrant-indigo text-white shadow-vibrant-indigo/30 hover:bg-vibrant-indigo/90"
              }`}
          >
            {saveSuccess ? <Check size={18} /> : <Download size={18} />}
            {saveSuccess ? "Đã Lưu Cấu Hình!" : "Lưu Cấu Hình"}
          </button>
        </form>

        {/* Sidebar / Extra Actions */}
        <div className="lg:col-span-4 space-y-6">
          {/* Data Management Card */}
          <div className="bg-white p-6 sm:p-8 rounded-[2rem] border border-slate-100 shadow-sm space-y-6">
            <div className="flex items-center gap-3 text-vibrant-indigo border-b border-slate-50 pb-4">
              <Download size={20} className="text-vibrant-coral" />
              <h3 className="font-display font-black text-lg text-slate-900">Quản lý dữ liệu</h3>
            </div>

            <div className="space-y-3">
              <button
                onClick={() => handlePlaceholderClick("download")}
                className="w-full flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl text-sm font-black uppercase tracking-wider text-slate-700 bg-slate-50 border border-slate-100 hover:bg-slate-100 transition-all cursor-pointer"
              >
                <Download size={18} /> Tải xuống dữ liệu (Backup)
              </button>
              <button
                onClick={() => handlePlaceholderClick("upload")}
                className="w-full flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl text-sm font-black uppercase tracking-wider text-slate-700 bg-slate-50 border border-slate-100 hover:bg-slate-100 transition-all cursor-pointer"
              >
                <Upload size={18} /> Phục hồi dữ liệu (Restore)
              </button>
            </div>

            {placeholderMessage && (
              <div className="bg-orange-50/20 text-orange-700 text-xs font-bold px-4 py-3 rounded-xl flex items-center gap-2 animate-pageFadeIn border border-orange-200">
                <AlertCircle size={16} />
                {placeholderMessage}
              </div>
            )}
          </div>

          {/* Danger Zone Card */}
          <div className="bg-white p-6 sm:p-8 rounded-[2rem] border border-red-100 shadow-sm space-y-6">
            <div className="flex items-center gap-3 text-red-600 border-b border-red-50 pb-4">
              <AlertCircle size={20} className="text-red-500" />
              <h3 className="font-display font-black text-lg text-red-600">Vùng nguy hiểm</h3>
            </div>
            <button
              onClick={handleResetData}
              className="w-full flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl text-sm font-black uppercase tracking-wider text-white bg-red-500 border border-red-600 hover:bg-red-600 transition-all cursor-pointer shadow-lg shadow-red-500/30"
            >
              <AlertCircle size={18} /> Xóa tất cả dữ liệu ứng dụng
            </button>
            <p className="text-xs text-slate-500 font-medium leading-relaxed">
              Hành động này sẽ xóa vĩnh viễn tất cả dữ liệu của bạn, bao gồm cấu hình, nhật ký và chunks đã tạo. Không thể hoàn tác.
            </p>
          </div>

        </div>
      </div>
    </div>
  );
}
