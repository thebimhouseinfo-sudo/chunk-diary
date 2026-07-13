import React, { useState, useRef, useEffect } from "react";
import { Mic, Keyboard, Sparkles, Volume2 } from "lucide-react";

interface VoiceInputProps {
  onTranscriptionStart: () => void;
  onTranscriptionEnd: (text: string) => void;
  onSwitchMode: () => void;
}

export default function VoiceInput({
  onTranscriptionStart,
  onTranscriptionEnd,
  onSwitchMode
}: VoiceInputProps) {
  const [isHolding, setIsHolding] = useState(false);
  const [amplitude, setAmplitude] = useState<number[]>([10, 10, 10, 10, 10]);
  const recognitionRef = useRef<any>(null);
  const intervalRef = useRef<any>(null);

  // Giả lập sóng âm sinh động khi giữ mic nói
  useEffect(() => {
    if (isHolding) {
      intervalRef.current = setInterval(() => {
        setAmplitude(Array.from({ length: 8 }, () => Math.floor(Math.random() * 45) + 10));
      }, 100);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setAmplitude([10, 10, 10, 10, 10]);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isHolding]);

  const startListening = async () => {
    setIsHolding(true);
    onTranscriptionStart();

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = "vi-VN";

      recognition.onresult = (event: any) => {
        const text = event.results[0][0].transcript;
        if (text && text.trim()) {
          onTranscriptionEnd(text.trim());
        } else {
          onTranscriptionEnd("");
        }
      };

      recognition.onerror = (event: any) => {
        console.error("Voice input recognition error:", event.error);
        onTranscriptionEnd("");
      };

      recognition.onend = () => {
        setIsHolding(false);
      };

      recognitionRef.current = recognition;
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
        recognition.start();
      } catch (err) {
        console.error("Mic permission denied", err);
        setIsHolding(false);
        onTranscriptionEnd("");
      }
    } else {
      // Mockup transcription fallback
      setTimeout(() => {
        onTranscriptionEnd("Hôm nay mình dậy hơi muộn. Sau đó mình đưa con đi học.");
        setIsHolding(false);
      }, 2000);
    }
  };

  const stopListening = () => {
    if (recognitionRef.current && isHolding) {
      recognitionRef.current.stop();
    }
    setIsHolding(false);
  };

  return (
    <div className="flex flex-col items-center justify-center py-6 px-4 bg-slate-50/50 rounded-b-[2.5rem] border-t border-slate-100 relative">
      {/* Sóng âm sinh động */}
      <div className="h-16 flex items-center justify-center gap-1.5 mb-4 w-full">
        {isHolding && (
          <div className="flex items-center gap-1">
            <Volume2 className="text-vibrant-coral animate-bounce mr-2" size={16} />
            {amplitude.map((h, i) => (
              <span
                key={i}
                style={{ height: `${h}px` }}
                className="w-1.5 bg-gradient-to-t from-vibrant-coral to-vibrant-indigo rounded-full transition-all duration-100"
              ></span>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between w-full max-w-sm px-6">
        {/* Nút chuyển chế độ gõ phím */}
        <button
          onClick={onSwitchMode}
          className="p-3.5 bg-white border border-slate-100 rounded-2xl text-slate-500 hover:text-slate-800 shadow-sm hover:shadow active:scale-95 transition-all cursor-pointer"
          title="Chuyển sang nhập văn bản"
        >
          <Keyboard size={20} />
        </button>

        {/* Nút Mic chính cỡ lớn */}
        <button
          onMouseDown={startListening}
          onMouseUp={stopListening}
          onTouchStart={startListening}
          onTouchEnd={stopListening}
          className={`w-24 h-24 bg-gradient-to-tr from-vibrant-indigo to-vibrant-indigo/90 text-white rounded-full flex items-center justify-center shadow-xl transition-all cursor-pointer select-none active:scale-90 ${
            isHolding
              ? "ring-8 ring-vibrant-indigo/25 scale-105 shadow-vibrant-indigo/20"
              : "hover:scale-102 shadow-vibrant-indigo/10"
          }`}
        >
          <Mic size={36} className={`${isHolding ? "text-vibrant-mint scale-110" : "text-white"}`} />
        </button>

        {/* Placeholder giữ thăng bằng */}
        <div className="w-12 h-12"></div>
      </div>

      <div className="text-xs text-slate-500 mt-5 font-bold tracking-tight text-center select-none max-w-xs leading-relaxed">
        {isHolding ? (
          <span className="text-vibrant-coral animate-pulse">Đang ghi âm... Thả tay để gửi</span>
        ) : (
          <span className="text-slate-400 flex items-center justify-center gap-1.5 uppercase tracking-wide">
            <Sparkles size={14} className="text-vibrant-indigo shrink-0" /> Nhấn giữ để kể câu chuyện của bạn bằng tiếng Việt
          </span>
        )}
      </div>
    </div>
  );
}
