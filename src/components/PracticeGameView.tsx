import React, { useState, useEffect, useRef } from "react";
import { PlayCircle, Volume2, Mic, MicOff, ArrowRight, Star, RefreshCw, CheckCircle2, AlertTriangle, AlertCircle, XCircle } from "lucide-react";
import { Chunk, PracticeHistory } from "../types";
import { updateChunk, addHistory } from "../db/indexedDb";
import { speakText } from "../utils/tts";
import { SpeechService, evaluatePronunciation, WordScore } from "../utils/speech";

interface PracticeGameViewProps {
  practiceList: Chunk[];
  onFinish: () => void;
}

export default function PracticeGameView({ practiceList, onFinish }: PracticeGameViewProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [attempts, setAttempts] = useState(0); // Max 3 per chunk

  // Speech Recognition states
  const [isRecording, setIsRecording] = useState(false);
  const [speechError, setSpeechError] = useState<string | null>(null);
  
  // Evaluation result states
  const [showResult, setShowResult] = useState(false);
  const [evaluation, setEvaluation] = useState<{
    accuracy: number;
    stars: number;
    wordFeedback: WordScore[];
    spokenText: string;
  } | null>(null);

  const currentChunk = practiceList[currentIndex];
  const speechServiceRef = useRef<SpeechService | null>(null);

  // Auto-play chunk audio on load / index change
  useEffect(() => {
    if (currentChunk) {
      // Auto play whole sentence
      speakText(currentChunk.text, currentChunk.language);
      
      // Initialize speech service for current language
      speechServiceRef.current = new SpeechService(currentChunk.language);
      
      // Reset states for new chunk
      setAttempts(0);
      setShowResult(false);
      setEvaluation(null);
      setSpeechError(null);
    }
  }, [currentIndex, currentChunk]);

  // Clean up recording on unmount
  useEffect(() => {
    return () => {
      if (speechServiceRef.current) {
        speechServiceRef.current.stopListening();
      }
    };
  }, []);

  if (!currentChunk) {
    return (
      <div className="bg-white p-8 rounded-2xl border border-neutral-200 text-center space-y-4 max-w-md mx-auto">
        <AlertCircle size={40} className="text-neutral-400 mx-auto" />
        <h3 className="font-display font-bold text-lg">Danh Sách Luyện Tập Trống</h3>
        <p className="text-sm text-neutral-500">Vui lòng quay lại Thư viện Chunks hoặc Nhật ký để thêm câu vào hàng chờ luyện tập.</p>
        <button onClick={onFinish} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-medium cursor-pointer">
          Quay lại
        </button>
      </div>
    );
  }

  // Segment chunk text into words
  const words = currentChunk.text.split(/\s+/).filter(w => w.trim().length > 0);

  // Generate sub-phrases (pairs of consecutive words) to support:
  // "Sentence -> Phrase -> Word. Users can touch phrase to hear phrase."
  const phrases: string[] = [];
  for (let i = 0; i < words.length - 1; i += 2) {
    phrases.push(`${words[i]} ${words[i+1]}`);
  }
  if (words.length % 2 !== 0 && words.length > 2) {
    phrases.push(words[words.length - 1]);
  }

  const handleStartRecording = () => {
    if (!speechServiceRef.current || !speechServiceRef.current.isSupported()) {
      setSpeechError("Trình duyệt này không hỗ trợ ghi âm phát âm Speech Recognition. Hãy dùng Chrome/Safari!");
      return;
    }

    setSpeechError(null);
    setIsRecording(true);

    speechServiceRef.current.startListening(
      async (resultText) => {
        // Evaluate spoken result
        const result = evaluatePronunciation(currentChunk.text, resultText, currentChunk.language);
        setEvaluation(result);
        setShowResult(true);

        // Update database
        const newAttempts = attempts + 1;
        setAttempts(newAttempts);

        const updatedStars = Math.max(currentChunk.stars, result.stars);
        const updatedAccuracy = Math.max(currentChunk.bestAccuracy, result.accuracy);

        const updatedChunk = {
          ...currentChunk,
          stars: updatedStars,
          bestAccuracy: updatedAccuracy,
          timesPracticed: currentChunk.timesPracticed + 1,
          lastPracticed: new Date().toISOString()
        };

        // Sync with db
        await updateChunk(updatedChunk);

        // Save history item
        const historyItem: PracticeHistory = {
          id: `history-${Date.now()}`,
          chunkId: currentChunk.id,
          date: new Date().toISOString(),
          accuracy: result.accuracy,
          stars: result.stars
        };
        await addHistory(historyItem);

        // Trigger next auto-progression if criteria met (4 or 5 stars)
        // Auto-progression delayed by 2.5s or via Next button
      },
      (error) => {
        setSpeechError(error);
        setIsRecording(false);
      },
      () => {
        setIsRecording(false);
      }
    );
  };

  const handleStopRecording = () => {
    if (speechServiceRef.current) {
      speechServiceRef.current.stopListening();
    }
  };

  const handleNext = () => {
    if (currentIndex < practiceList.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      alert("Chúc mừng! Bạn đã hoàn thành toàn bộ danh sách luyện tập hiện tại.");
      onFinish();
    }
  };

  // Check if transition required or option offered
  const achievedTarget = evaluation && evaluation.stars >= 4;
  const reachedMaxAttempts = attempts >= 3;
  const canProceed = achievedTarget || reachedMaxAttempts;

  return (
    <div id="practice-game-view" className="max-w-2xl mx-auto space-y-6 page-fade-enter page-fade-enter-active text-left">
      {/* Game progress header */}
      <div className="flex items-center justify-between bg-white px-6 py-4 rounded-2xl border border-neutral-200/80 shadow-3xs">
        <div className="space-y-0.5">
          <span className="text-xs font-mono text-neutral-400">PRACTICE GAME TAB</span>
          <h3 className="font-display font-bold text-neutral-800 text-sm">
            Tiến trình: <span className="text-blue-600 font-mono">{currentIndex + 1}</span> / <span className="font-mono">{practiceList.length}</span> câu
          </h3>
        </div>
        <button
          onClick={onFinish}
          className="text-xs bg-neutral-100 hover:bg-neutral-200 text-neutral-600 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
        >
          Thoát Game
        </button>
      </div>

      {/* Main Chunk Card Workspace */}
      <div className="bg-white rounded-3xl border border-neutral-200/90 shadow-sm p-8 space-y-8 relative overflow-hidden">
        {/* Background Accent */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-bl-full opacity-50 pointer-events-none" />

        {/* Learning language & Meaning units */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="bg-blue-600 text-white font-bold text-xs uppercase tracking-wider px-2.5 py-1 rounded-lg">
              {currentChunk.language}
            </span>
            <span className="text-xs text-neutral-400 font-mono">Nguồn: {currentChunk.sourceDiaryTitle}</span>
          </div>

          {/* Interactive Chunk Display */}
          <div className="space-y-4 py-4 text-center">
            {/* Main string with tap-to-speak words */}
            <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-3">
              {words.map((word, idx) => (
                <button
                  key={idx}
                  data-tts="true"
                  onClick={() => speakText(word, currentChunk.language)}
                  className="font-display font-bold text-2xl sm:text-3xl text-neutral-800 hover:text-blue-600 hover:bg-blue-50 hover:scale-105 px-2 py-1 rounded-xl border border-transparent hover:border-blue-200 transition-all cursor-pointer select-none"
                  title="Chạm để nghe từ này"
                >
                  {word}
                </button>
              ))}
            </div>

            {/* Pronunciation supports: Romanization & IPA */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2 text-sm">
              {currentChunk.ipa && (
                <span className="font-mono text-xs bg-neutral-50 border border-neutral-150 px-3 py-1 rounded-full text-blue-600" title="Phiên âm IPA">
                  IPA: {currentChunk.ipa}
                </span>
              )}
              {currentChunk.romanization && (
                <span className="font-mono text-xs bg-amber-50/60 border border-amber-150 px-3 py-1 rounded-full text-amber-700" title="Cách đọc phiên âm Romanization">
                  Romanized: {currentChunk.romanization}
                </span>
              )}
            </div>

            {/* Native Meaning */}
            <p className="text-neutral-500 font-light text-base sm:text-lg">
              Ý nghĩa: <strong className="font-medium text-neutral-800">{currentChunk.meaning}</strong>
            </p>
          </div>
        </div>

        {/* Word Interaction Tools (Sentence -> Phrase -> Word) */}
        <div className="bg-neutral-50 p-4 rounded-2xl border border-neutral-150 space-y-3">
          <span className="text-[10px] font-mono font-semibold tracking-wider text-neutral-400 uppercase">Interactive audio guide (Chạm để nghe riêng biệt)</span>
          <div className="flex flex-wrap gap-2 items-center">
            {/* Play whole sentence */}
            <button
              data-tts="true"
              onClick={() => speakText(currentChunk.text, currentChunk.language)}
              className="flex items-center gap-1.5 bg-white hover:bg-neutral-100 border border-neutral-200 text-neutral-700 text-xs px-3 py-1.5 rounded-lg shadow-3xs transition-all cursor-pointer"
            >
              <Volume2 size={13} className="text-blue-500" />
              <span>Cả câu 🔊</span>
            </button>

            {/* Play phrases */}
            {phrases.map((phrase, idx) => (
              <button
                key={idx}
                data-tts="true"
                onClick={() => speakText(phrase, currentChunk.language)}
                className="flex items-center gap-1.5 bg-white hover:bg-neutral-100 border border-neutral-200 text-neutral-700 text-xs px-3 py-1.5 rounded-lg shadow-3xs transition-all cursor-pointer"
              >
                <span>Cụm {idx+1}: <strong>"{phrase}"</strong> 🔊</span>
              </button>
            ))}
          </div>
        </div>

        {/* Recording Panel / Microphone Trigger */}
        <div className="flex flex-col items-center justify-center space-y-4 pt-4 border-t border-neutral-100">
          {isRecording ? (
            <div className="flex flex-col items-center space-y-3">
              {/* Pulsing Visual Effect */}
              <div className="flex items-center gap-1 justify-center h-12">
                <span className="w-1.5 bg-red-500 rounded-full animate-[bounce_1s_infinite_100ms] h-6" />
                <span className="w-1.5 bg-red-500 rounded-full animate-[bounce_1s_infinite_200ms] h-10" />
                <span className="w-1.5 bg-red-500 rounded-full animate-[bounce_1s_infinite_300ms] h-8" />
                <span className="w-1.5 bg-red-500 rounded-full animate-[bounce_1s_infinite_400ms] h-12" />
                <span className="w-1.5 bg-red-500 rounded-full animate-[bounce_1s_infinite_500ms] h-6" />
              </div>
              <button
                id="btn-stop-recording"
                onClick={handleStopRecording}
                className="flex items-center gap-2 bg-rose-600 hover:bg-rose-700 text-white px-6 py-3.5 rounded-2xl font-bold shadow-lg shadow-rose-200 cursor-pointer animate-pulse"
              >
                <MicOff size={18} />
                Đang Ghi Âm... Chạm Để Dừng
              </button>
              <span className="text-xs text-neutral-400 font-light">Hãy nói to, rõ ràng toàn bộ cụm từ trên.</span>
            </div>
          ) : (
            <div className="flex flex-col items-center space-y-3">
              <button
                id="btn-start-recording"
                onClick={handleStartRecording}
                disabled={canProceed && achievedTarget}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-neutral-100 disabled:text-neutral-300 text-white px-8 py-4 rounded-2xl font-bold shadow-lg shadow-blue-200 hover:shadow-xl transition-all active:scale-95 cursor-pointer disabled:cursor-not-allowed"
              >
                <Mic size={20} />
                Chạm &amp; Đọc To Toàn Câu
              </button>
              <span className="text-xs text-neutral-400 font-light">
                {attempts > 0 ? `Đã thực hiện: ${attempts}/3 lần` : "AI sẽ lắng nghe, phân tích và chấm điểm độ chính xác!"}
              </span>
            </div>
          )}

          {speechError && (
            <div className="bg-rose-50 text-rose-800 text-xs border border-rose-100 p-3 rounded-xl max-w-sm text-center">
              {speechError}
            </div>
          )}
        </div>
      </div>

      {/* Evaluation Results Banner */}
      {showResult && evaluation && (
        <div className="bg-white rounded-3xl border border-neutral-200 p-6 shadow-md space-y-6 animate-scaleUp text-center">
          {/* Main score metrics */}
          <div className="flex flex-col sm:flex-row items-center justify-between border-b border-neutral-100 pb-4 gap-4">
            <div className="text-left space-y-1">
              <span className="text-[10px] font-mono uppercase bg-neutral-100 text-neutral-500 px-2.5 py-0.5 rounded font-bold">KẾT QUẢ ĐỌC PHÁT ÂM</span>
              <p className="text-xs text-neutral-400">Bạn vừa đọc: <strong className="text-neutral-600 italic">"{evaluation.spokenText}"</strong></p>
            </div>

            <div className="flex items-center gap-4">
              {/* Stars display */}
              <div className="flex items-center gap-1 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-xl text-amber-600 font-mono text-sm font-semibold">
                {Array.from({ length: 5 }).map((_, idx) => {
                  const isFilled = idx < evaluation.stars;
                  return (
                    <Star
                      key={idx}
                      size={14}
                      className={isFilled ? "text-amber-400" : "text-neutral-200"}
                      fill={isFilled ? "currentColor" : "none"}
                    />
                  );
                })}
              </div>

              {/* Accuracy percentage */}
              <div className="bg-emerald-50 border border-emerald-200 px-4 py-1.5 rounded-xl text-emerald-700 font-mono text-base font-bold">
                {evaluation.accuracy}%
              </div>
            </div>
          </div>

          {/* Word feedback highlights: Green = good, Yellow = improve, Red = wrong */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">Chi tiết sửa lỗi phát âm</h4>
            <div className="flex flex-wrap justify-center gap-2 py-2">
              {evaluation.wordFeedback.map((wordObj, idx) => {
                let colorClass = "bg-rose-100 text-rose-800 border-rose-200";
                if (wordObj.status === "good") {
                  colorClass = "bg-emerald-100 text-emerald-800 border-emerald-200";
                } else if (wordObj.status === "improve") {
                  colorClass = "bg-yellow-100 text-yellow-800 border-yellow-200";
                }

                return (
                  <span
                    key={idx}
                    className={`px-3 py-1 border rounded-lg text-sm font-semibold transition-all ${colorClass}`}
                    title={
                      wordObj.status === "good"
                        ? "Phát âm tốt"
                        : wordObj.status === "improve"
                        ? "Cần cải thiện hơn"
                        : "Phát âm sai hoặc thiếu"
                    }
                  >
                    {wordObj.word}
                  </span>
                );
              })}
            </div>
            
            {/* Guide notes */}
            <div className="flex items-center justify-center gap-6 text-[10px] text-neutral-400 font-mono">
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-emerald-500 rounded" /> Đúng</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-yellow-400 rounded" /> Khá</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-rose-500 rounded" /> Cần sửa</span>
            </div>
          </div>

          {/* Actions & Progression Logic */}
          <div className="border-t border-neutral-100 pt-4 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-left">
              {achievedTarget ? (
                <div className="flex items-center gap-1.5 text-emerald-600 font-semibold text-sm">
                  <CheckCircle2 size={16} />
                  <span>Tuyệt vời! Đạt {evaluation.stars} sao ({evaluation.accuracy}%). Bạn có thể sang câu tiếp theo.</span>
                </div>
              ) : reachedMaxAttempts ? (
                <div className="flex items-center gap-1.5 text-amber-600 font-semibold text-sm">
                  <AlertTriangle size={16} />
                  <span>Đã đạt 3 lần thử. Hãy tiếp tục tiến trình để tránh nản lòng nhé!</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-neutral-500 font-light text-xs">
                  <span>Mục tiêu là đạt 4 hoặc 5 sao để tự động chuyển câu. Bạn hãy thử lại xem sao!</span>
                </div>
              )}
            </div>

            <div className="flex gap-2 w-full sm:w-auto shrink-0">
              {!achievedTarget && !reachedMaxAttempts && (
                <button
                  onClick={handleStartRecording}
                  className="flex-1 sm:flex-initial flex items-center justify-center gap-1 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 px-4 py-2.5 rounded-xl text-xs font-semibold cursor-pointer transition-all"
                >
                  <RefreshCw size={12} />
                  Đọc lại
                </button>
              )}
              
              {/* Proceed Button */}
              <button
                id="btn-next-chunk"
                onClick={handleNext}
                className={`flex-1 sm:flex-initial flex items-center justify-center gap-1 px-5 py-2.5 rounded-xl text-xs font-bold transition-all active:scale-95 cursor-pointer ${
                  canProceed 
                    ? "bg-blue-600 hover:bg-blue-700 text-white shadow-xs" 
                    : "bg-neutral-100 hover:bg-neutral-200 text-neutral-600"
                }`}
              >
                <span>{currentIndex < practiceList.length - 1 ? "Câu tiếp theo" : "Hoàn thành"}</span>
                <ArrowRight size={13} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
