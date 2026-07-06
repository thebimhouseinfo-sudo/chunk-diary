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
  Trash2,
  X,
  User,
  Languages,
  Target
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

async function callAI(prompt: string, settings: UserSettings, provider: "gemini" | "openai" | "xai", modelName: string) {
  const apiKey = settings.apiKey;
  if (provider === "gemini") {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
    const payload = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            meaningUnits: {
              type: "ARRAY",
              items: {
                type: "OBJECT",
                properties: {
                  order: { type: "INTEGER" },
                  nativeText: { type: "STRING" },
                  englishPivot: { type: "STRING" },
                  chunks: {
                    type: "ARRAY",
                    items: {
                      type: "OBJECT",
                      properties: {
                        language: { type: "STRING" },
                        text: { type: "STRING" },
                        meaning: { type: "STRING" },
                        ipa: { type: "STRING" },
                        romanization: { type: "STRING" }
                      },
                      required: ["language", "text", "meaning", "ipa", "romanization"]
                    }
                  }
                },
                required: ["order", "nativeText", "englishPivot", "chunks"]
              }
            }
          },
          required: ["meaningUnits"]
        }
      }
    };

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      const errMsg = errData.error?.message || res.statusText || "Lỗi API từ phía Gemini";
      throw new Error(`Gemini Client API Error: ${errMsg}`);
    }

    const data = await res.json();
    const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!generatedText) {
      throw new Error("Không nhận được phản hồi hợp lệ từ Gemini API.");
    }
    return JSON.parse(generatedText);
  } else {
    const baseUrl = provider === "openai" ? "https://api.openai.com/v1" : "https://api.xai.com/v1";
    const url = `${baseUrl}/chat/completions`;
    const payload = {
      model: modelName,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" }
    };

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      const errMsg = errData.error?.message || res.statusText || `Lỗi API từ phía ${provider.toUpperCase()}`;
      throw new Error(`${provider.toUpperCase()} Client API Error: ${errMsg}`);
    }

    const data = await res.json();
    const generatedText = data.choices?.[0]?.message?.content;
    if (!generatedText) {
      throw new Error(`Không nhận được phản hồi hợp lệ từ ${provider.toUpperCase()} API.`);
    }
    return JSON.parse(generatedText);
  }
}

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
  const [errorDetails, setErrorDetails] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  // Onboarding state
  const [onboardingData, setOnboardingData] = useState({
    nickname: "",
    nativeLanguage: "Vietnamese",
    learningLanguage: "English",
    goal: ""
  });

  const steps = [
    { name: "Phân tích nội dung", description: "Đang hiểu ngữ cảnh nhật ký..." },
    { name: "Chuyển đổi ngôn ngữ", description: "Đang tạo các Meaning Units & English Pivot..." },
    { name: "Trích xuất Chunks", description: "Đang tạo cụm từ, IPA và Romanization..." },
    { name: "Lưu vào cơ sở dữ liệu", description: "Đang hoàn tất lưu trữ..." }
  ];

  useEffect(() => {
    fetchDiaries();
    const saved = localStorage.getItem("user_settings");
    if (saved) {
      const parsed = JSON.parse(saved);
      setSettings(parsed);
      if (!parsed.onboarded) {
        setShowOnboarding(true);
      }
    } else {
      setShowOnboarding(true);
    }
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

  const handleOnboardingSubmit = () => {
    const newSettings: UserSettings = {
      nativeLanguage: onboardingData.nativeLanguage,
      learningLanguages: [onboardingData.learningLanguage],
      aiProvider: "gemini",
      apiKey: settings?.apiKey || "",
      modelPriorityList: settings?.modelPriorityList || {
        gemini: ["gemini-2.0-flash", "gemini-1.5-flash"],
        openai: ["gpt-4o-mini", "gpt-4o"],
        xai: ["grok-beta"]
      },
      nickname: onboardingData.nickname,
      learningGoal: onboardingData.goal,
      onboarded: true
    };
    setSettings(newSettings);
    localStorage.setItem("user_settings", JSON.stringify(newSettings));
    setShowOnboarding(false);
  };

  const handleGenerate = async () => {
    if (!content.trim() || !settings) return;
    setIsGenerating(true);
    setCurrentStep(0);
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

      setCurrentStep(1);
      const aiResponse = await callAI(
        prompt,
        settings,
        settings.aiProvider,
        settings.modelPriorityList[settings.aiProvider][0]
      );

      setCurrentStep(2);
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

      setCurrentStep(3);
      await fetchDiaries();
      const allDiaries = await getDiaries();
      const newlyCreated = allDiaries.find(d => d.id === diaryId);
      if (newlyCreated) handleSelectDiary(newlyCreated);
      
      setTitle("");
      setContent("");
    } catch (err: any) {
      setErrorDetails(err.message || "Lỗi không xác định");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 relative">
      {/* Onboarding Overlay */}
      {showOnboarding && (
        <div className="fixed inset-0 z-[100] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl p-8 space-y-6 animate-pageFadeIn">
            <div className="text-center space-y-2">
              <div className="w-16 h-16 bg-vibrant-indigo/10 rounded-2xl flex items-center justify-center mx-auto text-vibrant-indigo">
                <Sparkles size={32} />
              </div>
              <h2 className="text-2xl font-display font-black text-slate-900">Chào mừng bạn!</h2>
              <p className="text-sm text-slate-500 font-medium">Hãy để ChunkDiary hiểu bạn hơn một chút nhé.</p>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  <User size={12} /> Biệt danh
                </label>
                <input
                  type="text"
                  placeholder="Vd: Alex, Sarah..."
                  value={onboardingData.nickname}
                  onChange={(e) => setOnboardingData({...onboardingData, nickname: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-sm font-semibold outline-none focus:border-vibrant-indigo transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    <Languages size={12} /> Mẹ đẻ
                  </label>
                  <input
                    type="text"
                    value={onboardingData.nativeLanguage}
                    onChange={(e) => setOnboardingData({...onboardingData, nativeLanguage: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-sm font-semibold outline-none focus:border-vibrant-indigo transition-all"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    <Target size={12} /> Đang học
                  </label>
                  <input
                    type="text"
                    value={onboardingData.learningLanguage}
                    onChange={(e) => setOnboardingData({...onboardingData, learningLanguage: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-sm font-semibold outline-none focus:border-vibrant-indigo transition-all"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  Mục tiêu học Tiếng Anh?
                </label>
                <textarea
                  placeholder="Vd: Đi làm, du lịch, giao tiếp..."
                  rows={2}
                  value={onboardingData.goal}
                  onChange={(e) => setOnboardingData({...onboardingData, goal: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-sm font-medium outline-none focus:border-vibrant-indigo transition-all resize-none"
                />
              </div>
            </div>

            <button
              onClick={handleOnboardingSubmit}
              disabled={!onboardingData.nickname || !onboardingData.goal}
              className="w-full bg-vibrant-indigo hover:bg-vibrant-indigo/90 disabled:bg-slate-100 disabled:text-slate-400 text-white py-4 rounded-[1.5rem] font-black uppercase tracking-tight shadow-lg transition-all active:scale-95"
            >
              Bắt đầu ngay
            </button>
          </div>
        </div>
      )}

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
              {isGenerating ? "Đang xử lý..." : "Phân tích bằng AI"}
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
        {isGenerating && (
          <div className="bg-white p-6 sm:p-8 rounded-[2rem] border border-slate-100 shadow-md space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <h3 className="font-display font-black text-slate-900">AI Pipeline</h3>
              <div className="flex items-center gap-2 text-[10px] text-vibrant-indigo bg-vibrant-indigo/10 px-3 py-1 rounded-full animate-pulse">
                <span className="w-1.5 h-1.5 bg-vibrant-indigo rounded-full" />
                <span className="font-black">PROCESSING</span>
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
                  <div>
                    <p className={`text-sm font-bold ${idx === currentStep ? "text-vibrant-indigo" : "text-slate-500"}`}>{step.name}</p>
                    <p className="text-[10px] text-slate-400">{step.description}</p>
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
