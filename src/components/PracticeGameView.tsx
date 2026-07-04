import React, { useState, useEffect } from "react";
import {
  Mic,
  MicOff,
  Volume2,
  Star,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  RefreshCw,
  Trophy,
  XCircle
} from "lucide-react";
import { updateChunkStats } from "../db/indexedDb";
import { Chunk } from "../types";
import { speakText } from "../utils/tts";

interface PracticeGameViewProps {
  practiceList: Chunk[];
  onFinish: () => void;
}

export default function PracticeGameView({ practiceList, onFinish }: PracticeGameViewProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [evaluation, setEvaluation] = useState<any>(null);
  const [attempts, setAttempts] = useState(0);
  const [speechError, setSpeechError] = useState<string | null>(null);

  const currentChunk = practiceList[currentIndex];

  const handleStartRecording = () => {
    setIsRecording(true);
    setSpeechError(null);
    setShowResult(false);

    // Mocking recording and result
    setTimeout(() => {
      handleStopRecording();
    }, 2000);
  };

  const handleStopRecording = () => {
    setIsRecording(false);
    // Mock evaluation
    const accuracy = Math.floor(Math.random() * 40) + 60;
    const stars = accuracy >= 90 ? 5 : accuracy >= 80 ? 4 : accuracy >= 70 ? 3 : 2;
    const result = {
      spokenText: currentChunk.text,
      accuracy,
      stars,
      wordFeedback: currentChunk.text.split(" ").map(w => ({ word: w, status: Math.random() > 0.2 ? "good" : "improve" }))
    };

    setEvaluation(result);
    setShowResult(true);
    setAttempts(prev => prev + 1);

    // Save stats
    updateChunkStats(currentChunk.id!, accuracy, stars);
  };

  const handleNext = () => {
    if (currentIndex < practiceList.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setShowResult(false);
      setAttempts(0);
      setEvaluation(null);
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
          <p className="text-[10px] uppercase font-black text-slate-400 tracking-widest">Tiến trình</p>
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
          <h2 className="text-3xl sm:text-4xl font-display font-black text-slate-900 leading-tight">
            {currentChunk.text}
          </h2>
          <p className="text-sm sm:text-base text-slate-500 font-medium italic">
            "{currentChunk.meaning}"
          </p>
        </div>

        <div className="flex flex-col items-center gap-4">
          <button
            onClick={() => speakText(currentChunk.text, currentChunk.language)}
            className="flex items-center gap-2 bg-slate-50 hover:bg-slate-100 px-6 py-3 rounded-2xl text-sm font-bold text-slate-700 transition-all active:scale-95"
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
                  className="bg-vibrant-coral text-white px-8 py-4 rounded-[2rem] font-black text-sm uppercase tracking-widest shadow-lg shadow-vibrant-coral/20 animate-pulse"
                >
                  Dừng Ghi Âm
                </button>
              </div>
            ) : (
              <button
                onClick={handleStartRecording}
                disabled={canProceed && achievedTarget}
                className="bg-vibrant-indigo hover:bg-vibrant-indigo/90 disabled:bg-slate-100 disabled:text-slate-300 text-white px-10 py-5 rounded-[2rem] font-black text-base uppercase tracking-widest shadow-xl shadow-vibrant-indigo/20 transition-all active:scale-95 flex items-center gap-3 mx-auto"
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
            <p className="text-[10px] font-black text-slate-400 uppercase text-center tracking-widest">Chi tiết</p>
            <div className="flex flex-wrap justify-center gap-2">
              {evaluation.wordFeedback.map((word: any, i: number) => (
                <span
                  key={i}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold border ${
                    word.status === "good" ? "bg-emerald-50 text-emerald-700 border-emerald-100" : "bg-amber-50 text-amber-700 border-amber-100"
                  }`}
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
                className="flex-1 bg-slate-50 hover:bg-slate-100 text-slate-700 py-4 rounded-2xl text-sm font-bold transition-all flex items-center justify-center gap-2"
              >
                <RefreshCw size={16} /> Đọc lại
              </button>
            )}
            <button
              onClick={handleNext}
              className={`flex-1 py-4 rounded-2xl text-sm font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${
                canProceed ? "bg-vibrant-indigo text-white shadow-lg shadow-vibrant-indigo/10" : "bg-slate-100 text-slate-400"
              }`}
            >
              {currentIndex < practiceList.length - 1 ? "Tiếp theo" : "Hoàn thành"}
              <ArrowRight size={18} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
