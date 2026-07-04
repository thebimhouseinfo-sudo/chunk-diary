import React, { useState, useEffect } from "react";
import { Filter, Play, Star, Trash2, Calendar, BookOpen, Award, Sparkles, AlertCircle } from "lucide-react";
import { Chunk } from "../types";
import { getChunks, deleteChunk } from "../db/indexedDb";
import { speakText } from "../utils/tts";

interface MyChunksViewProps {
  onStartPractice: (chunks: Chunk[]) => void;
}

export default function MyChunksView({ onStartPractice }: MyChunksViewProps) {
  const [allChunks, setAllChunks] = useState<Chunk[]>([]);
  const [filteredChunks, setFilteredChunks] = useState<Chunk[]>([]);
  
  // Filters
  const [selectedLanguage, setSelectedLanguage] = useState("all");
  const [selectedStarFilter, setSelectedStarFilter] = useState("all"); // "all", "0", "1", "2", "3", "4", "5"

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

    // Language filter
    if (selectedLanguage !== "all") {
      result = result.filter((c) => c.language.toLowerCase() === selectedLanguage.toLowerCase());
    }

    // Star level filter
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

  // Get unique languages for filter dropdown
  const uniqueLanguages = Array.from(new Set(allChunks.map((c) => c.language)));

  return (
    <div id="my-chunks-view" className="space-y-6 page-fade-enter page-fade-enter-active text-left">
      {/* Header and Practice Trigger */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm">
        <div className="space-y-1">
          <h2 className="font-display text-2xl font-black text-slate-900 flex items-center gap-2.5">
            <BookOpen className="text-vibrant-indigo" />
            Thư Viện Chunks Học
          </h2>
          <p className="text-xs text-slate-500 font-medium">
            Nơi lưu giữ các cụm từ đắt giá của bạn. Lọc và luyện nói hàng ngày để đạt mốc 5 sao phát âm chuẩn.
          </p>
        </div>

        {filteredChunks.length > 0 && (
          <button
            id="btn-practice-filtered"
            onClick={() => onStartPractice(filteredChunks)}
            className="flex items-center gap-2 bg-vibrant-coral hover:bg-vibrant-coral/90 text-white px-6 py-3.5 rounded-2xl font-black shadow-lg shadow-vibrant-coral/20 transition-all active:scale-95 cursor-pointer w-full sm:w-auto justify-center text-xs uppercase tracking-tight"
          >
            <Play size={16} fill="currentColor" />
            Luyện Câu Đang Lọc ({filteredChunks.length})
          </button>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm">
        {/* Language select */}
        <div>
          <select
            id="filter-lang"
            value={selectedLanguage}
            onChange={(e) => setSelectedLanguage(e.target.value)}
            className="w-full bg-slate-50 hover:bg-slate-100 border border-slate-100 rounded-2xl px-4 py-3 text-sm font-medium outline-none transition-all cursor-pointer"
          >
            <option value="all">Tất cả ngôn ngữ</option>
            {uniqueLanguages.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </div>

        {/* Stars select */}
        <div>
          <select
            id="filter-stars"
            value={selectedStarFilter}
            onChange={(e) => setSelectedStarFilter(e.target.value)}
            className="w-full bg-slate-50 hover:bg-slate-100 border border-slate-100 rounded-2xl px-4 py-3 text-sm font-medium outline-none transition-all cursor-pointer"
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
      </div>

      {/* Chunks List Display */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredChunks.map((chunk) => {
          return (
            <div
              key={chunk.id}
              className="bg-white rounded-[2rem] border border-slate-100 hover:border-vibrant-indigo/30 hover:shadow-md shadow-sm p-6 flex flex-col justify-between transition-all group relative"
            >
              <div className="space-y-4">
                {/* Badge and Title */}
                <div className="flex items-center justify-between">
                  <span className="bg-vibrant-indigo/10 text-vibrant-indigo font-black text-[10px] uppercase tracking-wide px-2.5 py-0.5 rounded-lg">
                    {chunk.language}
                  </span>
                  
                  {/* Stars rendering */}
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

                {/* Text & Meaning */}
                <div className="space-y-1">
                  <h3 className="font-display font-black text-slate-900 text-lg sm:text-xl group-hover:text-vibrant-indigo transition-colors leading-tight">
                    {chunk.text}
                  </h3>
                  <p className="text-xs text-slate-500 font-medium italic">
                    Ý nghĩa: <span className="font-bold text-slate-700">{chunk.meaning}</span>
                  </p>
                </div>

                {/* Phonetics IPA & Romanization */}
                <div className="space-y-1.5 bg-slate-50 p-3 rounded-2xl border border-slate-100 text-[11px] font-mono leading-relaxed">
                  {chunk.ipa && (
                    <div className="text-slate-500">
                      IPA: <span className="text-vibrant-indigo font-bold">{chunk.ipa}</span>
                    </div>
                  )}
                  {chunk.romanization && (
                    <div className="text-vibrant-coral font-bold">
                      Romanization: <span className="font-semibold">{chunk.romanization}</span>
                    </div>
                  )}
                  {!chunk.ipa && !chunk.romanization && (
                    <div className="text-slate-400 italic">Không có phiên âm phụ trợ</div>
                  )}
                </div>
              </div>

              {/* Practice Stats and Action Bar */}
              <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between">
                <div className="space-y-0.5 text-[10px] text-slate-400 font-mono font-medium">
                  {chunk.timesPracticed > 0 ? (
                    <>
                      <div>Best: <strong className="text-vibrant-mint font-bold">{chunk.bestAccuracy}%</strong></div>
                      <div>Luyện tập: <strong className="text-slate-600">{chunk.timesPracticed} lần</strong></div>
                    </>
                  ) : (
                    <div className="italic text-slate-300">Chưa từng luyện tập</div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {/* Delete Button */}
                  <button
                    onClick={() => handleDeleteChunk(chunk.id)}
                    className="p-2 text-slate-400 hover:text-vibrant-coral hover:bg-slate-50 rounded-xl transition-all"
                    title="Xóa chunk khỏi thư viện"
                  >
                    <Trash2 size={15} />
                  </button>

                  {/* Speak TTS Button */}
                  <button
                    data-tts="true"
                    onClick={() => speakText(chunk.text, chunk.language)}
                    className="p-2.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-100 rounded-xl transition-all active:scale-90 cursor-pointer"
                    title="Nghe phát âm chuẩn"
                  >
                    🔊
                  </button>

                  {/* Individual Practice Button */}
                  <button
                    onClick={() => onStartPractice([chunk])}
                    className="p-2.5 bg-vibrant-indigo/10 hover:bg-vibrant-indigo/20 text-vibrant-indigo border border-vibrant-indigo/10 rounded-xl transition-all active:scale-90 cursor-pointer"
                    title="Luyện nói riêng câu này"
                  >
                    <Play size={13} fill="currentColor" />
                  </button>
                </div>
              </div>

              {/* Source Diary Indicator */}
              <div className="absolute top-2 left-16 hidden group-hover:block bg-slate-900 text-white text-[9px] px-2.5 py-1.5 rounded-lg shadow-md pointer-events-none z-10 font-sans max-w-[150px] truncate">
                Nguồn: {chunk.sourceDiaryTitle}
              </div>
            </div>
          );
        })}

        {filteredChunks.length === 0 && (
          <div className="col-span-full bg-white border border-slate-100 p-12 rounded-[2rem] flex flex-col items-center justify-center text-slate-400 space-y-3">
            <AlertCircle size={36} className="text-slate-300" />
            <p className="text-sm font-black text-slate-700">Không tìm thấy chunk nào phù hợp với bộ lọc hiện tại.</p>
            <p className="text-xs font-medium">Hãy thử chọn "Tất cả" hoặc thay đổi bộ lọc của bạn.</p>
          </div>
        )}
      </div>
    </div>
  );
}
