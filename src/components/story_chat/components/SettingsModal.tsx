import React from "react";
import { StorySettings } from "../models/types";

interface SettingsModalProps {
  settings: StorySettings;
  onUpdateSettings: (settings: Partial<StorySettings>) => void;
  onClose: () => void;
  onEndStory: () => void;
}

export default function SettingsModal({
  settings,
  onUpdateSettings,
  onClose,
  onEndStory
}: SettingsModalProps) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 backdrop-blur-xs">
      <div className="bg-white rounded-3xl max-w-[350px] w-full p-6 shadow-2xl animate-fade-in">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-bold text-slate-800">Cài đặt</h3>
          <button 
            onClick={onClose} 
            className="text-slate-400 hover:text-slate-600 text-lg font-bold cursor-pointer"
          >
            ✕
          </button>
        </div>

        <div className="space-y-6">
          {/* Appearance */}
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
              Giao diện
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(["system", "light", "dark"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => onUpdateSettings({ theme: t })}
                  className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-colors capitalize cursor-pointer ${
                    settings.theme === t
                      ? "bg-vibrant-indigo text-white border-vibrant-indigo"
                      : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Default Input Mode */}
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
              Phương thức nhập mặc định
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(["voice", "typing"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => onUpdateSettings({ defaultInputMode: m })}
                  className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-colors capitalize cursor-pointer ${
                    settings.defaultInputMode === m
                      ? "bg-vibrant-indigo text-white border-vibrant-indigo"
                      : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  {m === "voice" ? "🎤 Giọng nói" : "⌨️ Bàn phím"}
                </button>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="pt-4 border-t border-slate-100">
            <button
              onClick={() => {
                onEndStory();
                onClose();
              }}
              className="w-full py-3.5 px-4 bg-vibrant-coral text-white font-black uppercase tracking-tight rounded-xl text-xs transition-transform hover:opacity-95 shadow-md shadow-vibrant-coral/20 cursor-pointer border-none"
            >
              End Story (Tạo chunks)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
