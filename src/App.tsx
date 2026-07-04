/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { BookOpen, Home, Settings, Sparkles, Volume2, Gamepad2, Layers } from "lucide-react";
import { preseedDatabaseIfEmpty } from "./db/indexedDb";
import { loadVoices } from "./utils/tts";
import { Chunk } from "./types";

// Views
import HomeView from "./components/HomeView";
import MyDiaryView from "./components/MyDiaryView";
import MyChunksView from "./components/MyChunksView";
import PracticeGameView from "./components/PracticeGameView";
import SettingsView from "./components/SettingsView";

export default function App() {
  const [activeTab, setActiveTab] = useState<string>("home");
  const [practiceQueue, setPracticeQueue] = useState<Chunk[]>([]);
  const [isDbReady, setIsDbReady] = useState(false);

  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Pre-seed default database with welcome entry and starter chunks
        await preseedDatabaseIfEmpty();
        // Load voices for SpeechSynthesis
        loadVoices();
        setIsDbReady(true);
      } catch (err) {
        console.error("Failed to initialize database:", err);
      }
    };
    initializeApp();
  }, []);

  const handleStartPractice = (chunksToPractice: Chunk[]) => {
    if (chunksToPractice.length === 0) {
      alert("Hàng đợi rỗng! Hãy chọn những chunks cụ thể để bắt đầu luyện nói.");
      return;
    }
    setPracticeQueue(chunksToPractice);
    setActiveTab("practice");
  };

  const handleFinishPractice = () => {
    setPracticeQueue([]);
    setActiveTab("chunks");
  };

  if (!isDbReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-vibrant-bg flex-col space-y-4">
        <div className="w-10 h-10 border-4 border-vibrant-indigo border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-slate-500 font-mono">Đang tải cấu trúc dữ liệu IndexedDB...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-vibrant-bg flex flex-col font-sans selection:bg-vibrant-mint/30 selection:text-vibrant-indigo">
      {/* Dynamic Header Navbar */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-slate-100 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          
          {/* Logo & Slogan */}
          <div onClick={() => setActiveTab("home")} className="flex items-center gap-2.5 cursor-pointer group">
            <div className="w-10 h-10 bg-vibrant-coral rounded-xl flex items-center justify-center text-white font-black shadow-md shadow-vibrant-coral/20 group-hover:scale-105 transition-transform">
              <Layers size={18} />
            </div>
            <div className="text-left">
              <span className="font-display font-black text-slate-900 text-sm sm:text-base tracking-tight block">
                ChunkDiary
              </span>
              <span className="text-[10px] text-slate-400 font-medium block leading-none">
                Write &bull; Understand &bull; Speak
              </span>
            </div>
          </div>

          {/* Nav Items */}
          <nav className="flex items-center gap-1 sm:gap-2">
            {[
              { id: "home", label: "Home", icon: <Home size={16} /> },
              { id: "diary", label: "My Diary", icon: <Sparkles size={16} /> },
              { id: "chunks", label: "My Chunks", icon: <BookOpen size={16} /> },
              { id: "settings", label: "Settings", icon: <Settings size={16} /> }
            ].map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  id={`nav-tab-${tab.id}`}
                  onClick={() => {
                    setPracticeQueue([]);
                    setActiveTab(tab.id);
                  }}
                  className={`flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl text-xs sm:text-sm font-semibold tracking-tight transition-all cursor-pointer ${
                    isActive
                      ? "bg-vibrant-indigo/10 text-vibrant-indigo font-black border border-vibrant-indigo/10"
                      : "text-slate-500 hover:text-slate-900 hover:bg-slate-100/70"
                  }`}
                >
                  {tab.icon}
                  <span className="hidden sm:inline">{tab.label}</span>
                </button>
              );
            })}
          </nav>

        </div>
      </header>

      {/* Main Content Stage container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {activeTab === "home" && (
          <HomeView
            onNavigate={(tab) => setActiveTab(tab)}
            onStartPractice={handleStartPractice}
          />
        )}

        {activeTab === "diary" && (
          <MyDiaryView
            onStartPractice={handleStartPractice}
            onNavigate={(tab) => setActiveTab(tab)}
          />
        )}

        {activeTab === "chunks" && (
          <MyChunksView
            onStartPractice={handleStartPractice}
          />
        )}

        {activeTab === "settings" && (
          <SettingsView />
        )}

        {activeTab === "practice" && (
          <PracticeGameView
            practiceList={practiceQueue}
            onFinish={handleFinishPractice}
          />
        )}

      </main>

      {/* Minimal Footer */}
      <footer className="bg-white border-t border-neutral-200/60 py-6">
        <div className="max-w-7xl mx-auto px-4 text-center space-y-1">
          <p className="text-xs text-neutral-400 font-light">
            &copy; 2026 Language Chunk Diary. All rights reserved.
          </p>
          <p className="text-[10px] text-neutral-300 font-mono">
            Powered by Gemini 3.5 &bull; Chunk-Based Pronunciation Method
          </p>
        </div>
      </footer>
    </div>
  );
}
