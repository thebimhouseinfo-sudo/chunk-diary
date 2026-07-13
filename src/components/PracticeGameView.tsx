import React, { useState, useEffect, useRef } from "react";
import {
  Mic,
  Volume2,
  Star,
  RefreshCw,
  ArrowRight,
  XCircle,
  AlertTriangle
} from "lucide-react";
import { updateChunkReviewStats } from "../db/indexedDb";
import { Chunk } from "../types";
import { speakText } from "../utils/tts";

interface PracticeGameViewProps {
  practiceList: Chunk[];
  onFinish: () => void;
}

const getLangCode = (lang: string) => {
  const l = lang.toLowerCase();
  if (l.includes("english")) return "en-US";
  if (l.includes("korean")) return "ko-KR";
  if (l.includes("japanese")) return "ja-JP";
  if (l.includes("chinese")) return "zh-CN";
  return "en-US"; // fallback
};

const isLatinScript = (lang: string): boolean => {
  const l = lang.toLowerCase();
  // Non-Latin languages (keep romanization for these)
  if (l.includes("korean") || l.includes("japanese") || l.includes("chinese") || 
      l.includes("russian") || l.includes("arabic") || l.includes("thai") ||
      l.includes("hindi") || l.includes("greek") || l.includes("hebrew")) {
    return false;
  }
  // Default to Latin script for other languages (English, French, Spanish, German, etc.)
  return true;
};

export default function PracticeGameView({ practiceList, onFinish }: PracticeGameViewProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [evaluation, setEvaluation] = useState<any>(null);
  const [attempts, setAttempts] = useState(0);
  const [speechError, setSpeechError] = useState<string | null>(null);

  const recognitionRef = useRef<any>(null);

  const currentChunk = practiceList[currentIndex];

  const handleRecognitionResultRef = useRef<any>(null);

  useEffect(() => {
    if (currentChunk) {
      speakText(currentChunk.text, currentChunk.language);
    }
  }, [currentChunk]);

  useEffect(() => {
    if ("webkitSpeechRecognition" in window || "SpeechRecognition" in window) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;

      recognitionRef.current.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        if (handleRecognitionResultRef.current) {
          handleRecognitionResultRef.current(transcript);
        }
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error("Speech recognition error", event.error);
        if (event.error === 'not-allowed') {
          setSpeechError("Trình duyệt không được phép sử dụng Micro.");
        } else {
          setSpeechError(`Lỗi nhận dạng giọng nói: ${event.error}`);
        }
        setIsRecording(false);
      };
      
      recognitionRef.current.onend = () => {
        setIsRecording(false);
      };
    }
  }, []);

  const handleStartRecording = () => {
    setSpeechError(null);
    setShowResult(false);

    if (recognitionRef.current) {
      try {
        recognitionRef.current.lang = getLangCode(currentChunk.language);
        recognitionRef.current.start();
        setIsRecording(true);
      } catch (err) {
        setSpeechError("Micro đang bận hoặc có lỗi khởi tạo.");
        setIsRecording(false);
      }
    } else {
      // Fallback for no speech recognition support
      setIsRecording(true);
      setTimeout(() => {
        setIsRecording(false);
        handleRecognitionResult(currentChunk.text); // Mock perfect score
      }, 1500);
    }
  };

  const handleStopRecording = () => {
    if (recognitionRef.current && isRecording) {
      recognitionRef.current.stop();
    }
    setIsRecording(false);
  };

  const calculateAccuracy = (spoken: string, target: string) => {
    // Simple mock accuracy based on string similarity (Jaccard index of words or simple length match)
    // A real implementation would use Levenshtein distance
    const sWords = spoken.toLowerCase().replace(/[.,!?]/g, '').split(' ').filter(Boolean);
    const tWords = target.toLowerCase().replace(/[.,!?]/g, '').split(' ').filter(Boolean);
    
    let matches = 0;
    tWords.forEach(w => {
      if (sWords.includes(w)) matches++;
    });
    
    const accuracy = Math.round((matches / tWords.length) * 100);
    return Math.min(100, Math.max(0, accuracy));
  };

  const handleRecognitionResult = (transcript: string) => {
    const accuracy = calculateAccuracy(transcript, currentChunk.text);
    const stars = accuracy >= 90 ? 5 : accuracy >= 80 ? 4 : accuracy >= 60 ? 3 : accuracy >= 40 ? 2 : 1;
    
    const targetWords = currentChunk.text.split(" ");
    const spokenWords = transcript.toLowerCase().split(" ");
    const wordFeedback = targetWords.map(w => {
      const cleanW = w.toLowerCase().replace(/[.,!?]/g, '');
      return {
        word: w,
        status: spokenWords.some(sw => sw.includes(cleanW)) ? "good" : "improve"
      };
    });

    const result = {
      spokenText: transcript,
      accuracy,
      stars,
      wordFeedback
    };

    setEvaluation(result);
    setShowResult(true);
    setAttempts(prev => prev + 1);

    if (stars >= 4) {
      setTimeout(() => {
        handleProceed(stars);
      }, 1500);
    }
  };

  useEffect(() => {
    handleRecognitionResultRef.current = handleRecognitionResult;
  }, [handleRecognitionResult]);

  const handleProceed = async (starsOverride?: number) => {
    const ratingToSave = starsOverride !== undefined ? starsOverride : (evaluation?.stars || 0);
    if (ratingToSave > 0) {
      await updateChunkReviewStats(currentChunk.id!, ratingToSave);
    }

    if (currentIndex < practiceList.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setShowResult(false);
      setAttempts(0);
      setEvaluation(null);
      setSpeechError(null);
    } else {
      onFinish();
    }
  };

  if (!currentChunk) return null;

  const reachedMaxAttempts = attempts >= 3;
  const achievedTarget = evaluation?.stars >= 4;
  const canProceed = achievedTarget || reachedMaxAttempts;

  return (
    <div className="max-w-2xl mx-auto space-y-6 sm:space-y-8 animate-pageFadeIn">
      {/* Progress */}
      <div className="flex items-center justify-between px-2">
        <div className="space-y-1">
          <p className="text-[10px] uppercase font-black text-slate-400 tracking-widest">Tiến trình (Play List)</p>
          <div className="flex items-center gap-2">
            <div className="bg-white px-3 py-1 rounded-full border border-slate-100 text-xs font-bold text-vibrant-indigo">
              {currentIndex + 1} / {practiceList.length}
            </div>
          </div>
        </div>
        <button onClick={onFinish} className="text-slate-400 hover:text-slate-600 transition-colors p-2">
          <XCircle size={24} />
        </button>
      </div>

      {speechError && (
        <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl flex gap-3 text-amber-800">
          <AlertTriangle size={20} className="shrink-0" />
          <p className="text-sm font-medium">{speechError}</p>
        </div>
      )}

      {/* Chunk Card */}
      <div className="bg-white p-6 sm:p-10 rounded-[2.5rem] border border-slate-100 shadow-xl space-y-8 text-center relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-slate-50">
          <div
            className="h-full bg-vibrant-indigo transition-all duration-500"
            style={{ width: `${((currentIndex + 1) / practiceList.length) * 100}%` }}
          />
        </div>

        <div className="space-y-2">
          <span className="text-[10px] uppercase font-bold text-vibrant-indigo bg-vibrant-indigo/5 px-3 py-1 rounded-full">
            {currentChunk.language}
          </span>
          <h2 className="text-3xl sm:text-4xl font-display font-black text-slate-900 leading-tight flex flex-wrap justify-center gap-2">
            {currentChunk.text.split(' ').map((word, idx) => (
              <span 
                key={idx} 
                className="cursor-pointer hover:text-vibrant-indigo transition-colors"
                onClick={() => speakText(word, currentChunk.language)}
              >
                {word}
              </span>
            ))}
          </h2>
          {/* Display IPA for Latin-script languages, romanization for non-Latin */}
          {currentChunk.ipa && isLatinScript(currentChunk.language) && (
            <p className="text-lg font-mono font-bold text-vibrant-indigo opacity-80 mt-3">
              /{currentChunk.ipa}/
            </p>
          )}
          {currentChunk.romanization && !isLatinScript(currentChunk.language) && (
            <p className="text-lg font-mono font-bold text-vibrant-indigo opacity-80 mt-3">
              /{currentChunk.romanization}/
            </p>
          )}
          <p className="text-sm sm:text-base text-slate-500 font-medium italic mt-4">
            "{currentChunk.meaning}"
          </p>
        </div>

        <div className="flex flex-col items-center gap-4">
          <button
            onClick={() => speakText(currentChunk.text, currentChunk.language)}
            className="flex items-center gap-2 bg-slate-50 hover:bg-slate-100 px-6 py-3 rounded-2xl text-sm font-bold text-slate-700 transition-all active:scale-95 cursor-pointer border-none"
          >
            <Volume2 size={20} className="text-vibrant-indigo" />
            Nghe phát âm chuẩn
          </button>

          <div className="w-full pt-6 border-t border-slate-50">
            {isRecording ? (
              <div className="space-y-4">
                <div className="flex justify-center gap-1.5 h-10 items-center">
                  {[...Array(5)].map((_, i) => (
                    <span key={i} className={`w-1.5 bg-vibrant-coral rounded-full animate-bounce ${i % 2 === 0 ? "h-6" : "h-10"}`} />
                  ))}
                </div>
                <button
                  onClick={handleStopRecording}
                  className="bg-vibrant-coral text-white px-8 py-4 rounded-[2rem] font-black text-sm uppercase tracking-widest shadow-lg shadow-vibrant-coral/20 animate-pulse border-none cursor-pointer"
                >
                  Dừng Ghi Âm
                </button>
              </div>
            ) : (
              <button
                onClick={handleStartRecording}
                disabled={achievedTarget && showResult}
                className="bg-vibrant-indigo hover:bg-vibrant-indigo/90 disabled:bg-slate-100 disabled:text-slate-300 text-white px-10 py-5 rounded-[2rem] font-black text-base uppercase tracking-widest shadow-xl shadow-vibrant-indigo/20 transition-all active:scale-95 flex items-center gap-3 mx-auto border-none cursor-pointer"
              >
                <Mic size={24} />
                {attempts > 0 ? "Thử lại" : "Chạm để đọc"}
              </button>
            )}
            <p className="text-[10px] text-slate-400 font-medium mt-3">
              {attempts > 0 ? `Đã thử ${attempts}/3 lần` : "Hãy đọc to và rõ ràng cụm từ trên."}
            </p>
          </div>
        </div>
      </div>

      {/* Results */}
      {showResult && evaluation && (
        <div className="bg-white p-6 sm:p-8 rounded-[2.5rem] border border-slate-100 shadow-lg space-y-6 animate-pageFadeIn">
          <div className="flex items-center justify-between border-b border-slate-50 pb-4">
            <div className="text-left">
              <p className="text-[10px] font-black text-slate-400 uppercase">Độ chính xác</p>
              <div className="text-2xl font-display font-black text-vibrant-indigo">{evaluation.accuracy}%</div>
            </div>
            <div className="flex gap-1">
              {[...Array(5)].map((_, i) => (
                <Star
                  key={i}
                  size={18}
                  className={i < evaluation.stars ? "text-vibrant-yellow" : "text-slate-100"}
                  fill={i < evaluation.stars ? "currentColor" : "none"}
                />
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-[10px] font-black text-slate-400 uppercase text-center tracking-widest">Bạn đã đọc</p>
            <p className="text-sm text-center italic text-slate-600">"{evaluation.spokenText}"</p>
            
            <p className="text-[10px] font-black text-slate-400 uppercase text-center tracking-widest mt-4">Phân tích từ</p>
            <div className="flex flex-wrap justify-center gap-2">
              {evaluation.wordFeedback.map((word: any, i: number) => (
                <span
                  key={i}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold border cursor-pointer hover:bg-slate-100 transition-colors ${
                    word.status === "good" ? "bg-emerald-50 text-emerald-700 border-emerald-100" : "bg-amber-50 text-amber-700 border-amber-100"
                  }`}
                  onClick={() => speakText(word.word, currentChunk.language)}
                >
                  {word.word}
                </span>
              ))}
            </div>
          </div>

          <div className="pt-4 flex flex-col sm:flex-row gap-3">
            {!achievedTarget && !reachedMaxAttempts && (
              <button
                onClick={handleStartRecording}
                className="flex-1 bg-slate-50 hover:bg-slate-100 text-slate-700 py-4 rounded-2xl text-sm font-bold transition-all flex items-center justify-center gap-2 border-none cursor-pointer"
              >
                <RefreshCw size={16} /> Đọc lại
              </button>
            )}
            {(canProceed || achievedTarget) && (
              <button
                onClick={() => handleProceed()}
                className="flex-1 py-4 rounded-2xl text-sm font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 bg-vibrant-indigo text-white shadow-lg shadow-vibrant-indigo/10 border-none cursor-pointer animate-pulse"
              >
                {currentIndex < practiceList.length - 1 ? "Tiếp theo" : "Hoàn thành"}
                <ArrowRight size={18} />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
