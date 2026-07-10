import React, { useState, useEffect } from "react";
import {
  Plus,
  Send,
  CheckCircle,
  AlertTriangle,
  Play,
  ChevronRight,
  ChevronLeft,
  Calendar,
  Sparkles,
  Layers,
  History,
  Trash2
} from "lucide-react";
import {
  saveDiary,
  getDiaries,
  getMeaningUnitsForDiary,
  getChunksByMeaningUnitId,
  saveMeaningUnit,
  saveChunk,
  deleteDiary
} from "../db/indexedDb";
import { Diary, MeaningUnit, Chunk, UserSettings } from "../types";
import { speakText } from "../utils/tts";
import { callBackgroundAIService } from "../utils/aiService";

interface MyDiaryViewProps {
  onStartPractice: (chunks: Chunk[]) => void;
  onNavigate: (tab: string) => void;
}

export default function MyDiaryView({ onStartPractice, onNavigate }: MyDiaryViewProps) {
  const [diaries, setDiaries] = useState<Diary[]>([]);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [selectedDiary, setSelectedDiary] = useState<Diary | null>(null);
  const [selectedDiaryMUs, setSelectedDiaryMUs] = useState<MeaningUnit[]>([]);
  const [selectedDiaryChunks, setSelectedDiaryChunks] = useState<Chunk[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [queueMessage, setQueueMessage] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  const steps = [
    { name: "Đang kết nối", description: "Đang gửi yêu cầu của bạn tới máy chủ hàng đợi..." },
    { name: "Đang xếp hàng", description: "Đang xếp hàng chờ đến lượt xử lý (Pending)..." },
    { name: "Đang xử lý bằng AI", description: "Gemini đang tiến hành phân tích nội dung (Processing)..." },
    { name: "Hoàn tất & Lưu trữ", description: "Đang đồng bộ hóa kết quả vào cơ sở dữ liệu trên thiết bị..." }
  ];

  useEffect(() => {
    fetchDiaries();
    const saved = localStorage.getItem("user_settings");
    if (saved) setSettings(JSON.parse(saved));
  }, []);

  const fetchDiaries = async () => {
    const all = await getDiaries();
    setDiaries(all);
  };

  const handleSelectDiary = async (diary: Diary) => {
    setSelectedDiary(diary);
    const mus = await getMeaningUnitsForDiary(diary.id!);
    setSelectedDiaryMUs(mus);
    
    const allChunks: Chunk[] = [];
    for (const mu of mus) {
      const chunks = await getChunksByMeaningUnitId(mu.id!);
      allChunks.push(...chunks);
    }
    setSelectedDiaryChunks(allChunks);
    setShowHistory(false);
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("Xóa nhật ký này?")) {
      await deleteDiary(id);
      fetchDiaries();
      if (selectedDiary?.id === id) {
        setSelectedDiary(null);
        setSelectedDiaryMUs([]);
        setSelectedDiaryChunks([]);
      }
    }
  };

  const handleGenerate = async () => {
    if (!content.trim() || !settings) return;
    setIsGenerating(true);
    setCurrentStep(0);
    setQueueMessage("Khởi tạo yêu cầu dịch thuật...");
    setErrorDetails(null);

    try {
      const diaryId = await saveDiary({
        title: title || `Nhật ký ngày ${new Date().toLocaleDateString("vi-VN")}`,
        content,
        createdAt: new Date().toISOString()
      });

      const prompt = `Hãy xử lý nhật ký sau: "${content}".
      Ngôn ngữ gốc: ${settings.nativeLanguage}.
      Ngôn ngữ học: ${settings.learningLanguages.join(", ")}.
      Trả về JSON với cấu trúc meaningUnits. English Pivot là bắt buộc.`;

      const aiResponse = await callBackgroundAIService(prompt, (status, message) => {
        setQueueMessage(message);
        if (status === "Pending") {
          if (message.includes("kết nối")) {
            setCurrentStep(0);
          } else {
            setCurrentStep(1);
          }
        } else if (status === "Processing") {
          setCurrentStep(2);
        } else if (status === "Completed") {
          setCurrentStep(3);
        }
      });

      setQueueMessage("Đang lưu trữ dữ liệu các chunks dịch thuật...");
      setCurrentStep(3);
      for (const muData of aiResponse.meaningUnits) {
        const muId = await saveMeaningUnit({
          diaryId,
          nativeText: muData.nativeText,
          englishPivot: muData.englishPivot,
          order: muData.order
        });

        for (const chunkData of muData.chunks) {
          await saveChunk({
            meaningUnitId: muId,
            language: chunkData.language,
            text: chunkData.text,
            meaning: chunkData.meaning,
            ipa: chunkData.ipa,
            romanization: chunkData.romanization,
            stars: 0,
            bestAccuracy: 0,
            timesPracticed: 0,
            lastPracticed: "",
            sourceDiaryId: diaryId,
            sourceDiaryTitle: title || `Nhật ký ngày ${new Date().toLocaleDateString("vi-VN")}`
          });
        }
      }

      await fetchDiaries();
      const allDiaries = await getDiaries();
      const newlyCreated = allDiaries.find(d => d.id === diaryId);
      if (newlyCreated) handleSelectDiary(newlyCreated);
      
      setTitle("");
      setContent("");
    } catch (err: any) {
      setErrorDetails(err.message || "Lỗi kết nối hoặc xử lý hàng đợi AI");
    } finally {
      setIsGenerating(false);
      setQueueMessage(null);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8">
      {/* Left: Input Form & History Toggle (Mobile) */}
      <div className="lg:col-span-5 space-y-6">
        <div className="bg-white p-6 sm:p-8 rounded-[2rem] border border-slate-100 shadow-md space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 text-vibrant-indigo font-display font-black text-xl">
              <Plus className="text-vibrant-coral" size={24} />
              <h2>Viết Nhật Ký</h2>
            </div>
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="lg:hidden p-2 bg-slate-50 rounded-xl text-slate-500"
            >
              <History size={20} />
            </button>
          </div>

          <div className="space-y-4">
            <input
              type="text"
              placeholder="Tiêu đề (Tùy chọn)..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-slate-50 border border-slate-100 focus:border-vibrant-indigo rounded-2xl px-4 py-3 text-sm font-semibold outline-none transition-all"
            />
            <textarea
              placeholder="Hôm nay của bạn thế nào? Hãy viết bằng tiếng Việt..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={6}
              className="w-full bg-slate-50 border border-slate-100 focus:border-vibrant-indigo rounded-2xl px-4 py-3 text-sm font-medium outline-none transition-all resize-none"
            />
            <button
              onClick={handleGenerate}
              disabled={isGenerating || !content.trim()}
              className="w-full flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-200 text-white py-4 rounded-2xl font-black uppercase tracking-tight shadow-lg transition-all active:scale-95"
            >
              <Send size={18} />
              {isGenerating ? "Đang xếp hàng..." : "Phân tích bằng AI"}
            </button>
          </div>
        </div>

        {/* Desktop History / Mobile Drawer-like history */}
        <div className={`${showHistory ? "block" : "hidden"} lg:block bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden`}>
          <div className="p-5 border-b border-slate-50 bg-slate-50/50 flex items-center justify-between">
            <h3 className="font-display font-black text-slate-800 text-sm uppercase tracking-wider flex items-center gap-2">
              <History size={16} /> Lịch sử
            </h3>
            <span className="bg-white px-2 py-0.5 rounded-lg text-[10px] font-bold text-slate-400 border border-slate-100">{diaries.length}</span>
          </div>
          <div className="max-h-[400px] overflow-y-auto divide-y divide-slate-50">
            {diaries.map((d) => (
              <div
                key={d.id}
                onClick={() => handleSelectDiary(d)}
                className={`p-4 flex items-center justify-between hover:bg-slate-50 cursor-pointer transition-colors ${selectedDiary?.id === d.id ? "bg-vibrant-indigo/5 border-l-4 border-l-vibrant-indigo" : ""}`}
              >
                <div className="space-y-1 truncate pr-2">
                  <h4 className="text-sm font-bold text-slate-800 truncate">{d.title}</h4>
                  <p className="text-[10px] text-slate-400 font-medium">{new Date(d.createdAt).toLocaleDateString("vi-VN")}</p>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={(e) => handleDelete(d.id!, e)} className="p-2 text-slate-300 hover:text-vibrant-coral"><Trash2 size={14} /></button>
                  <ChevronRight size={16} className="text-slate-200" />
                </div>
              </div>
            ))}
            {diaries.length === 0 && <div className="p-8 text-center text-slate-400 text-xs italic">Chưa có bài viết nào.</div>}
          </div>
        </div>
      </div>

      {/* Right: Results / Progress */}
      <div className="lg:col-span-7 space-y-6">
        {errorDetails && (
          <div className="bg-rose-50 border border-rose-100 p-6 rounded-[2rem] flex items-start gap-3.5 text-rose-900 animate-pageFadeIn shadow-sm">
            <AlertTriangle className="text-vibrant-coral shrink-0 mt-0.5" size={20} />
            <div className="space-y-1">
              <h4 className="font-display font-black text-sm uppercase tracking-wider">Lỗi xử lý AI</h4>
              <p className="text-xs font-medium leading-relaxed">{errorDetails}</p>
              <button
                onClick={() => setErrorDetails(null)}
                className="text-[10px] font-black uppercase bg-white/60 hover:bg-white text-rose-900 px-3 py-1.5 rounded-lg border border-rose-200 transition-colors mt-2"
              >
                Đóng
              </button>
            </div>
          </div>
        )}

        {isGenerating && (
          <div className="bg-white p-6 sm:p-8 rounded-[2rem] border border-slate-100 shadow-md space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <h3 className="font-display font-black text-slate-900">AI Queue Pipeline</h3>
              <div className="flex items-center gap-2 text-[10px] text-vibrant-indigo bg-vibrant-indigo/10 px-3 py-1 rounded-full animate-pulse">
                <span className="w-1.5 h-1.5 bg-vibrant-indigo rounded-full" />
                <span className="font-black">IN QUEUE</span>
              </div>
            </div>
            <div className="space-y-4">
              {steps.map((step, idx) => (
                <div key={idx} className="flex items-start gap-3">
                  <div className="pt-1">
                    {idx < currentStep ? <CheckCircle size={18} className="text-vibrant-mint" /> :
                     idx === currentStep ? <div className="w-4 h-4 border-2 border-vibrant-indigo border-t-transparent rounded-full animate-spin" /> :
                     <div className="w-4 h-4 rounded-full bg-slate-100" />}
                  </div>
                  <div className="flex-1">
                    <p className={`text-sm font-bold ${idx === currentStep ? "text-vibrant-indigo" : "text-slate-500"}`}>{step.name}</p>
                    <p className="text-[10px] text-slate-400">
                      {idx === currentStep && queueMessage ? queueMessage : step.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {selectedDiary && !isGenerating && (
          <div className="space-y-6 animate-pageFadeIn">
            <div className="bg-white p-6 sm:p-8 rounded-[2rem] border border-slate-100 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                <div>
                  <span className="text-[10px] uppercase font-mono bg-vibrant-indigo/10 text-vibrant-indigo px-2.5 py-1 rounded-full font-black">Chi tiết</span>
                  <h3 className="font-display font-black text-slate-900 text-xl pt-1">{selectedDiary.title}</h3>
                </div>
                {selectedDiaryChunks.length > 0 && (
                  <button
                    onClick={() => onStartPractice(selectedDiaryChunks)}
                    className="flex items-center justify-center gap-2 bg-slate-900 text-white px-5 py-3 rounded-2xl text-[10px] font-black uppercase tracking-tight shadow-md"
                  >
                    <Play size={12} fill="currentColor" /> Luyện tập ({selectedDiaryChunks.length})
                  </button>
                )}
              </div>
              <div className="bg-slate-50 p-4 sm:p-6 rounded-2xl text-xs sm:text-sm text-slate-600 italic border border-slate-100">
                "{selectedDiary.content}"
              </div>
            </div>

            <div className="space-y-4">
              {selectedDiaryMUs.map((mu, idx) => {
                const chunks = selectedDiaryChunks.filter(c => c.meaningUnitId === mu.id);
                return (
                  <div key={mu.id} className="bg-white border border-slate-100 rounded-[1.5rem] p-5 sm:p-6 space-y-4 shadow-sm">
                    <div className="flex items-start gap-3 border-b border-slate-50 pb-3">
                      <span className="w-6 h-6 rounded-lg bg-vibrant-indigo text-white flex items-center justify-center font-mono text-[10px] font-black shrink-0">{idx + 1}</span>
                      <div>
                        <p className="text-sm font-bold text-slate-800">{mu.nativeText}</p>
                        <p className="text-[10px] text-vibrant-coral font-bold italic pt-1">Pivot: "{mu.englishPivot}"</p>
                      </div>
                    </div>
                    <div className="space-y-3">
                      {chunks.map(chunk => (
                        <div key={chunk.id} className="bg-slate-50/50 p-3 sm:p-4 rounded-xl flex items-center justify-between gap-3">
                          <div className="flex-1 space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-[9px] font-black text-vibrant-indigo bg-vibrant-indigo/10 px-1.5 py-0.5 rounded">{chunk.language}</span>
                              <span className="text-sm font-black text-slate-900">{chunk.text}</span>
                            </div>
                            <div className="text-[10px] text-slate-500 font-medium flex flex-wrap gap-x-3">
                              <span>Nghĩa: <strong className="text-slate-700">{chunk.meaning}</strong></span>
                              {chunk.ipa && <span>IPA: <strong className="text-vibrant-indigo font-mono">{chunk.ipa}</strong></span>}
                            </div>
                          </div>
                          <button onClick={() => speakText(chunk.text, chunk.language)} className="p-2.5 bg-white border border-slate-100 rounded-lg shadow-sm">🔊</button>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
