import React, { useState, useEffect } from "react";
import { BookOpen, Play, Star, Trash2, AlertCircle, Volume2 } from "lucide-react";
import { getChunks, deleteChunk } from "../db/indexedDb";
import { Chunk } from "../types";
import { speakText } from "../utils/tts";

interface MyChunksViewProps {
  onStartPractice: (chunks: Chunk[]) => void;
}

export default function MyChunksView({ onStartPractice }: MyChunksViewProps) {
  const [allChunks, setAllChunks] = useState<Chunk[]>([]);
  const [filteredChunks, setFilteredChunks] = useState<Chunk[]>([]);
  const [selectedLanguage, setSelectedLanguage] = useState("all");
  const [selectedStarFilter, setSelectedStarFilter] = useState("all");

  useEffect(() => {
    loadChunks();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [allChunks, selectedLanguage, selectedStarFilter]);

  const loadChunks = async () => {
    const list = await getChunks();
    setAllChunks(list);
  };

  const applyFilters = () => {
    let result = [...allChunks];
    if (selectedLanguage !== "all") {
      result = result.filter((c) => c.language.toLowerCase() === selectedLanguage.toLowerCase());
    }
    if (selectedStarFilter !== "all") {
      const starVal = parseInt(selectedStarFilter, 10);
      result = result.filter((c) => c.stars === starVal);
    }
    setFilteredChunks(result);
  };

  const handleDeleteChunk = async (id: string) => {
    if (confirm("Bạn có chắc chắn muốn xóa chunk này khỏi thư viện?")) {
      await deleteChunk(id);
      loadChunks();
    }
  };

  const uniqueLanguages = Array.from(new Set(allChunks.map((c) => c.language)));

  // Statistics calculation
  const totalChunks = allChunks.length;
  const totalPronunciations = allChunks.reduce((sum, chunk) => sum + (chunk.timesPracticed || 0), 0);
  const starCounts = {
    0: allChunks.filter((c) => (c.stars || 0) === 0).length,
    1: allChunks.filter((c) => c.stars === 1).length,
    2: allChunks.filter((c) => c.stars === 2).length,
    3: allChunks.filter((c) => c.stars === 3).length,
    4: allChunks.filter((c) => c.stars === 4).length,
    5: allChunks.filter((c) => c.stars === 5).length,
  };

  return (
    <div className="space-y-6 sm:space-y-8 animate-pageFadeIn text-left">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-6 sm:p-8 rounded-[2rem] border border-slate-100 shadow-sm">
        <div className="space-y-1">
          <h2 className="font-display text-xl sm:text-2xl font-black text-slate-900 flex items-center gap-2.5">
            <BookOpen className="text-vibrant-indigo" />
            Thư Viện Chunks
          </h2>
          <p className="text-[10px] sm:text-xs text-slate-500 font-medium">
            Lưu giữ và rèn luyện các cụm từ hàng ngày.
          </p>
        </div>

        {filteredChunks.length > 0 && (
          <button
            onClick={() => onStartPractice(filteredChunks)}
            className="flex items-center gap-2 bg-vibrant-coral hover:bg-vibrant-coral/90 text-white px-5 sm:px-6 py-3 rounded-2xl font-black shadow-lg shadow-vibrant-coral/20 transition-all active:scale-95 w-full sm:w-auto justify-center text-xs uppercase tracking-tight cursor-pointer border-none"
          >
            <Play size={16} fill="currentColor" />
            Luyện Tập ({filteredChunks.length})
          </button>
        )}
      </div>

      {/* Dashboard Statistics Widget */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 sm:gap-6 text-left">
        {/* Card 1: Total Chunks */}
        <div className="md:col-span-4 bg-white p-6 sm:p-8 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tổng số Chunks</span>
            <div className="p-2.5 bg-vibrant-indigo/10 text-vibrant-indigo rounded-xl">
              <BookOpen size={18} />
            </div>
          </div>
          <div>
            <h3 className="font-display text-3xl sm:text-4xl font-black text-vibrant-indigo">{totalChunks}</h3>
            <p className="text-[10px] sm:text-xs text-slate-500 font-medium mt-1">Cụm từ đã lưu trữ trong thiết bị</p>
          </div>
        </div>

        {/* Card 2: Total Pronunciations */}
        <div className="md:col-span-4 bg-white p-6 sm:p-8 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Đã phát âm</span>
            <div className="p-2.5 bg-vibrant-coral/10 text-vibrant-coral rounded-xl">
              <Volume2 size={18} />
            </div>
          </div>
          <div>
            <h3 className="font-display text-3xl sm:text-4xl font-black text-vibrant-coral">{totalPronunciations} LẦN</h3>
            <p className="text-[10px] sm:text-xs text-slate-500 font-medium mt-1">Tổng lượt ghi âm phát âm thành công</p>
          </div>
        </div>

        {/* Card 3: Stars distribution breakdown */}
        <div className="md:col-span-4 bg-white p-6 sm:p-8 rounded-[2rem] border border-slate-100 shadow-sm space-y-3.5">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block pb-1 border-b border-slate-100">Phân loại số sao</span>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 pt-1">
            {[5, 4, 3, 2, 1, 0].map((star) => (
              <div key={star} className="flex items-center justify-between text-xs font-semibold">
                <div className="flex items-center gap-1 text-slate-500 font-mono">
                  {star > 0 ? (
                    <>
                      <span className="font-black text-slate-700">{star}</span>
                      <Star size={11} className="text-vibrant-yellow" fill="currentColor" />
                    </>
                  ) : (
                    <span className="text-[10px] font-black text-slate-400 uppercase">Chưa luyện</span>
                  )}
                </div>
                <span className="font-bold font-mono text-slate-800 bg-slate-50 px-2 py-0.5 rounded-lg border border-slate-100">
                  {starCounts[star as 0 | 1 | 2 | 3 | 4 | 5]} câu
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 bg-white p-4 sm:p-5 rounded-[2rem] border border-slate-100 shadow-sm">
        <select
          value={selectedLanguage}
          onChange={(e) => setSelectedLanguage(e.target.value)}
          className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-sm font-medium outline-none transition-all cursor-pointer"
        >
          <option value="all">Tất cả ngôn ngữ</option>
          {uniqueLanguages.map((l) => (
            <option key={l} value={l}>{l}</option>
          ))}
        </select>
        <select
          value={selectedStarFilter}
          onChange={(e) => setSelectedStarFilter(e.target.value)}
          className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-sm font-medium outline-none transition-all cursor-pointer"
        >
          <option value="all">Tất cả số sao</option>
          <option value="0">Chưa luyện (0 sao)</option>
          <option value="1">1 sao (Yếu)</option>
          <option value="2">2 sao (Khá)</option>
          <option value="3">3 sao (Tốt)</option>
          <option value="4">4 sao (Rất tốt)</option>
          <option value="5">5 sao (Xuất sắc)</option>
        </select>
      </div>

      {/* Chunks List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {filteredChunks.map((chunk) => (
          <div
            key={chunk.id}
            className="bg-white rounded-[2rem] border border-slate-100 hover:border-vibrant-indigo/30 hover:shadow-md shadow-sm p-6 flex flex-col justify-between transition-all group"
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="bg-vibrant-indigo/10 text-vibrant-indigo font-black text-[10px] uppercase px-2 py-0.5 rounded-lg">
                  {chunk.language}
                </span>
                <div className="flex items-center gap-0.5">
                  {Array.from({ length: 5 }).map((_, idx) => {
                    const isFilled = idx < chunk.stars;
                    return (
                      <Star
                        key={idx}
                        size={12}
                        className={isFilled ? "text-vibrant-yellow" : "text-slate-100"}
                        fill={isFilled ? "currentColor" : "none"}
                      />
                    );
                  })}
                </div>
              </div>
              <div className="space-y-1">
                <h3 className="font-display font-black text-slate-900 text-lg group-hover:text-vibrant-indigo transition-colors leading-tight">
                  {chunk.text}
                </h3>
                <p className="text-[10px] sm:text-xs text-slate-500 font-medium italic">
                  Ý nghĩa: <span className="font-bold text-slate-700">{chunk.meaning}</span>
                </p>
              </div>
              <div className="space-y-1 bg-slate-50 p-3 rounded-2xl border border-slate-100 text-[10px] sm:text-[11px] font-mono">
                {chunk.ipa && (
                  <div className="text-slate-500">IPA: <span className="text-vibrant-indigo font-bold">{chunk.ipa}</span></div>
                )}
                {chunk.romanization && (
                  <div className="text-vibrant-coral font-bold">Roman: <span className="font-medium">{chunk.romanization}</span></div>
                )}
              </div>
            </div>
            <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between">
              <div className="text-[9px] sm:text-[10px] text-slate-400 font-mono font-medium">
                {chunk.timesPracticed > 0 ? (
                  <div>Best: <strong className="text-vibrant-mint">{chunk.bestAccuracy}%</strong> | {chunk.timesPracticed} lần</div>
                ) : (
                  <div className="italic text-slate-300">Chưa luyện tập</div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => handleDeleteChunk(chunk.id)} className="p-2 text-slate-300 hover:text-vibrant-coral transition-all cursor-pointer border-none bg-transparent"><Trash2 size={14} /></button>
                <button onClick={() => speakText(chunk.text, chunk.language)} className="p-2.5 bg-slate-50 rounded-xl transition-all cursor-pointer border-none">🔊</button>
                <button onClick={() => onStartPractice([chunk])} className="p-2.5 bg-vibrant-indigo/10 text-vibrant-indigo rounded-xl transition-all cursor-pointer border-none"><Play size={14} fill="currentColor" /></button>
              </div>
            </div>
          </div>
        ))}
        {filteredChunks.length === 0 && (
          <div className="col-span-full bg-white border border-slate-100 p-10 rounded-[2rem] flex flex-col items-center justify-center text-slate-400 text-center space-y-2">
            <AlertCircle size={32} className="text-slate-200" />
            <p className="text-sm font-black text-slate-700">Không tìm thấy dữ liệu.</p>
          </div>
        )}
      </div>
    </div>
  );
}
