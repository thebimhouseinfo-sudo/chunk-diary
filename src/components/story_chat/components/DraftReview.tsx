import React from "react";
import { Send, X, Edit3, Sparkles } from "lucide-react";

interface DraftReviewProps {
  draftText: string;
  onChange: (text: string) => void;
  onDelete: () => void;
  onSend: (text: string) => void;
}

export default function DraftReview({ draftText, onChange, onDelete, onSend }: DraftReviewProps) {
  const sentenceCount = draftText.split(/[.!?]+/).filter(s => s.trim().length > 0).length;
  const isTooLong = sentenceCount >= 3;

  return (
    <div className="p-4 sm:p-5 bg-slate-50/80 rounded-2xl border border-slate-150/80 space-y-3 animate-pageFadeIn">
      <div className="flex items-center justify-between">
        {/* Left: 'Hủy' button instead of the preview label */}
        <button
          onClick={onDelete}
          className="flex items-center gap-1.5 px-3 py-2 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-xl text-xs font-black uppercase tracking-wider transition-all active:scale-95 cursor-pointer border-none bg-transparent"
          title="Hủy bản ghi"
        >
          <X size={15} />
          <span className="hidden sm:inline">Hủy bỏ</span>
        </button>

        {/* Right: 'Gửi' button placed at the top-right */}
        <button
          onClick={() => onSend(draftText)}
          disabled={!draftText.trim()}
          className="flex items-center gap-1.5 px-4 py-2 bg-vibrant-indigo hover:bg-vibrant-indigo/95 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all active:scale-95 shadow-sm hover:shadow cursor-pointer border-none"
          title="Gửi câu"
        >
          <Send size={13} />
          <span className="hidden sm:inline">Gửi câu</span>
        </button>
      </div>

      {/* Editable textarea container */}
      <div className="relative bg-white border border-slate-200 rounded-xl focus-within:border-vibrant-indigo focus-within:ring-4 focus-within:ring-vibrant-indigo/5 transition-all shadow-inner p-3 pb-7">
        <div className="flex gap-2.5">
          <Edit3 className="text-slate-400 shrink-0 mt-1" size={15} />
          <textarea
            value={draftText}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Chỉnh sửa lời nói của bạn ở đây..."
            rows={3}
            className="w-full text-sm text-slate-800 font-semibold leading-relaxed bg-transparent border-none outline-none resize-none p-0 focus:ring-0"
          />
        </div>
        
        {isTooLong && (
          <div className="absolute bottom-2 left-3 text-[10px] text-vibrant-coral font-bold flex items-center gap-1 animate-pulse">
            ⚠️ Câu hơi dài ({sentenceCount} câu), chia ngắn hơn để tạo chunks chuẩn nhất!
          </div>
        )}

        <div className="absolute bottom-2 right-3 text-[9px] text-slate-400 font-bold flex items-center gap-1 select-none pointer-events-none">
          <Sparkles size={10} className="text-vibrant-indigo animate-pulse" />
          Nhấn để chỉnh sửa trực tiếp
        </div>
      </div>
    </div>
  );
}
