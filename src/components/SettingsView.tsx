import React, { useState, useEffect } from "react";
import {
  User,
  Languages,
  Shield,
  Sparkles,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  RotateCcw,
  Check,
  Smartphone,
  Trophy
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
      gemini: ["gemini-2.0-flash", "gemini-1.5-flash"],
      openai: ["gpt-4o-mini", "gpt-4o"],
      xai: ["grok-beta"]
    },
    hobby: "",
    nickname: "",
    learningGoal: ""
  });

  const [newModelName, setNewModelName] = useState("");
  const [newLanguage, setNewLanguage] = useState("");
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

  const handleProviderChange = (provider: "gemini" | "openai" | "xai") => {
    handleSaveSettings({ ...settings, aiProvider: provider });
  };

  const handleAddLanguage = () => {
    if (newLanguage.trim() && !settings.learningLanguages.includes(newLanguage.trim())) {
      handleSaveSettings({
        ...settings,
        learningLanguages: [...settings.learningLanguages, newLanguage.trim()]
      });
      setNewLanguage("");
    }
  };

  const handleRemoveLanguage = (lang: string) => {
    handleSaveSettings({
      ...settings,
      learningLanguages: settings.learningLanguages.filter(l => l !== lang)
    });
  };

  const handleResetApp = async () => {
    if (confirm("Xóa toàn bộ dữ liệu ứng dụng? Hành động này không thể hoàn tác.")) {
      await clearDatabase();
      localStorage.removeItem("user_settings");
      window.location.reload();
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 animate-pageFadeIn">
      {/* Left Col */}
      <div className="lg:col-span-6 space-y-6">
        {/* Profile / Lang */}
        <div className="bg-white p-6 sm:p-8 rounded-[2rem] border border-slate-100 shadow-sm space-y-6">
          <div className="flex items-center gap-3 text-vibrant-indigo font-display font-black text-xl">
            <User size={24} className="text-vibrant-coral" />
            <h2>Cá nhân hóa</h2>
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Biệt danh</label>
              <input
                type="text"
                value={settings.nickname || ""}
                onChange={(e) => handleSaveSettings({ ...settings, nickname: e.target.value })}
                className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-sm font-semibold outline-none focus:border-vibrant-indigo transition-all"
              />
            </div>

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
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Mục tiêu học tập</label>
              <textarea
                value={settings.learningGoal || ""}
                onChange={(e) => handleSaveSettings({ ...settings, learningGoal: e.target.value })}
                placeholder="Ví dụ: Giao tiếp đi làm, thi IELTS..."
                rows={2}
                className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-sm font-medium outline-none focus:border-vibrant-indigo transition-all resize-none"
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

        {/* Learning Languages */}
        <div className="bg-white p-6 sm:p-8 rounded-[2rem] border border-slate-100 shadow-sm space-y-6">
          <div className="flex items-center gap-3 text-vibrant-indigo font-display font-black text-xl">
            <Languages size={24} className="text-vibrant-mint" />
            <h2>Ngôn ngữ đang học</h2>
          </div>

          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {settings.learningLanguages.map((lang) => (
                <div key={lang} className="flex items-center gap-2 bg-vibrant-indigo/5 text-vibrant-indigo px-4 py-2 rounded-xl border border-vibrant-indigo/10">
                  <span className="text-xs font-bold">{lang}</span>
                  <button onClick={() => handleRemoveLanguage(lang)} className="text-vibrant-coral hover:scale-110 transition-transform">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Thêm ngôn ngữ (vd: French)..."
                value={newLanguage}
                onChange={(e) => setNewLanguage(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddLanguage()}
                className="flex-1 bg-slate-50 border border-slate-100 rounded-xl px-4 py-2 text-xs outline-none focus:border-vibrant-indigo"
              />
              <button
                onClick={handleAddLanguage}
                className="bg-vibrant-indigo text-white p-2 rounded-xl hover:bg-vibrant-indigo/90"
              >
                <Plus size={18} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Right Col */}
      <div className="lg:col-span-6 space-y-6">
        {/* AI Config */}
        <div className="bg-white p-6 sm:p-8 rounded-[2rem] border border-slate-100 shadow-sm space-y-6">
          <div className="flex items-center gap-3 text-vibrant-indigo font-display font-black text-xl">
            <Shield size={24} className="text-vibrant-indigo" />
            <h2>Cấu hình AI</h2>
          </div>

          <div className="space-y-5">
            <div className="flex gap-2 p-1 bg-slate-50 rounded-2xl">
              {(["gemini", "openai", "xai"] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => handleProviderChange(p)}
                  className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${
                    settings.aiProvider === p ? "bg-white text-vibrant-indigo shadow-sm" : "text-slate-400"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">API Key</label>
              <input
                type="password"
                value={settings.apiKey}
                onChange={(e) => handleSaveSettings({ ...settings, apiKey: e.target.value })}
                placeholder={`Nhập ${settings.aiProvider} API Key...`}
                className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-sm font-mono outline-none focus:border-vibrant-indigo transition-all"
              />
              <p className="text-[9px] text-slate-400 leading-relaxed italic">
                * Khóa này chỉ được lưu tại trình duyệt của bạn (localStorage).
              </p>
            </div>
          </div>
        </div>

        {/* Model Priority */}
        <div className="bg-white p-6 sm:p-8 rounded-[2rem] border border-slate-100 shadow-sm space-y-5">
          <div className="flex items-center justify-between border-b border-slate-50 pb-3">
            <div className="flex items-center gap-3 text-vibrant-indigo font-display font-black text-xl">
              <Sparkles size={24} className="text-vibrant-coral" />
              <h2>Mô hình</h2>
            </div>
            <span className="text-[9px] font-black bg-vibrant-indigo/10 text-vibrant-indigo px-2.5 py-1 rounded-full uppercase">
              {settings.aiProvider}
            </span>
          </div>

          <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
            {settings.modelPriorityList[settings.aiProvider].map((model, idx) => (
              <div key={model} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-xs font-bold text-slate-700 font-mono">{model}</span>
                <div className="flex items-center gap-1">
                  <button className="p-1.5 text-slate-300 hover:text-vibrant-indigo"><ArrowUp size={14} /></button>
                  <button className="p-1.5 text-slate-300 hover:text-vibrant-indigo"><ArrowDown size={14} /></button>
                  <button className="p-1.5 text-slate-300 hover:text-vibrant-coral"><Trash2 size={14} /></button>
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Thêm mô hình..."
              className="flex-1 bg-slate-50 border border-slate-100 rounded-xl px-4 py-2 text-xs outline-none"
            />
            <button className="bg-vibrant-indigo text-white p-2 rounded-xl"><Plus size={18} /></button>
          </div>
        </div>

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
