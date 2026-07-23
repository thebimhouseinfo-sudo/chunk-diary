import React from "react";
import { ArrowLeft, CheckCircle2, Sparkles, Mic, Keyboard } from "lucide-react";

interface HeaderProps {
  onBack: () => void;
  onEnd: () => void;
  onOpenSettings?: () => void;
  isSummaryView: boolean;
  isReviewMode: boolean;
  isEmpty: boolean;
  inputMode: "voice" | "typing";
  onToggleInputMode: () => void;
}

export default function Header({
  onBack,
  onEnd,
  isSummaryView,
  isReviewMode,
  isEmpty,
  inputMode,
  onToggleInputMode
}: HeaderProps) {
  return (
    <div className="px-3 sm:px-6 py-3 bg-white/95 backdrop-blur-md text-slate-800 flex items-center justify-between border-b border-slate-100 shadow-xs shrink-0 z-10 gap-2">
      {/* Left side: Back button + Sky Chatbot Name */}
      <div className="flex items-center gap-2 sm:gap-3 justify-start shrink-0">
        <button
          onClick={onBack}
          className="p-2 hover:bg-slate-100 hover:text-slate-900 active:scale-95 rounded-xl transition-all cursor-pointer text-slate-500 touch-manipulation"
          title="Quay lại"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-vibrant-indigo/10 flex items-center justify-center text-vibrant-indigo font-black text-sm relative shrink-0">
            S
            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-vibrant-mint border-2 border-white animate-pulse"></span>
          </div>
          <div>
            <h1 className="font-display font-black text-sm tracking-tight text-slate-900 flex items-center gap-1">
              Sky
            </h1>
          </div>
        </div>
      </div>

      {/* Center: Speaking/Typing mode switch */}
      <div className="flex justify-center flex-1">
        {!isSummaryView && !isReviewMode && (
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-full border border-slate-200/60 shadow-inner">
            <button
              onClick={() => inputMode !== "voice" && onToggleInputMode()}
              className={`p-1.5 px-2.5 sm:px-3 rounded-full transition-all cursor-pointer flex items-center gap-1 text-[10px] font-black uppercase tracking-tight touch-manipulation ${
                inputMode === "voice"
                  ? "bg-vibrant-indigo text-white shadow-sm"
                  : "text-slate-500 hover:text-slate-800"
              }`}
              title="Phương thức nói"
            >
              <Mic size={12} />
              <span className="inline">Nói</span>
            </button>
            <button
              onClick={() => inputMode !== "typing" && onToggleInputMode()}
              className={`p-1.5 px-2.5 sm:px-3 rounded-full transition-all cursor-pointer flex items-center gap-1 text-[10px] font-black uppercase tracking-tight touch-manipulation ${
                inputMode === "typing"
                  ? "bg-vibrant-indigo text-white shadow-sm"
                  : "text-slate-500 hover:text-slate-800"
              }`}
              title="Phương thức gõ"
            >
              <Keyboard size={12} />
              <span className="inline">Gõ</span>
            </button>
          </div>
        )}
      </div>

      {/* Right side: 'Kết thúc' End button */}
      <div className="flex justify-end shrink-0">
        {!isSummaryView && !isReviewMode && !isEmpty && (
          <button
            onClick={onEnd}
            className="flex items-center gap-1 px-3 sm:px-4 py-2 sm:py-2.5 bg-vibrant-coral hover:bg-vibrant-coral/90 text-white rounded-2xl text-[10px] sm:text-[11px] font-black uppercase tracking-wider transition-all active:scale-95 shadow-md shadow-vibrant-coral/15 cursor-pointer border-none touch-manipulation"
          >
            <CheckCircle2 size={13} />
            <span>Kết thúc</span>
          </button>
        )}
      </div>
    </div>
  );
}

