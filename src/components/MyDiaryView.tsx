import React, { useState, useEffect } from "react";
import { BookOpen, Play, Trash2, Calendar, ChevronDown, ChevronUp, Star, PlusCircle, AlertCircle, Sparkles } from "lucide-react";
import { getDiaries, deleteDiary, getChunks } from "../db/indexedDb";
import { Diary, Chunk } from "../types";
import { speakText } from "../utils/tts";

interface MyDiaryViewProps {
  onStartPractice: (chunks: Chunk[]) => void;
  onNavigate: (tab: string) => void;
}

interface GroupedDiary {
  dayKey: string;
  ids: string[];
  title: string;
  content: string;
  createdAt: string;
}

export default function MyDiaryView({ onStartPractice, onNavigate }: MyDiaryViewProps) {
  const [groupedDiaries, setGroupedDiaries] = useState<GroupedDiary[]>([]);
  const [chunks, setChunks] = useState<Chunk[]>([]);
  const [expandedDayKey, setExpandedDayKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const diaryList = await getDiaries();
      const chunkList = await getChunks();
      setChunks(chunkList);
      
      // Group diaries by day
      const groups: { [key: string]: GroupedDiary } = {};
      diaryList.forEach((diary) => {
        if (!diary.id) return;
        const d = new Date(diary.createdAt);
        const dayKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        
        if (!groups[dayKey]) {
          const formattedDate = d.toLocaleDateString("vi-VN");
          groups[dayKey] = {
            dayKey,
            ids: [diary.id],
            title: `Nhật ký ngày ${formattedDate}`,
            content: diary.content,
            createdAt: diary.createdAt,
          };
        } else {
          groups[dayKey].ids.push(diary.id);
          // Only append if content is not already present
          if (!groups[dayKey].content.includes(diary.content)) {
            groups[dayKey].content = groups[dayKey].content + "\n\n" + diary.content;
          }
          // Maintain latest createdAt
          if (new Date(diary.createdAt).getTime() > new Date(groups[dayKey].createdAt).getTime()) {
            groups[dayKey].createdAt = diary.createdAt;
          }
        }
      });

      const sortedGroups = Object.values(groups).sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      setGroupedDiaries(sortedGroups);
      
      // Auto-expand the first diary if available
      if (sortedGroups.length > 0 && !expandedDayKey) {
        setExpandedDayKey(sortedGroups[0].dayKey);
      }
    } catch (err) {
      console.error("Failed to load diary history:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteDiary = async (ids: string[], e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("Bạn có chắc chắn muốn xóa bài nhật ký này? Toàn bộ câu và chunks liên quan cũng sẽ bị xóa khỏi thư viện.")) {
      try {
        for (const id of ids) {
          await deleteDiary(id);
        }
        setExpandedDayKey(null);
        await loadData();
      } catch (err) {
        console.error("Failed to delete diary entries:", err);
      }
    }
  };

  const getChunksForGroupedDiary = (gd: GroupedDiary) => {
    return chunks.filter((c) => gd.ids.includes(c.sourceDiaryId));
  };

  const formatDate = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString("vi-VN", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      }) + " - " + date.toLocaleTimeString("vi-VN", {
        hour: "2-digit",
        minute: "2-digit"
      });
    } catch {
      return isoString;
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <div className="w-8 h-8 border-4 border-vibrant-indigo border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-slate-500 font-mono">Đang tải lịch sử nhật ký...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 sm:space-y-8 animate-pageFadeIn text-left">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-6 sm:p-8 rounded-[2rem] border border-slate-100 shadow-sm">
        <div className="space-y-1">
          <h2 className="font-display text-xl sm:text-2xl font-black text-slate-900 flex items-center gap-2.5">
            <BookOpen className="text-vibrant-indigo" />
            Nhật Ký Của Tôi
          </h2>
          <p className="text-[10px] sm:text-xs text-slate-500 font-medium">
            Lịch sử lưu trữ bài viết và các chunks tự học tương ứng.
          </p>
        </div>

        <button
          onClick={() => onNavigate("story_chat")}
          className="flex items-center justify-center gap-2 bg-vibrant-coral hover:bg-vibrant-coral/90 text-white px-5 sm:px-6 py-3 rounded-2xl font-black shadow-lg shadow-vibrant-coral/20 transition-all active:scale-95 w-full sm:w-auto text-xs uppercase tracking-tight cursor-pointer border-none"
        >
          <PlusCircle size={16} />
          Kể câu chuyện mới
        </button>
      </div>

      {/* Diaries List */}
      <div className="space-y-4">
        {groupedDiaries.map((diary) => {
          const dayKey = diary.dayKey;
          const isExpanded = expandedDayKey === dayKey;
          const diaryChunks = getChunksForGroupedDiary(diary);
          
          return (
            <div
              key={dayKey}
              className={`bg-white rounded-[2rem] border transition-all duration-200 overflow-hidden ${
                isExpanded ? "border-vibrant-indigo/40 shadow-md" : "border-slate-100 hover:border-slate-200 shadow-xs"
              }`}
            >
              {/* Summary / Bar info */}
              <div
                onClick={() => setExpandedDayKey(isExpanded ? null : dayKey)}
                className="p-5 sm:p-6 flex items-center justify-between cursor-pointer select-none"
              >
                <div className="space-y-1 flex-1 pr-4 min-w-0">
                  <div className="flex items-center gap-2 text-slate-400">
                    <Calendar size={13} className="text-slate-400" />
                    <span className="text-[10px] sm:text-xs font-semibold">{formatDate(diary.createdAt)}</span>
                  </div>
                  <h3 className="font-display font-black text-slate-900 text-sm sm:text-base tracking-tight truncate">
                    {diary.title}
                  </h3>
                </div>

                <div className="flex items-center gap-3">
                  <span className="bg-vibrant-indigo/10 text-vibrant-indigo font-black text-[9px] sm:text-[10px] uppercase px-2.5 py-1 rounded-lg shrink-0">
                    {diaryChunks.length} chunks
                  </span>
                  
                  <button
                    onClick={(e) => handleDeleteDiary(diary.ids, e)}
                    className="p-2 text-slate-300 hover:text-vibrant-coral hover:bg-rose-50 rounded-xl transition-all cursor-pointer border-none bg-transparent"
                    title="Xóa nhật ký"
                  >
                    <Trash2 size={16} />
                  </button>

                  <div className="text-slate-400">
                    {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                  </div>
                </div>
              </div>

              {/* Detail panel when expanded */}
              {isExpanded && (
                <div className="border-t border-slate-50 bg-slate-50/20 p-5 sm:p-8 space-y-6 animate-pageFadeIn">
                  {/* Diary content paragraph */}
                  <div className="bg-white p-5 rounded-2xl border border-slate-100 space-y-2">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                      <Sparkles size={12} className="text-vibrant-coral animate-spin-slow" />
                      Câu chuyện nguyên bản (Tiếng Việt)
                    </h4>
                    <p className="text-slate-800 text-sm font-semibold leading-relaxed whitespace-pre-line">
                      {diary.content}
                    </p>
                  </div>

                  {/* Generated chunks section */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        Các Chunks tự chọn luyện phát âm ({diaryChunks.length})
                      </h4>
                      {diaryChunks.length > 0 && (
                        <button
                          onClick={() => onStartPractice(diaryChunks)}
                          className="flex items-center gap-1.5 bg-vibrant-indigo hover:bg-vibrant-indigo/90 text-white px-4 py-2 rounded-xl text-xs font-black uppercase tracking-tight shadow-md transition-all active:scale-95 cursor-pointer border-none"
                        >
                          <Play size={12} fill="currentColor" />
                          Luyện tập bộ này
                        </button>
                      )}
                    </div>

                    {diaryChunks.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {diaryChunks.map((chunk) => {
                          const rating = Math.round(chunk.averageRating || chunk.stars || 0);
                          return (
                            <div
                              key={chunk.id}
                              className="bg-white rounded-2xl border border-slate-100 p-5 flex flex-col justify-between hover:border-slate-200 transition-all shadow-xs"
                            >
                              <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                  <span className="bg-vibrant-indigo/10 text-vibrant-indigo font-black text-[9px] uppercase px-2 py-0.5 rounded-lg">
                                    {chunk.language}
                                  </span>
                                  <div className="flex items-center gap-0.5">
                                    {Array.from({ length: 5 }).map((_, i) => (
                                      <Star
                                        key={i}
                                        size={10}
                                        className={i < rating ? "text-vibrant-yellow" : "text-slate-100"}
                                        fill={i < rating ? "currentColor" : "none"}
                                      />
                                    ))}
                                  </div>
                                </div>
                                
                                <div className="space-y-1">
                                  <h5 className="font-display font-black text-slate-900 text-[15px] leading-tight">
                                    {chunk.text}
                                  </h5>
                                  <p className="text-[10px] text-slate-500 font-medium italic">
                                    {chunk.meaning}
                                  </p>
                                </div>

                                {chunk.ipa && (
                                  <p
                                    className="text-[10px] font-mono font-bold text-vibrant-indigo opacity-80"
                                    style={{ fontFamily: "var(--font-ipa)" }}
                                  >
                                    /{chunk.ipa}/
                                  </p>
                                )}
                              </div>

                              <div className="pt-3 mt-3 border-t border-slate-100/50 flex items-center justify-between">
                                <span className="text-[9px] text-slate-400 font-mono font-medium">
                                  {chunk.totalReviews || chunk.timesPracticed || 0} reviews
                                </span>
                                <button
                                  onClick={() => speakText(chunk.text, chunk.language)}
                                  className="p-1.5 bg-slate-50 rounded-lg hover:bg-slate-100 border-none cursor-pointer"
                                  title="Nghe phát âm"
                                >
                                  🔊
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="p-6 bg-white border border-slate-150 rounded-2xl text-center text-xs text-slate-400 italic">
                        Không tìm thấy chunks cho nhật ký này. Bạn có thể xóa bài viết này đi và tạo câu chuyện mới.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {groupedDiaries.length === 0 && (
          <div className="bg-white border border-slate-100 p-12 rounded-[2rem] flex flex-col items-center justify-center text-slate-400 text-center space-y-4">
            <AlertCircle size={36} className="text-slate-200" />
            <div className="space-y-1">
              <p className="text-sm font-black text-slate-700">Chưa có bài nhật ký nào</p>
              <p className="text-xs text-slate-400">Hãy bắt đầu hành trình của bạn bằng cách kể câu chuyện đầu tiên ngay hôm nay.</p>
            </div>
            <button
              onClick={() => onNavigate("story_chat")}
              className="flex items-center gap-2 bg-vibrant-indigo text-white px-5 py-3 rounded-2xl text-xs font-black uppercase tracking-wider cursor-pointer border-none"
            >
              <PlusCircle size={16} /> Bắt đầu kể chuyện
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
