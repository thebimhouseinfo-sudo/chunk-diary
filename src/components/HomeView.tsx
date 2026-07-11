import React, { useState, useEffect } from "react";
import { BookOpen, Flame, Award, Star, PlayCircle, PlusCircle, Languages, Sparkles } from "lucide-react";
import { getDiaries, getChunks } from "../db/indexedDb";
import { Diary, Chunk, UserSettings } from "../types";

interface HomeViewProps {
  onNavigate: (tab: string) => void;
  onStartPractice: (chunks: Chunk[]) => void;
}

export default function HomeView({ onNavigate, onStartPractice }: HomeViewProps) {
  const [diaries, setDiaries] = useState<Diary[]>([]);
  const [chunks, setChunks] = useState<Chunk[]>([]);
  const [streak, setStreak] = useState(0);
  const [settings, setSettings] = useState<UserSettings | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      const allDiaries = await getDiaries();
      const allChunks = await getChunks();
      setDiaries(allDiaries);
      setChunks(allChunks);

      const savedSettings = localStorage.getItem("user_settings");
      if (savedSettings) {
        setSettings(JSON.parse(savedSettings));
      }

      setStreak(allDiaries.length > 0 ? 3 : 0);
    };
    fetchData();
  }, []);

  const starCounts = {
    5: chunks.filter((c) => c.stars === 5).length,
    4: chunks.filter((c) => c.stars === 4).length,
    3: chunks.filter((c) => c.stars === 3).length,
    2: chunks.filter((c) => c.stars === 2).length,
    1: chunks.filter((c) => c.stars === 1).length,
  };

  const unpracticedCount = chunks.filter((c) => (c.stars || 0) === 0).length;

  return (
    <div className="space-y-6 sm:space-y-10 animate-pageFadeIn">
      {/* Hero Welcome Card */}
      <div className="relative overflow-hidden bg-vibrant-indigo rounded-[2rem] sm:rounded-[3rem] p-6 sm:p-12 text-white shadow-2xl shadow-vibrant-indigo/20 text-left">
        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
          <Sparkles size={120} />
        </div>

        <div className="relative z-10 space-y-4 sm:space-y-6 max-w-2xl">
          <span className="inline-block px-3 py-1 rounded-full bg-white/20 text-white text-[10px] sm:text-xs font-black uppercase tracking-widest backdrop-blur-md">
            Language Mastery
          </span>
          <h1 className="font-display text-3xl sm:text-5xl font-black tracking-tight leading-tight">
            Language Chunk Diary
          </h1>
          <p className="text-slate-200 text-sm sm:text-lg font-medium leading-relaxed opacity-90">
            Học ngoại ngữ từ chính cuộc sống hàng ngày. Biến trải nghiệm của bạn thành những language chunks tự nhiên để làm chủ phát âm chuẩn bản xứ.
          </p>
          <div className="pt-2 sm:pt-4 flex flex-col sm:flex-row gap-3 sm:gap-4">
            <button
              onClick={() => onNavigate("diary")}
              className="flex items-center justify-center gap-2 bg-vibrant-coral hover:bg-vibrant-coral/90 text-white px-6 sm:px-7 py-3 sm:py-3.5 rounded-2xl font-black shadow-lg shadow-vibrant-coral/20 uppercase tracking-tight transition-all active:scale-95 cursor-pointer text-sm border-none"
            >
              <PlusCircle size={18} />
              Viết Nhật Ký Mới
            </button>
            <button
              onClick={() => onNavigate("chunks")}
              className="flex items-center justify-center gap-2 bg-vibrant-mint hover:bg-vibrant-mint/90 text-slate-900 px-6 sm:px-7 py-3 sm:py-3.5 rounded-2xl font-black shadow-md transition-all active:scale-95 cursor-pointer text-sm border-none"
            >
              <BookOpen size={18} />
              Thư Viện Chunks
            </button>
          </div>
        </div>
      </div>

      {/* Grid Statistics (Bento Grid) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 text-left">
        {/* Streak card */}
        <div className="bg-white p-5 sm:p-6 rounded-[2rem] sm:rounded-[2.5rem] border border-slate-100 shadow-sm flex items-center justify-between">
          <div className="space-y-0.5">
            <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Luyện tập</p>
            <p className="font-display text-2xl sm:text-4xl font-black text-vibrant-mint">{streak} NGÀY</p>
            <p className="text-[10px] sm:text-xs text-slate-500 font-medium">Duy trì thói quen!</p>
          </div>
          <div className={`p-3 sm:p-4 rounded-2xl ${streak > 0 ? "bg-vibrant-mint/20 text-vibrant-indigo" : "bg-slate-100 text-slate-400"}`}>
            <Flame size={24} fill={streak > 0 ? "currentColor" : "none"} />
          </div>
        </div>

        {/* Total Diaries */}
        <div className="bg-white p-5 sm:p-6 rounded-[2rem] sm:rounded-[2.5rem] border border-slate-100 shadow-sm flex items-center justify-between">
          <div className="space-y-0.5">
            <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Nhật ký</p>
            <p className="font-display text-2xl sm:text-4xl font-black text-vibrant-indigo">{diaries.length}</p>
            <p className="text-[10px] sm:text-xs text-slate-500 font-medium">Bài đã viết</p>
          </div>
          <div className="p-3 sm:p-4 bg-vibrant-indigo/10 text-vibrant-indigo rounded-2xl">
            <BookOpen size={24} />
          </div>
        </div>

        {/* Total Chunks */}
        <div className="bg-white p-5 sm:p-6 rounded-[2rem] sm:rounded-[2.5rem] border border-slate-100 shadow-sm flex items-center justify-between">
          <div className="space-y-0.5">
            <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Chunks</p>
            <p className="font-display text-2xl sm:text-4xl font-black text-vibrant-coral">{chunks.length}</p>
            <p className="text-[10px] sm:text-xs text-slate-500 font-medium">{unpracticedCount} chưa luyện</p>
          </div>
          <div className="p-3 sm:p-4 bg-vibrant-coral/10 text-vibrant-coral rounded-2xl">
            <Award size={24} />
          </div>
        </div>
      </div>

      {/* Mastery Stats Only (Full Width) */}
      <div className="bg-white p-6 sm:p-8 rounded-[2rem] sm:rounded-[2.5rem] border border-slate-100 shadow-sm space-y-6 text-left w-full">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h2 className="font-display text-lg sm:text-xl font-black text-slate-900">Tiến trình thành thạo</h2>
            <p className="text-[10px] sm:text-xs text-slate-500 font-medium">Phát âm 5 sao để làm chủ.</p>
          </div>
          <div className="flex items-center gap-1 bg-vibrant-yellow/30 text-slate-900 font-mono text-[10px] px-2.5 py-1.5 rounded-full border border-vibrant-yellow">
            <Star size={12} className="text-slate-900" fill="currentColor" />
            <span className="font-black">MASTERY</span>
          </div>
        </div>

        <div className="space-y-3 sm:space-y-4">
          {[5, 4, 3, 2, 1].map((star) => {
            const count = starCounts[star as 1 | 2 | 3 | 4 | 5];
            const percentage = chunks.length > 0 ? Math.round((count / chunks.length) * 100) : 0;

            return (
              <div key={star} className="flex items-center gap-3">
                <div className="w-10 sm:w-14 flex items-center gap-1 font-mono text-xs sm:text-sm text-slate-600">
                  <span className="font-black">{star}</span>
                  <Star size={12} className="text-vibrant-yellow" fill="currentColor" />
                </div>
                <div className="flex-1 bg-slate-100 h-2 sm:h-3 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      star === 5 ? "bg-vibrant-mint" : star === 4 ? "bg-vibrant-coral" : star === 3 ? "bg-vibrant-yellow" : star === 2 ? "bg-vibrant-indigo" : "bg-slate-400"
                    }`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
                <div className="w-20 sm:w-24 text-right text-[10px] sm:text-xs text-slate-500">
                  <span className="font-bold text-slate-700 font-mono text-xs">{count}</span>
                  <span className="ml-1 text-[10px] text-slate-400 font-mono hidden sm:inline">({percentage}%)</span>
                </div>
              </div>
            );
          })}
        </div>

        {chunks.length > 0 && (
          <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-[10px] sm:text-xs text-slate-500 font-medium">
            <span>Chưa luyện: <strong className="text-slate-800 font-mono">{unpracticedCount}</strong> chunks</span>
            {chunks.filter(c => (c.stars || 0) > 0 && (c.stars || 0) < 4).length > 0 && (
              <button
                onClick={() => {
                  const lowStars = chunks.filter(c => (c.stars || 0) > 0 && (c.stars || 0) < 4);
                  onStartPractice(lowStars);
                }}
                className="flex items-center gap-1.5 text-vibrant-indigo hover:text-vibrant-indigo/80 font-black cursor-pointer bg-vibrant-indigo/5 px-4 py-2 rounded-xl transition-all w-full sm:w-auto justify-center border-none"
              >
                <PlayCircle size={14} />
                Luyện câu yếu (1-3 sao)
              </button>
            )}
          </div>
        )}
      </div>

      {/* Philosophy Callout */}
      <div className="bg-vibrant-mint rounded-2xl sm:rounded-3xl p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 text-left">
        <div className="space-y-0.5 sm:space-y-1">
          <p className="text-slate-900 font-display font-black text-base sm:text-lg">Học bằng cụm từ (Chunking)</p>
          <p className="text-slate-800/90 text-[10px] sm:text-sm font-medium leading-relaxed">
            Thay vì học từ rời rạc, hãy nhớ các cụm từ hoàn chỉnh từ cuộc sống để nói tự nhiên hơn.
          </p>
        </div>
        <div className="bg-slate-900 text-white font-mono text-[10px] font-black tracking-wider px-3 py-1.5 rounded-lg shrink-0 uppercase">
          CHUNKS OVER GRAMMAR
        </div>
      </div>
    </div>
  );
}
