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
  deleteDiary,
  getSemanticGroups,
  saveSemanticGroup,
  getChunksBySemanticGroupId
} from "../db/indexedDb";
import { Diary, MeaningUnit, Chunk, UserSettings } from "../types";
import { speakText } from "../utils/tts";
import { callGenerateChunks } from "../utils/aiService";

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
  const [semanticGroupCounts, setSemanticGroupCounts] = useState<Record<string, number>>({});
  const [showHistory, setShowHistory] = useState(false);

  // Onboarding Modal States
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardForm, setOnboardForm] = useState({
    nickname: "",
    nativeLanguage: "Vietnamese",
    learningLanguage: "English",
    learningPurpose: "hobby" as "hobby" | "work",
    specialty: "Công nghệ thông tin",
    subSpecialty: "",
    cefrLevel: "A2"
  });

  const steps = [
    { name: "Gửi yêu cầu", description: "Đang gửi yêu cầu của bạn tới máy chủ..." },
    { name: "Đang xử lý bằng AI", description: "AI đang tiến hành phân tích nội dung..." },
    { name: "Hoàn tất & Lưu trữ", description: "Đang đồng bộ hóa kết quả vào cơ sở dữ liệu trên thiết bị..." }
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
    // If there is at least one diary and no diary is selected, select the latest one automatically
    if (all.length > 0 && !selectedDiary) {
      handleSelectDiary(all[0]);
    }
  };

  const handleSelectDiary = async (diary: Diary) => {
    setSelectedDiary(diary);
    const mus = await getMeaningUnitsForDiary(diary.id!);
    mus.sort((a, b) => a.order - b.order);
    setSelectedDiaryMUs(mus);

    const allChunks: Chunk[] = [];
    const counts: Record<string, number> = {};
    for (const mu of mus) {
      const chunks = await getChunksByMeaningUnitId(mu.id!);
      allChunks.push(...chunks);
      for (const chunk of chunks) {
        if (chunk.semanticGroupId && counts[chunk.semanticGroupId] === undefined) {
          const groupChunks = await getChunksBySemanticGroupId(chunk.semanticGroupId);
          counts[chunk.semanticGroupId] = groupChunks.length;
        }
      }
    }
    setSemanticGroupCounts(counts);
    setSelectedDiaryChunks(allChunks);
    setShowHistory(false);
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("Xóa nhật ký này?")) {
      await deleteDiary(id);
      const remainingDiaries = diaries.filter(d => d.id !== id);
      setDiaries(remainingDiaries);
      if (selectedDiary?.id === id) {
        if (remainingDiaries.length > 0) {
          handleSelectDiary(remainingDiaries[0]);
        } else {
          setSelectedDiary(null);
          setSelectedDiaryMUs([]);
          setSelectedDiaryChunks([]);
        }
      }
    }
  };

  const handleOnboardingSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!onboardForm.nickname.trim() || !onboardForm.nativeLanguage.trim() || !onboardForm.learningLanguage.trim()) {
      alert("Vui lòng điền đầy đủ nickname, ngôn ngữ mẹ đẻ và ngôn ngữ muốn học!");
      return;
    }

    const saved = localStorage.getItem("user_settings");
    let currentSettings = saved ? JSON.parse(saved) : {};

    const updatedSettings: UserSettings = {
      ...currentSettings,
      nickname: onboardForm.nickname.trim(),
      nativeLanguage: onboardForm.nativeLanguage.trim(),
      learningLanguages: [onboardForm.learningLanguage.trim()],
      learningPurpose: onboardForm.learningPurpose,
      specialty: onboardForm.learningPurpose === "work" ? onboardForm.specialty : "",
      subSpecialty: onboardForm.learningPurpose === "work" ? onboardForm.subSpecialty.trim() : "",
      cefrLevel: onboardForm.cefrLevel,
      onboarded: true
    };

    localStorage.setItem("user_settings", JSON.stringify(updatedSettings));
    setSettings(updatedSettings);
    setShowOnboarding(false);
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

      const targetLanguage = settings.learningLanguages[0] || "English";
      const cefrLevel = settings.cefrLevel || "A2";

      let profileContext = "";
      if (settings.learningPurpose === "work" && settings.specialty) {
        profileContext = `Profession: ${settings.specialty}${settings.subSpecialty ? ` (${settings.subSpecialty})` : ""}`;
      } else if (settings.hobby) {
        profileContext = `Hobby/Interest: ${settings.hobby}`;
      } else {
        profileContext = "General learner";
      }

      const existingGroups = await getSemanticGroups();

      const aiResponse = await callGenerateChunks({
        diaryContent: content,
        nativeLanguage: settings.nativeLanguage,
        targetLanguage,
        cefrLevel,
        profileContext,
        existingSemanticGroups: existingGroups
      }, (status, message) => {
        setQueueMessage(message);
        if (status === "Processing") {
          setCurrentStep(1);
        } else if (status === "Completed") {
          setCurrentStep(2);
        }
      });

      setQueueMessage("Đang lưu trữ dữ liệu các chunks...");
      setCurrentStep(2);
      for (const unit of aiResponse.semanticUnits) {
        const muId = await saveMeaningUnit({
          diaryId,
          nativeText: unit.nativeText,
          englishPivot: unit.englishText,
          order: unit.order
        });

        const allChunksData = [
          ...(unit.commonChunks || []).map(c => ({ ...c, type: "common" as const })),
          ...(unit.personalizedChunks || []).map(c => ({ ...c, type: "personalized" as const }))
        ];

        for (const chunk of allChunksData) {
          let groupId = chunk.semanticGroupId;
          if (groupId === "new" || !groupId || !existingGroups.find(g => g.id === groupId)) {
            groupId = await saveSemanticGroup({
              canonicalMeaning: chunk.proposedCanonicalMeaning || chunk.english,
              coverageLevel: 1,
              createdAt: new Date().toISOString()
            });
            existingGroups.push({ id: groupId, canonicalMeaning: chunk.proposedCanonicalMeaning || chunk.english, coverageLevel: 1, createdAt: new Date().toISOString() });
          }

          await saveChunk({
            meaningUnitId: muId,
            semanticGroupId: groupId,
            language: targetLanguage,
            text: chunk.text,
            meaning: unit.nativeText,
            ipa: chunk.ipa || "",
            romanization: chunk.romanization || "",
            chunkType: chunk.type,
            stars: 0,
            bestAccuracy: 0,
            timesPracticed: 0,
            lastPracticed: "",
            totalReviews: 0,
            averageRating: 0,
            lastRating: 0,
            lastReviewed: "",
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
      setErrorDetails(err.message || "Lỗi kết nối");
    } finally {
      setIsGenerating(false);
      setQueueMessage(null);
    }
  };

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Onboarding Modal Popup Overlay */}
      {showOnboarding && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4 overflow-y-auto animate-pageFadeIn">
          <div className="bg-white w-full max-w-lg rounded-[2.5rem] p-6 sm:p-8 border border-slate-100 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto my-8 text-left">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 bg-vibrant-coral rounded-2xl flex items-center justify-center text-white font-black shadow-md mx-auto">
                <Sparkles size={24} />
              </div>
              <h2 className="font-display font-black text-xl sm:text-2xl text-slate-900">Chào mừng bạn đến với ChunkDiary!</h2>
              <p className="text-xs text-slate-500 font-medium">Hãy chia sẻ một chút thông tin để bắt đầu trải nghiệm học tập tối ưu nhất nhé.</p>
            </div>

            <form onSubmit={handleOnboardingSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nickname của bạn</label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Minh, Anna..."
                  value={onboardForm.nickname}
                  onChange={(e) => setOnboardForm({ ...onboardForm, nickname: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-sm font-semibold outline-none focus:border-vibrant-indigo transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ngôn ngữ mẹ đẻ</label>
                  <select
                    value={onboardForm.nativeLanguage}
                    onChange={(e) => setOnboardForm({ ...onboardForm, nativeLanguage: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-sm font-semibold outline-none focus:border-vibrant-indigo transition-all cursor-pointer"
                  >
                    <option value="Vietnamese">Tiếng Việt</option>
                    <option value="English">Tiếng Anh</option>
                    <option value="Japanese">Tiếng Nhật</option>
                    <option value="Korean">Tiếng Hàn</option>
                    <option value="Chinese">Tiếng Trung</option>
                    <option value="French">Tiếng Pháp</option>
                    <option value="German">Tiếng Đức</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ngôn ngữ muốn học</label>
                  <select
                    value={onboardForm.learningLanguage}
                    onChange={(e) => setOnboardForm({ ...onboardForm, learningLanguage: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-sm font-semibold outline-none focus:border-vibrant-indigo transition-all cursor-pointer"
                  >
                    <option value="English">Tiếng Anh (English)</option>
                    <option value="Japanese">Tiếng Nhật (Japanese)</option>
                    <option value="Korean">Tiếng Hàn (Korean)</option>
                    <option value="Chinese">Tiếng Trung (Chinese)</option>
                    <option value="French">Tiếng Pháp (French)</option>
                    <option value="German">Tiếng Đức (German)</option>
                    <option value="Spanish">Tiếng Tây Ban Nha (Spanish)</option>
                    <option value="Italian">Tiếng Ý (Italian)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Trình độ CEFR</label>
                <select
                  value={onboardForm.cefrLevel}
                  onChange={(e) => setOnboardForm({ ...onboardForm, cefrLevel: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-sm font-semibold outline-none focus:border-vibrant-indigo transition-all cursor-pointer"
                >
                  <option value="A1">A1 – Mới bắt đầu</option>
                  <option value="A2">A2 – Sơ cấp</option>
                  <option value="B1">B1 – Trung cấp</option>
                  <option value="B2">B2 – Trung cấp nâng cao</option>
                  <option value="C1">C1 – Cao cấp</option>
                  <option value="C2">C2 – Thành thạo</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Bạn học vì sở thích hay công việc?</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setOnboardForm({ ...onboardForm, learningPurpose: "hobby" })}
                    className={`p-3 rounded-2xl text-xs font-bold border transition-all ${onboardForm.learningPurpose === "hobby"
                      ? "bg-vibrant-indigo text-white border-vibrant-indigo shadow-md"
                      : "bg-slate-50 text-slate-600 border-slate-100 hover:bg-slate-100"
                      }`}
                  >
                    Sở thích
                  </button>
                  <button
                    type="button"
                    onClick={() => setOnboardForm({ ...onboardForm, learningPurpose: "work" })}
                    className={`p-3 rounded-2xl text-xs font-bold border transition-all ${onboardForm.learningPurpose === "work"
                      ? "bg-vibrant-indigo text-white border-vibrant-indigo shadow-md"
                      : "bg-slate-50 text-slate-600 border-slate-100 hover:bg-slate-100"
                      }`}
                  >
                    Công việc
                  </button>
                </div>
              </div>

              {onboardForm.learningPurpose === "work" && (
                <div className="space-y-4 p-4 bg-slate-50 rounded-2xl border border-slate-100 animate-pageFadeIn">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Chuyên ngành</label>
                    <select
                      value={onboardForm.specialty}
                      onChange={(e) => setOnboardForm({ ...onboardForm, specialty: e.target.value })}
                      className="w-full bg-white border border-slate-100 rounded-2xl px-4 py-3 text-sm font-semibold outline-none focus:border-vibrant-indigo transition-all cursor-pointer"
                    >
                      <option value="Công nghệ thông tin">Công nghệ thông tin</option>
                      <option value="Y học / Y tế">Y học / Y tế</option>
                      <option value="Kinh tế / Tài chính">Kinh tế / Tài chính</option>
                      <option value="Kỹ thuật / Sản xuất">Kỹ thuật / Sản xuất</option>
                      <option value="Ngôn ngữ / Sư phạm">Ngôn ngữ / Sư phạm</option>
                      <option value="Marketing / Truyền thông">Marketing / Truyền thông</option>
                      <option value="Thiết kế / Nghệ thuật">Thiết kế / Nghệ thuật</option>
                      <option value="Xây dựng / Bất động sản">Xây dựng / Bất động sản</option>
                      <option value="Du lịch / Khách sạn">Du lịch / Khách sạn</option>
                      <option value="Nhà hàng / F&B">Nhà hàng / F&B</option>
                      <option value="Logistics / Chuỗi cung ứng">Logistics / Chuỗi cung ứng</option>
                      <option value="Luật / Pháp lý">Luật / Pháp lý</option>
                      <option value="Nhân sự / Hành chính">Nhân sự / Hành chính</option>
                      <option value="Bán lẻ / Thương mại điện tử">Bán lẻ / Thương mại điện tử</option>
                      <option value="Khác">Khác</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ngành con / Mô tả chi tiết</label>
                    <input
                      type="text"
                      placeholder="Ví dụ: Lập trình Web, Quản trị mạng, Tim mạch..."
                      value={onboardForm.subSpecialty}
                      onChange={(e) => setOnboardForm({ ...onboardForm, subSpecialty: e.target.value })}
                      className="w-full bg-white border border-slate-100 rounded-2xl px-4 py-3 text-sm font-semibold outline-none focus:border-vibrant-indigo transition-all"
                    />
                  </div>
                </div>
              )}

              <div className="p-3 bg-vibrant-mint/10 border border-vibrant-mint/20 rounded-2xl text-[11px] text-vibrant-indigo font-medium leading-relaxed">
                👉 <strong>Giải thích:</strong> AI sẽ tạo Common Chunks (cụm câu phổ thông) và Personalized Chunks (câu cá nhân hóa theo nghề/sở thích) để tối ưu việc học của bạn.
              </div>

              <button
                type="submit"
                className="w-full flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white py-4 rounded-2xl font-black uppercase tracking-tight shadow-lg transition-all active:scale-95 text-xs"
              >
                Bắt đầu ngay
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Top: Full Width Write Diary Card */}
      <div className="bg-white p-6 sm:p-8 rounded-[2rem] border border-slate-100 shadow-md space-y-5 w-full text-left">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5 text-vibrant-indigo font-display font-black text-xl">
            <Plus className="text-vibrant-coral" size={24} />
            <h2>Viết Nhật Ký Mới</h2>
          </div>
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="lg:hidden p-2 bg-slate-50 rounded-xl text-slate-500"
          >
            <History size={20} />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-4">
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
              rows={5}
              className="w-full bg-slate-50 border border-slate-100 focus:border-vibrant-indigo rounded-2xl px-4 py-3 text-sm font-medium outline-none transition-all resize-none"
            />
          </div>
          <div className="flex flex-col justify-between bg-slate-50/50 p-5 rounded-2xl border border-slate-100 space-y-4">
            <div className="text-xs text-slate-500 space-y-2.5">
              <p className="font-bold text-slate-700 flex items-center gap-1.5">
                <Sparkles size={14} className="text-vibrant-coral" /> Gợi ý viết nhật ký:
              </p>
              <ul className="list-disc pl-4 space-y-1.5">
                <li>Hãy kể lại ngày hôm nay của bạn bằng những câu đơn giản.</li>
                <li>Nên viết về chủ đề hàng ngày hoặc công việc của bạn.</li>
                <li>Hệ thống sẽ tự động tách câu thành các <strong>language chunks</strong> để luyện tập.</li>
              </ul>
            </div>
            <button
              onClick={handleGenerate}
              disabled={isGenerating || !content.trim()}
              className="w-full flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-200 text-white py-4 rounded-2xl font-black uppercase tracking-tight shadow-lg transition-all active:scale-95 text-xs cursor-pointer"
            >
              <Send size={18} />
              {isGenerating ? "Đang xếp hàng..." : "Tạo chunks"}
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Layout: History Left (Desktop) & Progress / Result Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8">
        {/* Left Column: History list (lg:col-span-4) */}
        <div className={`${showHistory ? "block" : "hidden"} lg:block lg:col-span-4 bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden h-fit text-left`}>
          <div className="p-5 border-b border-slate-50 bg-slate-50/50 flex items-center justify-between">
            <h3 className="font-display font-black text-slate-800 text-sm uppercase tracking-wider flex items-center gap-2">
              <History size={16} /> Lịch sử nhật ký
            </h3>
            <span className="bg-white px-2 py-0.5 rounded-lg text-[10px] font-bold text-slate-400 border border-slate-100">{diaries.length}</span>
          </div>
          <div className="max-h-[500px] overflow-y-auto divide-y divide-slate-50">
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
                <div className="flex items-center gap-1 text-slate-400">
                  <button onClick={(e) => handleDelete(d.id!, e)} className="p-2 text-slate-300 hover:text-vibrant-coral"><Trash2 size={14} /></button>
                  <ChevronRight size={16} className="text-slate-200" />
                </div>
              </div>
            ))}
            {diaries.length === 0 && <div className="p-8 text-center text-slate-400 text-xs italic">Chưa có bài viết nào.</div>}
          </div>
        </div>

        {/* Right Column: AI Queue Pipeline & Selected Diary Detail (lg:col-span-8) */}
        <div className="lg:col-span-8 space-y-6 text-left">
          {errorDetails && (
            <div className="bg-rose-50 border border-rose-100 p-6 rounded-[2rem] flex items-start gap-3.5 text-rose-900 animate-pageFadeIn shadow-sm">
              <AlertTriangle className="text-vibrant-coral shrink-0 mt-0.5" size={20} />
              <div className="space-y-1">
                <h4 className="font-display font-black text-sm uppercase tracking-wider">Lỗi xử lý</h4>
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
                <h3 className="font-display font-black text-slate-900">Queue Pipeline</h3>
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
                      className="flex items-center justify-center gap-2 bg-slate-900 text-white px-5 py-3 rounded-2xl text-[10px] font-black uppercase tracking-tight shadow-md cursor-pointer"
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
                  const commonChunks = chunks.filter(c => (c as any).chunkType !== "personalized");
                  const personalizedChunks = chunks.filter(c => (c as any).chunkType === "personalized");
                  return (
                    <div key={mu.id} className="bg-white border border-slate-100 rounded-[1.5rem] p-5 sm:p-6 space-y-4 shadow-sm">
                      <div className="flex items-start gap-3 border-b border-slate-50 pb-3">
                        <span className="w-6 h-6 rounded-lg bg-vibrant-indigo text-white flex items-center justify-center font-mono text-[10px] font-black shrink-0">{idx + 1}</span>
                        <div className="flex-1">
                          <p className="text-sm font-bold text-slate-800">{mu.nativeText}</p>
                          <p className="text-[10px] text-slate-400 font-medium italic pt-1">EN: "{mu.englishPivot}"</p>
                          {chunks.length > 0 && chunks[0].semanticGroupId && semanticGroupCounts[chunks[0].semanticGroupId] >= 3 && (
                            <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg p-2.5 flex items-start gap-2 text-amber-800">
                              <AlertTriangle size={14} className="shrink-0 mt-0.5 text-amber-600" />
                              <p className="text-[10px] font-medium leading-relaxed">
                                <strong>Lưu ý:</strong> Bạn đã có nhiều chunks với ý nghĩa tương tự trong Chunk Library ({semanticGroupCounts[chunks[0].semanticGroupId]} câu).
                                Khuyến nghị xoá bớt để tối ưu hệ thống ôn tập.
                              </p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Common Chunks */}
                      {commonChunks.length > 0 && (
                        <div className="space-y-2">
                          <span className="text-[9px] font-black text-vibrant-mint bg-vibrant-mint/15 px-2 py-0.5 rounded-full uppercase tracking-wider">Common</span>
                          {commonChunks.map(chunk => (
                            <div key={chunk.id} className="bg-slate-50/50 p-3 sm:p-4 rounded-xl flex items-center justify-between gap-3">
                              <div className="flex-1 space-y-1">
                                <p className="text-sm font-black text-slate-900">{chunk.text}</p>
                                {chunk.romanization && <p className="text-[10px] text-vibrant-coral font-bold font-mono">{chunk.romanization}</p>}
                                <p className="text-[10px] text-slate-400 font-medium italic">EN: {chunk.meaning}</p>
                              </div>
                              <button onClick={() => speakText(chunk.text, chunk.language)} className="p-2.5 bg-white border border-slate-100 rounded-lg shadow-sm cursor-pointer shrink-0">🔊</button>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Personalized Chunks */}
                      {personalizedChunks.length > 0 && (
                        <div className="space-y-2">
                          <span className="text-[9px] font-black text-vibrant-coral bg-vibrant-coral/10 px-2 py-0.5 rounded-full uppercase tracking-wider">Personalized</span>
                          {personalizedChunks.map(chunk => (
                            <div key={chunk.id} className="bg-vibrant-coral/5 p-3 sm:p-4 rounded-xl flex items-center justify-between gap-3 border border-vibrant-coral/10">
                              <div className="flex-1 space-y-1">
                                <p className="text-sm font-black text-slate-900">{chunk.text}</p>
                                {chunk.romanization && <p className="text-[10px] text-vibrant-coral font-bold font-mono">{chunk.romanization}</p>}
                                <p className="text-[10px] text-slate-400 font-medium italic">EN: {chunk.meaning}</p>
                              </div>
                              <button onClick={() => speakText(chunk.text, chunk.language)} className="p-2.5 bg-white border border-slate-100 rounded-lg shadow-sm cursor-pointer shrink-0">🔊</button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
