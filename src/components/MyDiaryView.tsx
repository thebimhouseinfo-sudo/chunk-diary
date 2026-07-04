import React, { useState, useEffect } from "react";
import { BookOpen, Sparkles, Send, Calendar, ChevronRight, Play, CheckCircle, AlertTriangle, Trash2, Globe, ArrowRight } from "lucide-react";
import { Diary, MeaningUnit, Chunk, UserSettings, GenerationStep } from "../types";
import { getDiaries, saveDiary, saveMeaningUnits, saveChunks, getSettings, saveSettings, deleteDiary, getMeaningUnitsForDiary, getChunks } from "../db/indexedDb";
import { speakText } from "../utils/tts";

async function callAiClientSide(reqBody: any) {
  const { provider, apiKey, nativeLanguage, learningLanguages, diaryContent, onboarding, models } = reqBody;

  if (!apiKey) {
    throw new Error(
      "Không thể kết nối máy chủ dịch thuật và chưa cấu hình API Key. Vui lòng vào Cài đặt để điền API Key của bạn để sử dụng chế độ chạy trực tiếp (client-side) trên GitHub Pages!"
    );
  }

  const modelName = models?.[0] || (provider === "gemini" ? "gemini-2.5-flash" : "gpt-4o-mini");

  let userContextPrompt = "";
  if (onboarding) {
    const { nickname, learningPurposes, industryCategory, industry, hobbyCategory, hobby } = onboarding;
    const purposesStr = learningPurposes && learningPurposes.length > 0 ? learningPurposes.join(", ") : "";
    
    let workContext = "";
    if (learningPurposes?.includes("Công việc")) {
      workContext = `- Nhóm ngành nghề (Dropdown): ${industryCategory || "N/A"}\n- Chi tiết công việc (Mô tả): ${industry || "N/A"}`;
    }
    
    let hobbyContext = "";
    if (learningPurposes?.includes("Sở thích")) {
      hobbyContext = `- Nhóm sở thích (Dropdown): ${hobbyCategory || "N/A"}\n- Chi tiết sở thích (Mô tả): ${hobby || "N/A"}`;
    }

    userContextPrompt = `\nUser Context for personalized chunk optimization:
- User Nickname: ${nickname || "User"}
- Purpose of learning: ${purposesStr || "Not specified"}
${workContext ? `\n[Work Focus]\n${workContext}` : ""}
${hobbyContext ? `\n[Hobby Focus]\n${hobbyContext}` : ""}

*CRITICAL OPTIMIZATION GUIDELINE*:
Please customize/optimize the extracted language chunks, translations, and supplementary explanations (like IPA/notes) to be highly relevant to the user's background, profession, or hobbies specified above:
1. If learning for "Công việc" (Work), prioritize professional, corporate, and office-friendly vocabulary or idioms relevant to their field (${industryCategory} / ${industry}). Prefer polite forms (e.g. Keigo in Japanese, formal register in English/French).
2. If learning for "Sở thích" (Hobbies), prioritize words, idioms, or slang that an enthusiastic native would use in the context of their specific hobby category (${hobbyCategory} / ${hobby}).
3. When appropriate, write a short, helpful professional/hobbyist application tip or tone indicator directly within the "meaning" of the generated chunks so the user understands exactly when and how to deploy this chunk.
`;
  }

  const prompt = `You are an expert language teacher and translator specializing in chunk-based learning.
Native Language: ${nativeLanguage}
Learning Languages: ${learningLanguages.join(", ")}
Diary Content: "${diaryContent}"${userContextPrompt}

Please process this diary according to these guidelines:
1. Understand the exact meaning of the diary in ${nativeLanguage}.
2. Split it into a series of logical "Meaning Units" (sentences or complete thoughts) in order.
3. For each Meaning Unit:
   - Provide the original text in ${nativeLanguage} (nativeText).
   - Translate it into natural, idiomatic English (englishPivot) as an intermediary translation (English Pivot).
   - For each requested learning language, translate the Meaning Unit into a natural, native-like sentence.
   - For each translated sentence, extract 1 to 3 "Language Chunks" (natural, idiomatic units of language like collocations, phrases, or short sentences, NOT just single words unless the word itself is an idiom).
   - For each extracted chunk, generate:
     * text: The exact chunk text in the learning language.
     * meaning: The translation of this chunk back into ${nativeLanguage}.
     * ipa: International Phonetic Alphabet (IPA) pronunciation guide (e.g., /haʊ z ɪt ˈɡoʊɪŋ/ or equivalent).
     * romanization: Easy-to-read romanization of the chunk text. ONLY if the language does NOT use the Latin alphabet (e.g. Chinese, Japanese, Korean, Russian, Greek, Hindi, Arabic). For these languages, format the romanization with syllable separators (e.g. "Sa-rang-hae-yo" or "Sa · rang · hae · yo" or "nǐ-hǎo"). If the language uses the Latin alphabet (like English, Spanish, French, German), leave romanization as empty string "".

Return a JSON object conforming exactly to this structure:
{
  "meaningUnits": [
    {
      "order": number,
      "nativeText": "string",
      "englishPivot": "string",
      "chunks": [
        {
          "language": "string",
          "text": "string",
          "meaning": "string",
          "ipa": "string",
          "romanization": "string"
        }
      ]
    }
  ]
}`;

  if (provider === "gemini") {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
    const payload = {
      contents: [
        {
          parts: [
            { text: prompt }
          ]
        }
      ],
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
    // openai or xai
    const baseUrl = provider === "openai" ? "https://api.openai.com/v1" : "https://api.xai.com/v1";
    const url = `${baseUrl}/chat/completions`;
    const payload = {
      model: modelName,
      messages: [
        { role: "user", content: prompt }
      ],
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

  // Onboarding local states
  const [onboardingNickname, setOnboardingNickname] = useState("");
  const [onboardingPurposes, setOnboardingPurposes] = useState<string[]>([]);
  const [onboardingIndustryCategory, setOnboardingIndustryCategory] = useState("");
  const [onboardingIndustry, setOnboardingIndustry] = useState("");
  const [onboardingHobbyCategory, setOnboardingHobbyCategory] = useState("");
  const [onboardingHobby, setOnboardingHobby] = useState("");
  
  // Generation & Pipeline states
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [steps, setSteps] = useState<GenerationStep[]>([
    { name: "Phân Tích Ý Nghĩa", status: "idle", description: "Đọc hiểu ngữ nghĩa gốc của nhật ký..." },
    { name: "Phân Tách Câu", status: "idle", description: "Chia nhật ký thành các phân đoạn ý nghĩa chính..." },
    { name: "English Pivot", status: "idle", description: "Chuyển đổi trung gian sang câu tiếng Anh tự nhiên..." },
    { name: "Dịch Đa Ngôn Ngữ", status: "idle", description: "Diễn đạt lại tự nhiên sang các ngôn ngữ học mục tiêu..." },
    { name: "Tách Chunks & IPA", status: "idle", description: "Trích xuất cụm từ (chunks), phiên âm IPA và Romanization..." },
    { name: "Lưu Trữ Thư Viện", status: "idle", description: "Đồng bộ hóa các chunks và meaning units vào cơ sở dữ liệu..." }
  ]);

  const [generatedMeaningUnits, setGeneratedMeaningUnits] = useState<MeaningUnit[]>([]);
  const [generatedChunks, setGeneratedChunks] = useState<Chunk[]>([]);
  const [selectedDiary, setSelectedDiary] = useState<Diary | null>(null);
  const [selectedDiaryMUs, setSelectedDiaryMUs] = useState<MeaningUnit[]>([]);
  const [selectedDiaryChunks, setSelectedDiaryChunks] = useState<Chunk[]>([]);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);

  useEffect(() => {
    loadDiaries();
    loadSettings();
  }, []);

  const loadDiaries = async () => {
    const list = await getDiaries();
    setDiaries(list);
    if (list.length > 0 && !selectedDiary) {
      loadDiaryDetails(list[0]);
    }
  };

  const loadSettings = async () => {
    const s = await getSettings();
    setSettings(s);
    if (s) {
      setOnboardingNickname(s.nickname || "");
      setOnboardingPurposes(s.learningPurposes || []);
      setOnboardingIndustryCategory(s.industryCategory || "");
      setOnboardingIndustry(s.industry || "");
      setOnboardingHobbyCategory(s.hobbyCategory || "");
      setOnboardingHobby(s.hobby || "");
    }
  };

  const loadDiaryDetails = async (diary: Diary) => {
    setSelectedDiary(diary);
    const mus = await getMeaningUnitsForDiary(diary.id);
    setSelectedDiaryMUs(mus);
    
    const allChunks = await getChunks();
    const diaryChunks = allChunks.filter(c => c.sourceDiaryId === diary.id);
    setSelectedDiaryChunks(diaryChunks);

    // Reset temporary generated preview if switching diaries
    setGeneratedChunks([]);
    setGeneratedMeaningUnits([]);
  };

  const updateStep = (index: number, status: "idle" | "running" | "done" | "error") => {
    setSteps(prev => {
      const copy = [...prev];
      copy[index].status = status;
      return copy;
    });
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    if (!settings || settings.learningLanguages.length === 0) {
      alert("Vui lòng cấu hình Ngôn ngữ đang học trong phần Cài đặt trước!");
      onNavigate("settings");
      return;
    }

    setIsGenerating(true);
    setErrorDetails(null);
    setGeneratedChunks([]);
    setGeneratedMeaningUnits([]);

    // Reset steps
    setSteps(steps.map(s => ({ ...s, status: "idle" })));

    const diaryId = `diary-${Date.now()}`;
    const finalTitle = title.trim() || `Nhật ký ${new Date().toLocaleDateString("vi-VN")}`;

    try {
      // Step 1: Understand Meaning
      setCurrentStep(0);
      updateStep(0, "running");
      await new Promise(r => setTimeout(r, 800));
      updateStep(0, "done");

      // Step 2: Split Into Units
      setCurrentStep(1);
      updateStep(1, "running");
      await new Promise(r => setTimeout(r, 800));
      updateStep(1, "done");

      // Step 3: English Pivot
      setCurrentStep(2);
      updateStep(2, "running");

      // We call the API
      const reqBody = {
        diaryContent: content,
        nativeLanguage: settings.nativeLanguage,
        learningLanguages: settings.learningLanguages,
        provider: settings.aiProvider,
        apiKey: settings.apiKey,
        models: settings.modelPriorityList[settings.aiProvider],
        onboarding: {
          nickname: settings.nickname,
          learningPurposes: settings.learningPurposes,
          industryCategory: settings.industryCategory,
          industry: settings.industry,
          hobbyCategory: settings.hobbyCategory,
          hobby: settings.hobby
        }
      };

      let aiResult;
      try {
        const response = await fetch("/api/generate-chunks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(reqBody)
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || errorData.details?.join(", ") || `Server Error ${response.status}`);
        }

        const data = await response.json();
        aiResult = data.result;
      } catch (err: any) {
        console.warn("Server API failed, attempting client-side fallback:", err);
        // Fallback to client-side direct request (critical for GitHub Pages / static hosting)
        aiResult = await callAiClientSide(reqBody);
      }

      updateStep(2, "done");

      // Step 4: Multi language Translation
      setCurrentStep(3);
      updateStep(3, "running");
      await new Promise(r => setTimeout(r, 600));
      updateStep(3, "done");

      // Step 5: Tách Chunks & IPA
      setCurrentStep(4);
      updateStep(4, "running");
      await new Promise(r => setTimeout(r, 600));
      updateStep(4, "done");

      // Step 6: Save to local library
      setCurrentStep(5);
      updateStep(5, "running");

      // Build our entities
      const newDiary: Diary = {
        id: diaryId,
        title: finalTitle,
        content: content,
        createdAt: new Date().toISOString()
      };

      const mus: MeaningUnit[] = [];
      const chunks: Chunk[] = [];

      aiResult.meaningUnits.forEach((mu: any, muIdx: number) => {
        const muId = `mu-${diaryId}-${muIdx}`;
        mus.push({
          id: muId,
          diaryId: diaryId,
          nativeText: mu.nativeText,
          englishPivot: mu.englishPivot,
          order: mu.order || (muIdx + 1)
        });

        mu.chunks.forEach((c: any, cIdx: number) => {
          chunks.push({
            id: `chunk-${diaryId}-${muIdx}-${cIdx}-${Date.now()}`,
            meaningUnitId: muId,
            language: c.language,
            text: c.text,
            meaning: c.meaning,
            ipa: c.ipa || "",
            romanization: c.romanization || "",
            stars: 0,
            bestAccuracy: 0,
            timesPracticed: 0,
            lastPracticed: "",
            sourceDiaryId: diaryId,
            sourceDiaryTitle: finalTitle
          });
        });
      });

      // Persist
      await saveDiary(newDiary);
      await saveMeaningUnits(mus);
      await saveChunks(chunks);

      updateStep(5, "done");
      await new Promise(r => setTimeout(r, 500));

      // Update previews
      setGeneratedMeaningUnits(mus);
      setGeneratedChunks(chunks);
      
      // Reset inputs
      setTitle("");
      setContent("");
      
      // Reload list and set active
      await loadDiaries();
      setSelectedDiary(newDiary);
      setSelectedDiaryMUs(mus);
      setSelectedDiaryChunks(chunks);

    } catch (err: any) {
      console.error(err);
      updateStep(currentStep, "error");
      setErrorDetails(err.message || "An unexpected error occurred during chunk generation.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDeleteDiary = async (id: string) => {
    if (confirm("Bạn có chắc chắn muốn xóa nhật ký này và tất cả các chunks học đi kèm?")) {
      await deleteDiary(id);
      setSelectedDiary(null);
      setSelectedDiaryMUs([]);
      setSelectedDiaryChunks([]);
      loadDiaries();
    }
  };

  const handleTogglePurpose = (purpose: string) => {
    setOnboardingPurposes(prev => 
      prev.includes(purpose) 
        ? prev.filter(p => p !== purpose) 
        : [...prev, purpose]
    );
  };

  const handleSaveOnboarding = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onboardingNickname.trim()) {
      alert("Vui lòng nhập biệt danh của bạn!");
      return;
    }
    if (onboardingPurposes.length === 0) {
      alert("Vui lòng chọn ít nhất một mục đích học ngôn ngữ!");
      return;
    }
    if (onboardingPurposes.includes("Công việc") && !onboardingIndustryCategory && !onboardingIndustry.trim()) {
      alert("Vui lòng chọn nhóm ngành nghề hoặc nhập chi tiết công việc của bạn!");
      return;
    }
    if (onboardingPurposes.includes("Sở thích") && !onboardingHobbyCategory && !onboardingHobby.trim()) {
      alert("Vui lòng chọn nhóm sở thích hoặc nhập chi tiết sở thích của bạn!");
      return;
    }

    if (settings) {
      const updatedSettings: UserSettings = {
        ...settings,
        onboardingComplete: true,
        nickname: onboardingNickname.trim(),
        learningPurposes: onboardingPurposes,
        industryCategory: onboardingPurposes.includes("Công việc") ? onboardingIndustryCategory : "",
        industry: onboardingPurposes.includes("Công việc") ? onboardingIndustry.trim() : "",
        hobbyCategory: onboardingPurposes.includes("Sở thích") ? onboardingHobbyCategory : "",
        hobby: onboardingPurposes.includes("Sở thích") ? onboardingHobby.trim() : ""
      };
      await saveSettings(updatedSettings);
      setSettings(updatedSettings);
    }
  };

  if (settings && !settings.onboardingComplete) {
    return (
      <div id="onboarding-view" className="max-w-xl mx-auto py-12 px-4 page-fade-enter page-fade-enter-active text-left">
        <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-xl overflow-hidden p-10 space-y-8 relative">
          <div className="absolute top-0 right-0 w-36 h-36 bg-vibrant-indigo/5 rounded-bl-full pointer-events-none" />
          
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 bg-vibrant-indigo/10 text-vibrant-indigo px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-wider">
              <Sparkles size={14} className="text-vibrant-coral animate-pulse" />
              Chào mừng bạn tham gia Chunks
            </div>
            <h2 className="font-display font-black text-slate-900 text-2xl sm:text-3xl tracking-tight leading-tight">
              Khởi Tạo Hành Trình Cá Nhân Hóa
            </h2>
            <p className="text-sm text-slate-500 font-medium leading-relaxed">
              Hãy hoàn thành khảo sát ngắn dưới đây. Trí tuệ nhân tạo (AI) sẽ sử dụng thông tin này để cá nhân hóa, tối ưu và sinh các cụm từ (chunks) học tập sát nhất với mục tiêu thực tế của bạn.
            </p>
          </div>

          <form onSubmit={handleSaveOnboarding} className="space-y-6">
            {/* Nickname */}
            <div className="space-y-2">
              <label className="text-xs font-black text-slate-400 uppercase tracking-widest block font-display">Tên hoặc biệt danh của bạn (Nickname)</label>
              <input
                id="onboarding-nickname"
                type="text"
                required
                value={onboardingNickname}
                onChange={(e) => setOnboardingNickname(e.target.value)}
                placeholder="Ví dụ: Nam Trịnh, Alice, v.v."
                className="w-full bg-slate-50 border border-slate-100 focus:border-vibrant-indigo focus:bg-white rounded-2xl px-4 py-3.5 text-sm font-semibold transition-all outline-none"
              />
            </div>

            {/* Purposes Multiple Choice */}
            <div className="space-y-3">
              <label className="text-xs font-black text-slate-400 uppercase tracking-widest block font-display">Bạn học ngoại ngữ để phục vụ điều gì?</label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { value: "Sở thích", label: "Sở thích", desc: "Du lịch, văn hóa, giải trí..." },
                  { value: "Công việc", label: "Công việc", desc: "Họp hành, phỏng vấn, email..." },
                  { value: "Khác", label: "Khác", desc: "Học tập, thi cử, định cư..." }
                ].map((item) => {
                  const isSelected = onboardingPurposes.includes(item.value);
                  return (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => handleTogglePurpose(item.value)}
                      className={`p-4 border rounded-2xl text-left transition-all flex flex-col justify-between cursor-pointer group hover:scale-[1.02] ${
                        isSelected
                          ? "bg-vibrant-indigo/5 border-vibrant-indigo/40 ring-1 ring-vibrant-indigo/35"
                          : "bg-white hover:bg-slate-50 border-slate-100"
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className={`text-sm font-black transition-colors ${isSelected ? "text-vibrant-indigo" : "text-slate-800"}`}>
                          {item.label}
                        </span>
                        <div className={`w-4 h-4 rounded-full border flex items-center justify-center transition-all ${
                          isSelected ? "bg-vibrant-indigo border-vibrant-indigo text-white" : "border-slate-300"
                        }`}>
                          {isSelected && <span className="text-[10px] font-bold">✓</span>}
                        </div>
                      </div>
                      <span className="text-[11px] text-slate-400 font-medium pt-1.5 leading-tight">{item.desc}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Industry Conditional Fields (if Công việc is selected) */}
            {onboardingPurposes.includes("Công việc") && (
              <div className="space-y-3 bg-slate-50 p-5 rounded-3xl border border-slate-100 page-fade-enter page-fade-enter-active text-left">
                <div className="space-y-1">
                  <label className="text-xs font-black text-vibrant-indigo uppercase tracking-widest block font-display">Ngành nghề hoặc lĩnh vực chuyên môn</label>
                  <p className="text-[11px] text-slate-400 font-medium">Ngành nghề cụ thể giúp AI chọn các cụm từ đắt giá của chính ngành đó!</p>
                </div>
                
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-500">Nhóm ngành nghề (Chọn mẫu chuẩn)</label>
                  <select
                    value={onboardingIndustryCategory}
                    onChange={(e) => setOnboardingIndustryCategory(e.target.value)}
                    required
                    className="w-full bg-white border border-slate-100 rounded-xl px-3 py-2.5 text-xs font-semibold outline-none transition-all cursor-pointer"
                  >
                    <option value="">-- Chọn nhóm ngành nghề --</option>
                    <option value="Công nghệ thông tin & Phát triển phần mềm">Công nghệ thông tin & Phát triển phần mềm</option>
                    <option value="Kinh doanh, Bán hàng & Marketing">Kinh doanh, Bán hàng & Marketing</option>
                    <option value="Tài chính, Ngân hàng & Kế toán">Tài chính, Ngân hàng & Kế toán</option>
                    <option value="Y tế, Dược phẩm & Chăm sóc sức khỏe">Y tế, Dược phẩm & Chăm sóc sức khỏe</option>
                    <option value="Giáo dục, Đào tạo & Nghiên cứu">Giáo dục, Đào tạo & Nghiên cứu</option>
                    <option value="Du lịch, Nhà hàng & Khách sạn">Du lịch, Nhà hàng & Khách sạn</option>
                    <option value="Nghệ thuật, Thiết kế & Sáng tạo nội dung">Nghệ thuật, Thiết kế & Sáng tạo nội dung</option>
                    <option value="Kỹ thuật, Xây dựng & Sản xuất">Kỹ thuật, Xây dựng & Sản xuất</option>
                    <option value="Luật & Hành chính Pháp lý">Luật & Hành chính Pháp lý</option>
                    <option value="Khác">Khác</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-500">Chi tiết công việc / Từ khóa bổ sung</label>
                  <input
                    id="onboarding-industry"
                    type="text"
                    required
                    value={onboardingIndustry}
                    onChange={(e) => setOnboardingIndustry(e.target.value)}
                    placeholder="Ví dụ: Backend engineer, chuyên về cloud, họp hàng ngày..."
                    className="w-full bg-white border border-slate-100 focus:border-vibrant-indigo rounded-2xl px-4 py-3 text-sm font-semibold transition-all outline-none"
                  />
                </div>

                <div className="text-[11px] text-vibrant-indigo/85 font-semibold leading-relaxed pt-1.5 border-t border-slate-100 mt-2">
                  💡 <strong>Giải thích tối ưu hóa:</strong> Khi chọn lĩnh vực chuyên môn, mô hình AI sẽ chủ động tinh chỉnh cấu trúc câu dịch, thuật ngữ và lựa chọn các cụm từ (chunks) đắt giá chuẩn công sở thuộc ngành nghề đó của bạn. Bạn sẽ lập tức được học và thực hành các câu nói tự nhiên nhất có tính ứng dụng cao nhất trong các cuộc họp, tài liệu hay giao tiếp công việc hàng ngày!
                </div>
              </div>
            )}

            {/* Hobby Conditional Fields (if Sở thích is selected) */}
            {onboardingPurposes.includes("Sở thích") && (
              <div className="space-y-3 bg-slate-50 p-5 rounded-3xl border border-slate-100 page-fade-enter page-fade-enter-active text-left">
                <div className="space-y-1">
                  <label className="text-xs font-black text-vibrant-coral uppercase tracking-widest block font-display">Sở thích học tập của riêng bạn</label>
                  <p className="text-[11px] text-slate-400 font-medium">Nhóm sở thích giúp AI tùy biến câu và cách giao tiếp tự nhiên nhất!</p>
                </div>
                
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-500">Nhóm sở thích (Chọn mẫu chuẩn)</label>
                  <select
                    value={onboardingHobbyCategory}
                    onChange={(e) => setOnboardingHobbyCategory(e.target.value)}
                    required
                    className="w-full bg-white border border-slate-100 rounded-xl px-3 py-2.5 text-xs font-semibold outline-none transition-all cursor-pointer"
                  >
                    <option value="">-- Chọn nhóm sở thích --</option>
                    <option value="Du lịch, Phượt & Khám phá">Du lịch, Phượt & Khám phá</option>
                    <option value="Xem phim, TV Series & Hoạt hình">Xem phim, TV Series & Hoạt hình</option>
                    <option value="Đọc sách, Truyện tranh & Viết lách">Đọc sách, Truyện tranh & Viết lách</option>
                    <option value="Thể thao, Gym & Sức khỏe">Thể thao, Gym & Sức khỏe</option>
                    <option value="Ẩm thực, Nấu ăn & Thưởng thức cafe">Ẩm thực, Nấu ăn & Thưởng thức cafe</option>
                    <option value="Chơi game & Khám phá Công nghệ">Chơi game & Khám phá Công nghệ</option>
                    <option value="Nghệ thuật, Vẽ tranh & Nhiếp ảnh">Nghệ thuật, Vẽ tranh & Nhiếp ảnh</option>
                    <option value="Âm nhạc & Nhạc cụ">Âm nhạc & Nhạc cụ</option>
                    <option value="Khác">Khác</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-500">Mô tả cụ thể / Chi tiết sở thích của bạn</label>
                  <input
                    id="onboarding-hobby"
                    type="text"
                    required
                    value={onboardingHobby}
                    onChange={(e) => setOnboardingHobby(e.target.value)}
                    placeholder="Ví dụ: Thích nghe nhạc Indie, thích bóng đá Ngoại hạng Anh..."
                    className="w-full bg-white border border-slate-100 focus:border-vibrant-coral rounded-2xl px-4 py-3 text-sm font-semibold transition-all outline-none"
                  />
                </div>

                <div className="text-[11px] text-vibrant-coral/85 font-semibold leading-relaxed pt-1.5 border-t border-slate-100 mt-2">
                  💡 <strong>Giải thích tối ưu hóa:</strong> Khi chọn sở thích riêng biệt, AI sẽ lồng ghép các từ vựng, từ lóng (slang), cách diễn đạt đời thường và chân thực nhất cho lĩnh vực bạn yêu mến. Điều này giúp bạn học với hứng thú tối đa!
                </div>
              </div>
            )}

            <button
              type="submit"
              className="w-full flex items-center justify-center gap-2 bg-vibrant-coral hover:bg-vibrant-coral/90 text-white font-black py-4 px-4 rounded-2xl cursor-pointer transition-all active:scale-95 shadow-lg shadow-vibrant-coral/20 uppercase tracking-tight text-xs"
            >
              Bắt đầu hành trình học Chunks
              <ArrowRight size={16} />
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div id="my-diary-view" className="grid grid-cols-1 lg:grid-cols-12 gap-8 page-fade-enter page-fade-enter-active">
      {/* Left panel: Composer & History */}
      <div className="lg:col-span-5 space-y-6">
        {/* Diary Creator form */}
        <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm space-y-6 text-left">
          <div className="flex items-center gap-2.5 text-vibrant-indigo font-display font-black text-xl">
            <Sparkles size={22} className="text-vibrant-coral" />
            <h2>Viết Nhật Ký</h2>
          </div>
          
          <form id="form-diary" onSubmit={handleGenerate} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-black text-slate-400 uppercase tracking-widest block">Tiêu đề (Không bắt buộc)</label>
              <input
                id="input-diary-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Nhập tiêu đề hoặc để trống..."
                disabled={isGenerating}
                className="w-full bg-slate-50 border border-slate-100 focus:border-vibrant-indigo focus:bg-white rounded-2xl px-4 py-3 text-sm font-medium transition-all outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-black text-slate-400 uppercase tracking-widest block">Nhật ký (Bằng tiếng mẹ đẻ)</label>
              <textarea
                id="textarea-diary-content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Hôm nay tôi khá mệt. Tôi phải họp liên tục. Nhưng cuối cùng dự án cũng hoàn thành..."
                required
                rows={5}
                disabled={isGenerating}
                className="w-full bg-slate-50 border border-slate-100 focus:border-vibrant-indigo focus:bg-white rounded-2xl px-4 py-3 text-sm font-medium transition-all outline-none resize-none"
              />
            </div>

            {/* Show settings preview */}
            <div className="flex items-center gap-2 bg-vibrant-mint/15 text-vibrant-indigo p-3.5 rounded-2xl text-xs font-semibold">
              <Globe size={14} className="text-vibrant-indigo" />
              <span>Dịch &amp; tách chunks sang: <strong className="font-black text-vibrant-coral">{settings?.learningLanguages.join(", ")}</strong></span>
            </div>

            <button
              id="btn-generate-chunks"
              type="submit"
              disabled={isGenerating || !content.trim()}
              className="w-full flex items-center justify-center gap-2 bg-vibrant-coral hover:bg-vibrant-coral/90 disabled:bg-slate-200 text-white font-black py-4 px-4 rounded-2xl cursor-pointer disabled:cursor-not-allowed transition-all active:scale-95 shadow-lg shadow-vibrant-coral/10 uppercase tracking-tight text-xs"
            >
              {isGenerating ? "Đang xử lý AI Pipeline..." : "Generate Learning Chunks"}
              <Send size={16} />
            </button>
          </form>
        </div>

        {/* Saved Diaries History List */}
        <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden text-left">
          <div className="p-5 border-b border-slate-100 bg-slate-50/50">
            <h3 className="font-display font-black text-slate-800 text-sm flex items-center gap-2">
              <BookOpen size={16} className="text-vibrant-indigo" />
              Danh Sách Nhật Ký ({diaries.length})
            </h3>
          </div>

          <div className="max-h-[350px] overflow-y-auto divide-y divide-slate-100">
            {diaries.map((d) => (
              <div
                key={d.id}
                onClick={() => loadDiaryDetails(d)}
                className={`p-4 text-left transition-all cursor-pointer flex items-center justify-between ${
                  selectedDiary?.id === d.id ? "bg-vibrant-mint/15 border-l-4 border-vibrant-indigo font-bold" : "hover:bg-slate-50"
                }`}
              >
                <div className="space-y-1 pr-4 truncate flex-1">
                  <span className="font-black text-sm text-slate-800 block truncate">{d.title}</span>
                  <div className="flex items-center gap-1.5 text-slate-400 text-xs font-mono">
                    <Calendar size={12} />
                    <span>{new Date(d.createdAt).toLocaleDateString("vi-VN")}</span>
                  </div>
                  <p className="text-xs text-slate-500 font-medium truncate">{d.content}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteDiary(d.id);
                    }}
                    className="p-2 text-slate-400 hover:text-vibrant-coral rounded-xl hover:bg-slate-100 transition-colors"
                    title="Xóa nhật ký"
                  >
                    <Trash2 size={14} />
                  </button>
                  <ChevronRight size={16} className="text-slate-300" />
                </div>
              </div>
            ))}
            {diaries.length === 0 && (
              <div className="p-8 text-center text-slate-400 text-sm italic">
                Chưa có nhật ký nào được viết.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right panel: AI pipeline output, meaning units, chunks */}
      <div className="lg:col-span-7 space-y-6">
        {/* If isGenerating, show Pipeline progress visualization */}
        {isGenerating && (
          <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-md space-y-6 text-left">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="space-y-0.5">
                <h3 className="font-display font-black text-slate-900 text-lg">AI Processing Pipeline</h3>
                <p className="text-xs text-slate-500 font-medium">Mô hình: {settings?.modelPriorityList[settings.aiProvider][0]}</p>
              </div>
              <div className="flex items-center gap-2 text-xs text-vibrant-indigo bg-vibrant-indigo/10 font-mono px-3 py-1.5 rounded-full border border-vibrant-indigo/10">
                <span className="w-2 h-2 bg-vibrant-coral rounded-full animate-ping" />
                <span className="font-black">ACTIVE PIPELINE</span>
              </div>
            </div>

            <div className="space-y-4">
              {steps.map((step, idx) => {
                const isCurrent = idx === currentStep;
                return (
                  <div key={idx} className="flex items-start gap-3">
                    <div className="pt-0.5 shrink-0">
                      {step.status === "done" && (
                        <div className="w-5 h-5 bg-vibrant-mint/30 text-vibrant-indigo rounded-full flex items-center justify-center">
                          <CheckCircle size={14} />
                        </div>
                      )}
                      {step.status === "running" && (
                        <div className="w-5 h-5 border-2 border-vibrant-indigo border-t-transparent rounded-full animate-spin" />
                      )}
                      {step.status === "idle" && (
                        <div className="w-5 h-5 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center text-[10px] font-mono">
                          {idx + 1}
                        </div>
                      )}
                      {step.status === "error" && (
                        <div className="w-5 h-5 bg-vibrant-coral/20 text-vibrant-coral rounded-full flex items-center justify-center">
                          <AlertTriangle size={14} />
                        </div>
                      )}
                    </div>
                    <div className="space-y-0.5">
                      <span className={`text-sm font-black block ${isCurrent ? "text-vibrant-indigo" : "text-slate-700"}`}>
                        {step.name}
                      </span>
                      <p className="text-xs text-slate-500 font-medium">{step.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* If error occurred */}
        {errorDetails && (
          <div className="bg-rose-50 border border-rose-200 p-6 rounded-3xl text-rose-800 space-y-3 text-left">
            <div className="flex items-center gap-2 text-rose-900 font-black font-display text-base">
              <AlertTriangle size={18} />
              <h4>Pipeline Generation Failed</h4>
            </div>
            <p className="text-xs font-medium leading-relaxed">{errorDetails}</p>
            <div className="text-xs border-t border-rose-200 pt-3 font-mono text-rose-700">
              Mẹo: Kiểm tra lại API Key, giới hạn hạn ngạch hoặc cấu hình kết nối trong Cài đặt.
            </div>
          </div>
        )}

        {/* Preview of selected diary meaning units & chunks */}
        {selectedDiary && !isGenerating && (
          <div className="space-y-6">
            <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm space-y-4 text-left">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="space-y-1 text-left">
                  <span className="text-[10px] uppercase font-mono bg-vibrant-indigo/10 text-vibrant-indigo px-2.5 py-1 rounded-full font-black">Selected Entry</span>
                  <h3 className="font-display font-black text-slate-900 text-xl leading-tight pt-1">{selectedDiary.title}</h3>
                  <p className="text-xs text-slate-400 font-medium font-mono">{new Date(selectedDiary.createdAt).toLocaleString("vi-VN")}</p>
                </div>
                {selectedDiaryChunks.length > 0 && (
                  <button
                    onClick={() => onStartPractice(selectedDiaryChunks)}
                    className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-5 py-3 rounded-2xl text-xs font-black uppercase tracking-tight shadow-md transition-all active:scale-95 cursor-pointer"
                  >
                    <Play size={12} fill="currentColor" />
                    Luyện Tập Ngay ({selectedDiaryChunks.length} chunks)
                  </button>
                )}
              </div>

              {/* Native diary content */}
              <div className="bg-slate-50 p-6 rounded-3xl text-sm leading-relaxed text-slate-600 text-left font-medium italic border border-slate-100">
                <span className="text-[9px] uppercase font-mono tracking-widest block text-slate-400 font-black mb-1.5 not-italic">Nội dung nhật ký gốc:</span>
                "{selectedDiary.content}"
              </div>
            </div>

            {/* Structured view of Meaning Units & Chunks */}
            <div className="space-y-4 text-left">
              <h4 className="font-display font-black text-slate-800 text-sm pl-2 uppercase tracking-wider">Các Phân Đoạn Ý Nghĩa &amp; Chunks Học</h4>
              
              {selectedDiaryMUs.map((mu, muIdx) => {
                const muChunks = selectedDiaryChunks.filter(c => c.meaningUnitId === mu.id);
                return (
                  <div key={mu.id} className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm text-left space-y-4">
                    <div className="border-b border-slate-100 pb-3 space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-vibrant-indigo text-white flex items-center justify-center font-mono text-xs font-black shrink-0">
                          {mu.order || (muIdx + 1)}
                        </span>
                        <p className="text-sm font-black text-slate-800">{mu.nativeText}</p>
                      </div>
                      <div className="pl-8 text-xs text-vibrant-coral font-bold italic">
                        English Pivot: "{mu.englishPivot}"
                      </div>
                    </div>

                    {/* Associated language chunks */}
                    <div className="space-y-3 pl-2 sm:pl-6">
                      {muChunks.map((chunk) => (
                        <div key={chunk.id} className="bg-slate-50/50 border border-slate-100 rounded-2xl p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                          <div className="space-y-2 flex-1 pr-4">
                            <div className="flex items-center gap-2">
                              <span className="bg-vibrant-indigo/10 text-vibrant-indigo text-[10px] font-black px-2 py-0.5 rounded-lg uppercase">
                                {chunk.language}
                              </span>
                              <span className="font-display font-black text-slate-900 text-base">
                                {chunk.text}
                              </span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-500 font-medium">
                              <div>Nghĩa: <span className="font-black text-slate-700">{chunk.meaning}</span></div>
                              {chunk.ipa && (
                                <div className="font-mono text-[11px]">IPA: <span className="text-vibrant-indigo font-bold">{chunk.ipa}</span></div>
                              )}
                              {chunk.romanization && (
                                <div className="text-[11px] text-vibrant-coral font-mono font-bold">
                                  Romanization: <span className="font-medium">{chunk.romanization}</span>
                                </div>
                              )}
                            </div>
                          </div>

                          <button
                            data-tts="true"
                            onClick={() => speakText(chunk.text, chunk.language)}
                            className="p-3 bg-white border border-slate-100 hover:bg-slate-100 text-slate-700 rounded-xl shadow-xs transition-all active:scale-90 cursor-pointer"
                            title="Nghe phát âm chuẩn"
                          >
                            🔊
                          </button>
                        </div>
                      ))}
                      {muChunks.length === 0 && (
                        <p className="text-xs text-slate-400 italic">Không có chunk nào cho phân đoạn này.</p>
                      )}
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
