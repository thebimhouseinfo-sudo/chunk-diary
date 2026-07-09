import React, { useState, useEffect } from "react";
import {
  User,
  RotateCcw,
  Check
} from "lucide-react";
import { UserSettings } from "../types";
import { clearDatabase } from "../db/indexedDb";

export default function SettingsView() {
  const [settings, setSettings] = useState<UserSettings>({
    nativeLanguage: "Vietnamese",
    learningLanguages: ["English"],
    aiProvider: "gemini",
    apiKey: "",
    modelPriorityList: {
      gemini: ["gemini-1.5-flash", "gemini-1.5-pro"],
      openai: ["gpt-4o-mini", "gpt-4o"],
      xai: ["grok-beta"]
    },
    hobby: ""
  });

  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("user_settings");
    if (saved) {
      setSettings(JSON.parse(saved));
    }
  }, []);

  const handleSaveSettings = (updated: UserSettings) => {
    setSettings(updated);
    localStorage.setItem("user_settings", JSON.stringify(updated));
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
  };

  const handleResetApp = async () => {
    if (confirm("Xóa toàn bộ dữ liệu ứng dụng? Hành động này không thể hoàn tác.")) {
      await clearDatabase();
      localStorage.removeItem("user_settings");
      window.location.reload();
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 animate-pageFadeIn max-w-4xl mx-auto">
      {/* Main Settings Card */}
      <div className="lg:col-span-8 space-y-6">
        {/* Profile / Lang */}
        <div className="bg-white p-6 sm:p-8 rounded-[2rem] border border-slate-100 shadow-sm space-y-6">
          <div className="flex items-center gap-3 text-vibrant-indigo font-display font-black text-xl">
            <User size={24} className="text-vibrant-coral" />
            <h2>Cá nhân hóa</h2>
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ngôn ngữ mẹ đẻ</label>
              <input
                type="text"
                value={settings.nativeLanguage}
                onChange={(e) => handleSaveSettings({ ...settings, nativeLanguage: e.target.value })}
                className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-sm font-semibold outline-none focus:border-vibrant-indigo transition-all"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sở thích / Chủ đề quan tâm</label>
              <textarea
                value={settings.hobby}
                onChange={(e) => handleSaveSettings({ ...settings, hobby: e.target.value })}
                placeholder="Ví dụ: Công nghệ, nấu ăn, bóng đá..."
                rows={3}
                className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-sm font-medium outline-none focus:border-vibrant-indigo transition-all resize-none"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Side / Danger Zone */}
      <div className="lg:col-span-4 space-y-6">
        {/* Reset */}
        <div className="bg-rose-50 p-6 sm:p-8 rounded-[2rem] border border-rose-100 space-y-4">
          <h3 className="font-display font-black text-rose-900">Vùng nguy hiểm</h3>
          <p className="text-[10px] text-rose-700 font-medium leading-relaxed">
            Thao tác này sẽ xóa sạch toàn bộ nhật ký và cài đặt của bạn trên thiết bị này.
          </p>
          <button
            onClick={handleResetApp}
            className="flex items-center gap-2 bg-vibrant-coral text-white px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-md"
          >
            <RotateCcw size={14} /> Xóa dữ liệu
          </button>
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
