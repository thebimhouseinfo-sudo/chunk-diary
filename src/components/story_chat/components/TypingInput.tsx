import React, { useState } from "react";
import { Send, AudioLines } from "lucide-react";

interface TypingInputProps {
  onSend: (text: string) => void;
  onSwitchMode: () => void;
}

export default function TypingInput({ onSend, onSwitchMode }: TypingInputProps) {
  const [text, setText] = useState("");

  const handleSend = () => {
    if (text.trim()) {
      onSend(text.trim());
      setText("");
    }
  };

  return (
    <div className="flex flex-col py-2.5 sm:py-4 px-3 sm:px-4 bg-slate-50/50 rounded-b-none sm:rounded-b-[2.5rem] border-t border-slate-100 shrink-0">
      <div className="flex items-center gap-2 w-full">
        {/* Nút chuyển về chế độ nói */}
        <button
          onClick={onSwitchMode}
          className="w-11 h-11 bg-white border border-slate-100 rounded-full text-vibrant-indigo hover:text-white hover:bg-vibrant-indigo shadow-sm hover:shadow active:scale-95 transition-all cursor-pointer touch-manipulation shrink-0 flex items-center justify-center"
          title="Chuyển sang giọng nói"
        >
          <AudioLines size={20} strokeWidth={2.4} />
        </button>

        {/* Input văn bản */}
        <div className="flex-1 relative flex items-center">
          <input
            type="text"
            placeholder="Kể câu chuyện của bạn..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            className="w-full bg-white border border-slate-100 focus:border-vibrant-indigo/80 rounded-2xl pl-3.5 pr-11 py-3 text-sm font-semibold text-slate-800 outline-none shadow-sm placeholder:text-slate-400/80 transition-all"
          />
          <button
            onClick={handleSend}
            disabled={!text.trim()}
            className="absolute right-1.5 p-2 bg-gradient-to-r from-vibrant-indigo to-vibrant-indigo/90 hover:from-vibrant-indigo/90 hover:to-vibrant-indigo disabled:from-slate-100 disabled:to-slate-150 text-white disabled:text-slate-400 rounded-xl transition-all active:scale-95 cursor-pointer shadow touch-manipulation"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

