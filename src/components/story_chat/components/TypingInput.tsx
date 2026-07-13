import React, { useState } from "react";
import { Send, Mic, Sparkles } from "lucide-react";

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
    <div className="flex flex-col gap-3 py-4 px-4 bg-slate-50/50 rounded-b-[2.5rem] border-t border-slate-100">
      <div className="flex items-center gap-2.5 w-full">
        {/* Nút chuyển về chế độ nói */}
        <button
          onClick={onSwitchMode}
          className="p-3.5 bg-white border border-slate-100 rounded-2xl text-slate-500 hover:text-slate-800 shadow-sm hover:shadow active:scale-95 transition-all cursor-pointer"
          title="Chuyển sang giọng nói"
        >
          <Mic size={20} />
        </button>

        {/* Input văn bản */}
        <div className="flex-1 relative flex items-center">
          <input
            type="text"
            placeholder="Kể câu chuyện của bạn bằng tiếng Việt..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            className="w-full bg-white border border-slate-100 focus:border-vibrant-indigo/80 rounded-2xl pl-4 pr-12 py-3.5 text-sm font-semibold text-slate-800 outline-none shadow-sm placeholder:text-slate-400/80 transition-all"
          />
          <button
            onClick={handleSend}
            disabled={!text.trim()}
            className="absolute right-2 p-2.5 bg-gradient-to-r from-vibrant-indigo to-vibrant-indigo/90 hover:from-vibrant-indigo/90 hover:to-vibrant-indigo disabled:from-slate-100 disabled:to-slate-150 text-white disabled:text-slate-400 rounded-xl transition-all active:scale-95 cursor-pointer shadow"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
      <p className="text-[10px] text-slate-400 font-bold tracking-tight px-1 flex items-center gap-1">
        <Sparkles size={11} className="text-amber-400" /> Nhập tiếng Việt, hệ thống sẽ tự động chuyển ngữ và tạo các chunks giao tiếp chuẩn bản xứ.
      </p>
    </div>
  );
}
