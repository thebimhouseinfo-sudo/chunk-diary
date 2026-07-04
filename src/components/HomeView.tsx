import React, { useEffect, useState } from "react";
import { BookOpen, Award, Flame, Languages, Star, PlusCircle, PlayCircle } from "lucide-react";
import { Diary, Chunk, PracticeHistory, UserSettings } from "../types";
import { getDiaries, getChunks, getHistory, getSettings } from "../db/indexedDb";

interface HomeViewProps {
  onNavigate: (tab: string) => void;
  onStartPractice: (chunks: Chunk[]) => void;
}

export default function HomeView({ onNavigate, onStartPractice }: HomeViewProps) {
  const [diaries, setDiaries] = useState<Diary[]>([]);
  const [chunks, setChunks] = useState<Chunk[]>([]);
  const [history, setHistory] = useState<PracticeHistory[]>([]);
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [streak, setStreak] = useState(0);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const d = await getDiaries();
    const c = await getChunks();
    const h = await getHistory();
    const s = await getSettings();
    setDiaries(d);
    setChunks(c);
    setHistory(h);
    setSettings(s);

    calculateStreak(h);
  };

  const calculateStreak = (historyList: PracticeHistory[]) => {
    if (historyList.length === 0) {
      setStreak(0);
      return;
    }

    // Extract unique dates as YYYY-MM-DD
    const uniqueDates = Array.from(
      new Set(
        historyList.map((item) => {
          const d = new Date(item.date);
          return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        })
      )
    ).sort((a, b) => new Date(b).getTime() - new Date(a).getTime()); // Sort descending (newest first)

    if (uniqueDates.length === 0) {
      setStreak(0);
      return;
    }

    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, "0")}-${String(yesterday.getDate()).padStart(2, "0")}`;

    // Streak is active if user practiced today or yesterday
    if (uniqueDates[0] !== todayStr && uniqueDates[0] !== yesterdayStr) {
      setStreak(0);
      return;
    }

    let currentStreak = 1;
    for (let i = 0; i < uniqueDates.length - 1; i++) {
      const d1 = new Date(uniqueDates[i]);
      const d2 = new Date(uniqueDates[i + 1]);
      const diffTime = Math.abs(d1.getTime() - d2.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays === 1) {
        currentStreak++;
      } else if (diffDays > 1) {
        break; // Streak broken
      }
    }
    setStreak(currentStreak);
  };

  // Star stats
  const starCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let unpracticedCount = 0;
  chunks.forEach((c) => {
    if (c.stars >= 1 && c.stars <= 5) {
      starCounts[c.stars as 1 | 2 | 3 | 4 | 5]++;
    } else {
      unpracticedCount++;
    }
  });

  return (
    <div id="home-view" className="space-y-10 page-fade-enter page-fade-enter-active text-left">
      {/* Hero Welcome */}
      <div className="bg-vibrant-indigo rounded-[2.5rem] p-10 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 bottom-0 opacity-10 pointer-events-none transform translate-x-12 translate-y-12">
          <Languages size={320} />
        </div>
        <div className="max-w-2xl relative z-10 space-y-6">
          <span className="bg-white/10 text-vibrant-mint font-mono text-xs uppercase tracking-widest px-3.5 py-1.5 rounded-full border border-white/10">
            Write your life &bull; Speak until mastery
          </span>
          <h1 className="font-display text-4xl sm:text-5xl font-black tracking-tight leading-tight">
            Language Chunk Diary
          </h1>
          <p className="text-slate-200 text-base sm:text-lg font-medium leading-relaxed opacity-90">
            Học ngoại ngữ từ chính cuộc sống hàng ngày. Biến trải nghiệm của bạn thành những language chunks tự nhiên để làm chủ phát âm chuẩn bản xứ.
          </p>
          <div className="pt-4 flex flex-wrap gap-4">
            <button
              id="btn-nav-diary"
              onClick={() => onNavigate("diary")}
              className="flex items-center gap-2 bg-vibrant-coral hover:bg-vibrant-coral/90 text-white px-7 py-3.5 rounded-2xl font-black shadow-lg shadow-vibrant-coral/20 uppercase tracking-tight transition-all active:scale-95 cursor-pointer"
            >
              <PlusCircle size={18} />
              Viết Nhật Ký Mới
            </button>
            <button
              id="btn-nav-chunks"
              onClick={() => onNavigate("chunks")}
              className="flex items-center gap-2 bg-vibrant-mint hover:bg-vibrant-mint/90 text-slate-900 px-7 py-3.5 rounded-2xl font-black shadow-md transition-all active:scale-95 cursor-pointer"
            >
              <BookOpen size={18} />
              Thư Viện Chunks
            </button>
          </div>
        </div>
      </div>

      {/* Grid Statistics (Bento Grid) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Streak card */}
        <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-slate-400 text-xs font-black uppercase tracking-widest">Luyện tập liên tiếp</p>
            <p className="font-display text-4xl font-black text-vibrant-mint">{streak} NGÀY</p>
            <p className="text-xs text-slate-500 font-medium">Duy trì thói quen viết &amp; đọc!</p>
          </div>
          <div className={`p-4 rounded-2xl ${streak > 0 ? "bg-vibrant-mint/20 text-vibrant-indigo animate-pulse" : "bg-slate-100 text-slate-400"}`}>
            <Flame size={28} fill={streak > 0 ? "currentColor" : "none"} />
          </div>
        </div>

        {/* Total Diaries */}
        <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-slate-400 text-xs font-black uppercase tracking-widest">Nhật ký đã viết</p>
            <p className="font-display text-4xl font-black text-vibrant-indigo">{diaries.length}</p>
            <p className="text-xs text-slate-500 font-medium">Cuộc sống của bạn bằng ngoại ngữ.</p>
          </div>
          <div className="p-4 bg-vibrant-indigo/10 text-vibrant-indigo rounded-2xl">
            <BookOpen size={28} />
          </div>
        </div>

        {/* Total Chunks */}
        <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-slate-400 text-xs font-black uppercase tracking-widest">Language Chunks</p>
            <p className="font-display text-4xl font-black text-vibrant-coral">{chunks.length}</p>
            <p className="text-xs text-slate-500 font-medium">{unpracticedCount} cụm từ chưa được luyện.</p>
          </div>
          <div className="p-4 bg-vibrant-coral/10 text-vibrant-coral rounded-2xl">
            <Award size={28} />
          </div>
        </div>
      </div>

      {/* Target Languages & Mastery Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Stars stats breakdown */}
        <div className="lg:col-span-7 bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h2 className="font-display text-xl font-black text-slate-900">Tiến trình thành thạo</h2>
              <p className="text-xs text-slate-500 font-medium">Đạt 5 sao phát âm chính xác để làm chủ.</p>
            </div>
            <div className="flex items-center gap-1.5 bg-vibrant-yellow/35 text-slate-900 font-mono text-xs px-3 py-1.5 rounded-full border border-vibrant-yellow">
              <Star size={14} className="text-slate-900" fill="currentColor" />
              <span className="font-black">PHÁT ÂM CHUẨN</span>
            </div>
          </div>

          <div className="space-y-4">
            {[5, 4, 3, 2, 1].map((star) => {
              const count = starCounts[star as 1 | 2 | 3 | 4 | 5];
              const percentage = chunks.length > 0 ? Math.round((count / chunks.length) * 100) : 0;
              
              return (
                <div key={star} className="flex items-center gap-3">
                  <div className="w-14 flex items-center gap-1 font-mono text-sm text-slate-600">
                    <span className="font-black">{star}</span>
                    <Star size={14} className="text-vibrant-yellow" fill="currentColor" />
                  </div>
                  <div className="flex-1 bg-slate-100 h-3 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        star === 5
                          ? "bg-vibrant-mint"
                          : star === 4
                          ? "bg-vibrant-coral"
                          : star === 3
                          ? "bg-vibrant-yellow"
                          : star === 2
                          ? "bg-vibrant-indigo"
                          : "bg-slate-400"
                      }`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  <div className="w-24 text-right text-xs text-slate-500">
                    <span className="font-bold text-slate-700 font-mono">{count} chunks</span>
                    <span className="ml-1 text-[10px] text-slate-400 font-mono">({percentage}%)</span>
                  </div>
                </div>
              );
            })}
          </div>

          {chunks.length > 0 && (
            <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 font-medium">
              <span>Chưa luyện phát âm: <strong className="text-slate-800 font-mono">{unpracticedCount}</strong> chunks</span>
              {chunks.filter(c => c.stars > 0 && c.stars < 4).length > 0 && (
                <button
                  onClick={() => {
                    const lowStars = chunks.filter(c => c.stars > 0 && c.stars < 4);
                    onStartPractice(lowStars);
                  }}
                  className="flex items-center gap-1.5 text-vibrant-indigo hover:text-vibrant-indigo/80 font-black cursor-pointer bg-vibrant-indigo/5 px-3 py-1.5 rounded-xl transition-all"
                >
                  <PlayCircle size={14} />
                  Luyện câu yếu (1-3 sao)
                </button>
              )}
            </div>
          )}
        </div>

        {/* Current target languages card */}
        <div className="lg:col-span-5 bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col justify-between space-y-6">
          <div className="space-y-4">
            <div className="space-y-1">
              <h2 className="font-display text-xl font-black text-slate-900">Ngôn ngữ học</h2>
              <p className="text-xs text-slate-500 font-medium">Cấu hình mục tiêu ngôn ngữ trong phần Cài Đặt.</p>
            </div>

            <div className="flex flex-wrap gap-3 pt-2">
              {settings?.learningLanguages.map((lang) => {
                const count = chunks.filter(c => c.language.toLowerCase() === lang.toLowerCase()).length;
                return (
                  <div
                    key={lang}
                    className="flex-1 min-w-[110px] bg-slate-50 hover:bg-slate-100/80 border border-slate-100 p-4 rounded-3xl text-center transition-all"
                  >
                    <Languages className="mx-auto text-vibrant-indigo mb-2" size={24} />
                    <span className="block font-bold text-slate-800 text-sm">{lang}</span>
                    <span className="font-mono text-xs text-slate-400">{count} chunks</span>
                  </div>
                );
              })}
              {(!settings || settings.learningLanguages.length === 0) && (
                <div className="w-full text-center py-6 text-slate-400 text-sm italic">
                  Chưa chọn ngôn ngữ học nào. Hãy vào Cài Đặt!
                </div>
              )}
            </div>
          </div>

          <button
            onClick={() => onNavigate("settings")}
            className="w-full py-3.5 text-center bg-slate-100 hover:bg-slate-200/80 text-slate-700 font-bold text-xs rounded-2xl transition-all cursor-pointer"
          >
            Thay Đổi Ngôn Ngữ &bull; Cấu Hình AI
          </button>
        </div>
      </div>

      {/* Philosophy Callout */}
      <div className="bg-vibrant-mint rounded-3xl p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <p className="text-slate-900 font-display font-black text-lg">Học bằng cụm từ (Chunking Method)</p>
          <p className="text-slate-800/90 text-sm font-medium">
            Thay vì học thuộc lòng từ vựng rời rạc, hãy ghi nhớ các cụm từ hoàn chỉnh phát sinh từ cuộc sống thật để nói trôi chảy và tự nhiên nhất.
          </p>
        </div>
        <div className="bg-slate-900 text-white font-mono text-xs font-black tracking-wider px-4 py-2 rounded-xl shrink-0 uppercase">
          CHUNKS OVER GRAMMAR
        </div>
      </div>
    </div>
  );
}
