import React, { useState } from "react";
import { Sparkles, Edit3, Trash2, Check, X, FileText } from "lucide-react";

interface SummaryViewProps {
  sentences: string[];
  onUpdateSentence: (index: number, newText: string) => void;
  onDeleteSentence: (index: number) => void;
  onCreateChunks: () => void;
  isGenerating: boolean;
}

export default function SummaryView({
  sentences,
  onUpdateSentence,
  onDeleteSentence,
  onCreateChunks,
  isGenerating
}: SummaryViewProps) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editText, setEditText] = useState("");

  const startEdit = (index: number, currentText: string) => {
    setEditingIndex(index);
    setEditText(currentText);
  };

  const saveEdit = (index: number) => {
    if (editText.trim()) {
      onUpdateSentence(index, editText.trim());
    }
    setEditingIndex(null);
  };

  return (
    <div className="flex flex-col flex-1 bg-slate-50/30 h-full w-full mx-auto animate-pageFadeIn">
      <div className="content flex-1 overflow-y-auto p-6 sm:p-8 space-y-6">
        {/* Visual Banner Header */}
        <div className="bg-white p-6 sm:p-8 rounded-[2rem] border border-slate-150/80 shadow-xs space-y-4">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-vibrant-mint/20 text-vibrant-indigo rounded-full text-xs font-black uppercase tracking-wider">
            <Sparkles size={12} className="animate-spin-slow text-vibrant-coral" />
            Hành trình hoàn thành!
          </div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight leading-none">Cùng xem lại câu câu chuyện</h2>
          <p className="text-slate-500 text-xs sm:text-sm font-medium leading-relaxed">
            Xem lại các câu bạn đã kể dưới đây. Bạn có thể chỉnh sửa hoặc xóa các câu chưa ưng ý trước khi hệ thống tiến hành bóc tách thành các <strong className="text-vibrant-indigo font-black">Language Chunks</strong> để luyện tập.
          </p>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between px-2">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <FileText size={14} className="text-vibrant-indigo" />
              Nội dung câu chuyện ({sentences.length} câu)
            </h3>
          </div>

          {sentences.map((sentence, idx) => (
            <div
              key={idx}
              className={`p-5 rounded-2xl border transition-all duration-200 ${
                editingIndex === idx
                  ? "bg-white border-vibrant-indigo/40 ring-4 ring-vibrant-indigo/5 shadow-md"
                  : "bg-white border-slate-150/80 hover:border-vibrant-indigo/20 shadow-xs hover:shadow-sm"
              }`}
            >
              {editingIndex === idx ? (
                <div className="flex flex-col gap-3">
                  <textarea
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    rows={3}
                    className="w-full border border-slate-250 focus:border-vibrant-indigo focus:ring-4 focus:ring-vibrant-indigo/5 rounded-xl p-3 text-sm font-semibold outline-none resize-none bg-white text-slate-800 transition-all"
                  />
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() => setEditingIndex(null)}
                      className="flex items-center gap-1 px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-500 text-xs font-black uppercase tracking-wider transition-all cursor-pointer"
                    >
                      <X size={14} />
                      Hủy
                    </button>
                    <button
                      onClick={() => saveEdit(idx)}
                      className="flex items-center gap-1 px-4 py-2 rounded-xl bg-vibrant-indigo hover:bg-vibrant-indigo/95 text-white text-xs font-black uppercase tracking-wider transition-all active:scale-95 shadow-sm cursor-pointer border-none"
                    >
                      <Check size={14} />
                      Lưu thay đổi
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex justify-between items-start gap-4">
                  <div className="flex items-start gap-3 flex-1">
                    <span className="w-6 h-6 rounded-lg bg-slate-100 flex items-center justify-center text-[10px] font-black text-slate-400 shrink-0 mt-0.5">
                      {idx + 1}
                    </span>
                    <div className="text-slate-800 text-sm font-semibold leading-relaxed break-words pt-0.5">
                      {sentence}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => startEdit(idx, sentence)}
                      className="p-2 text-slate-400 hover:text-vibrant-indigo hover:bg-vibrant-indigo/5 rounded-xl transition-all cursor-pointer border-none"
                      title="Chỉnh sửa câu"
                    >
                      <Edit3 size={15} />
                    </button>
                    <button
                      onClick={() => onDeleteSentence(idx)}
                      className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all cursor-pointer border-none"
                      title="Xóa câu"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
          
          {sentences.length === 0 && (
            <div className="text-center py-12 bg-white rounded-2xl border border-slate-150/80 shadow-xs text-slate-400 text-sm font-medium">
              Chưa có nội dung câu chuyện nào được ghi nhận.
            </div>
          )}
        </div>
      </div>

      {/* Floating Action footer panel */}
      <div className="footer border-t border-slate-100 p-5 sm:p-6 bg-white/95 backdrop-blur-md sticky bottom-0 z-10 flex flex-col gap-3 shrink-0">
        <button
          onClick={onCreateChunks}
          disabled={isGenerating || sentences.length === 0}
          className="w-full py-4 rounded-2xl bg-gradient-to-r from-vibrant-coral to-vibrant-coral/90 hover:from-vibrant-coral/95 hover:to-vibrant-coral disabled:bg-slate-100 disabled:text-slate-400 text-white font-black uppercase tracking-widest text-xs transition-all shadow-lg shadow-vibrant-coral/20 active:scale-95 cursor-pointer text-center border-none flex items-center justify-center gap-2"
        >
          {isGenerating ? (
            <>
              <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin"></span>
              Đang tự động bóc tách Chunks...
            </>
          ) : (
            <>
              <Sparkles size={14} className="animate-pulse" />
              Tiến hành tạo Chunks tự học
            </>
          )}
        </button>
      </div>
    </div>
  );
}
