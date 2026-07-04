import React, { useState, useEffect } from "react";
import { Languages, Shield, ArrowUp, ArrowDown, Plus, Trash2, RotateCcw, Check, Sparkles } from "lucide-react";
import { UserSettings } from "../types";
import { getSettings, saveSettings, clearAllData, preseedDatabaseIfEmpty } from "../db/indexedDb";

export default function SettingsView() {
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [newModelName, setNewModelName] = useState("");
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    const s = await getSettings();
    if (s && s.modelPriorityList && s.modelPriorityList.gemini && !s.modelPriorityList.gemini.includes("gemini-2.5-flash")) {
      s.modelPriorityList.gemini = ["gemini-2.5-flash", ...s.modelPriorityList.gemini];
      await saveSettings(s);
    }
    setSettings(s);
  };

  const handleSaveSettings = async (updated: UserSettings) => {
    setSettings(updated);
    await saveSettings(updated);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
  };

  const handleNativeLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (!settings) return;
    const updated = { ...settings, nativeLanguage: e.target.value };
    handleSaveSettings(updated);
  };

  const handleLearningLanguageToggle = (lang: string) => {
    if (!settings) return;
    let list = [...settings.learningLanguages];
    if (list.includes(lang)) {
      list = list.filter((l) => l !== lang);
    } else {
      if (list.length >= 3) {
        alert("Bạn chỉ được chọn tối đa 3 ngôn ngữ học cùng một lúc để đạt hiệu quả tốt nhất!");
        return;
      }
      list.push(lang);
    }
    const updated = { ...settings, learningLanguages: list };
    handleSaveSettings(updated);
  };

  const handleProviderChange = (provider: "gemini" | "openai" | "xai") => {
    if (!settings) return;
    const updated = { ...settings, aiProvider: provider };
    handleSaveSettings(updated);
  };

  const handleApiKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!settings) return;
    const updated = { ...settings, apiKey: e.target.value };
    handleSaveSettings(updated);
  };

  // Model Priority List interactions
  const moveModel = (direction: "up" | "down", index: number) => {
    if (!settings) return;
    const provider = settings.aiProvider;
    const list = [...settings.modelPriorityList[provider]];

    if (direction === "up" && index > 0) {
      const temp = list[index];
      list[index] = list[index - 1];
      list[index - 1] = temp;
    } else if (direction === "down" && index < list.length - 1) {
      const temp = list[index];
      list[index] = list[index + 1];
      list[index + 1] = temp;
    }

    const updated = {
      ...settings,
      modelPriorityList: {
        ...settings.modelPriorityList,
        [provider]: list
      }
    };
    handleSaveSettings(updated);
  };

  const handleDeleteModel = (index: number) => {
    if (!settings) return;
    const provider = settings.aiProvider;
    const list = [...settings.modelPriorityList[provider]];
    if (list.length <= 1) {
      alert("Danh sách ưu tiên của mô hình phải có tối thiểu 1 phần tử!");
      return;
    }
    list.splice(index, 1);

    const updated = {
      ...settings,
      modelPriorityList: {
        ...settings.modelPriorityList,
        [provider]: list
      }
    };
    handleSaveSettings(updated);
  };

  const handleAddModel = (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings || !newModelName.trim()) return;
    const provider = settings.aiProvider;
    
    // Check duplication
    if (settings.modelPriorityList[provider].includes(newModelName.trim())) {
      alert("Mô hình này đã tồn tại trong danh sách ưu tiên!");
      return;
    }

    const list = [...settings.modelPriorityList[provider], newModelName.trim()];
    const updated = {
      ...settings,
      modelPriorityList: {
        ...settings.modelPriorityList,
        [provider]: list
      }
    };
    handleSaveSettings(updated);
    setNewModelName("");
  };

  const handleResetApp = async () => {
    if (confirm("CẢNH BÁO: Thao tác này sẽ xóa toàn bộ nhật ký, chunks đã học và lịch sử luyện tập của bạn. Bạn có chắc chắn muốn bắt đầu lại từ đầu?")) {
      await clearAllData();
      await preseedDatabaseIfEmpty();
      await loadSettings();
      alert("Đã khôi phục cài đặt gốc ứng dụng thành công!");
      window.location.reload();
    }
  };

  if (!settings) return <div className="text-center py-8">Đang tải cài đặt...</div>;

  const availableLanguages = [
    "English",
    "Japanese",
    "Chinese",
    "Korean",
    "French",
    "Spanish",
    "German",
    "Italian",
    "Russian",
    "Vietnamese"
  ];

  const currentModels = settings.modelPriorityList[settings.aiProvider] || [];

  return (
    <div id="settings-view" className="grid grid-cols-1 lg:grid-cols-12 gap-8 page-fade-enter page-fade-enter-active text-left">
      {/* Left panel: Languages & API Key */}
      <div className="lg:col-span-6 space-y-6">
        {/* Languages block */}
        <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm space-y-5">
          <div className="flex items-center gap-2.5 text-vibrant-indigo font-display font-black text-xl">
            <Languages size={22} className="text-vibrant-coral" />
            <h2>Cấu Hình Ngôn Ngữ</h2>
          </div>

          <div className="space-y-4">
            {/* Native language */}
            <div className="space-y-1.5">
              <label className="text-xs font-black text-slate-400 uppercase tracking-widest block">Ngôn ngữ mẹ đẻ (Native Language)</label>
              <select
                id="select-native-lang"
                value={settings.nativeLanguage}
                onChange={handleNativeLanguageChange}
                className="w-full bg-slate-50 hover:bg-slate-100 border border-slate-100 rounded-2xl px-4 py-3.5 text-sm font-semibold outline-none transition-all cursor-pointer"
              >
                {availableLanguages.map((lang) => (
                  <option key={lang} value={lang}>
                    {lang}
                  </option>
                ))}
              </select>
              <span className="text-[10px] text-slate-400 font-medium block">Ngôn ngữ bạn viết nhật ký và dùng để hiển thị nghĩa của chunk.</span>
            </div>

            {/* Learning languages selection */}
            <div className="space-y-2.5">
              <label className="text-xs font-black text-slate-400 uppercase tracking-widest block">Ngôn ngữ học mục tiêu (Target Languages - Tối đa 3)</label>
              <div className="grid grid-cols-2 gap-2">
                {availableLanguages
                  .filter((lang) => lang !== settings.nativeLanguage)
                  .map((lang) => {
                    const isSelected = settings.learningLanguages.includes(lang);
                    return (
                      <button
                        key={lang}
                        type="button"
                        onClick={() => handleLearningLanguageToggle(lang)}
                        className={`flex items-center justify-between px-4 py-3 border rounded-2xl text-xs font-black transition-all cursor-pointer ${
                          isSelected
                            ? "bg-vibrant-mint/20 border-vibrant-mint/45 text-vibrant-indigo"
                            : "bg-white hover:bg-slate-50 border-slate-100 text-slate-600"
                        }`}
                      >
                        <span>{lang}</span>
                        {isSelected && <Check size={14} className="text-vibrant-indigo shrink-0" />}
                      </button>
                    );
                  })}
              </div>
            </div>
          </div>
        </div>

        {/* Onboarding Profile Block */}
        <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm space-y-5 text-left">
          <div className="flex items-center gap-2.5 text-vibrant-indigo font-display font-black text-xl">
            <Sparkles size={22} className="text-vibrant-yellow" />
            <h2>Cá Nhân Hóa Chunks</h2>
          </div>

          <div className="space-y-4">
            {/* Nickname */}
            <div className="space-y-1.5">
              <label className="text-xs font-black text-slate-400 uppercase tracking-widest block">Biệt danh (Nickname)</label>
              <input
                type="text"
                value={settings.nickname || ""}
                onChange={(e) => {
                  const updated = { ...settings, nickname: e.target.value };
                  handleSaveSettings(updated);
                }}
                placeholder="Nhập biệt danh của bạn..."
                className="w-full bg-slate-50 border border-slate-100 focus:border-vibrant-indigo focus:bg-white rounded-2xl px-4 py-3 text-sm font-semibold outline-none transition-all"
              />
            </div>

            {/* Purposes Multiple Choice */}
            <div className="space-y-2">
              <label className="text-xs font-black text-slate-400 uppercase tracking-widest block">Mục đích học ngoại ngữ</label>
              <div className="flex flex-wrap gap-2">
                {["Sở thích", "Công việc", "Khác"].map((purpose) => {
                  const purposes = settings.learningPurposes || [];
                  const isSelected = purposes.includes(purpose);
                  return (
                    <button
                      key={purpose}
                      type="button"
                      onClick={() => {
                        const nextPurposes = isSelected
                          ? purposes.filter(p => p !== purpose)
                          : [...purposes, purpose];
                        const updated = { ...settings, learningPurposes: nextPurposes };
                        handleSaveSettings(updated);
                      }}
                      className={`px-4 py-2 border rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        isSelected
                          ? "bg-vibrant-indigo/10 border-vibrant-indigo/40 text-vibrant-indigo"
                          : "bg-white hover:bg-slate-50 border-slate-100 text-slate-600"
                      }`}
                    >
                      {purpose}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Industry (if Công việc is selected) */}
            {settings.learningPurposes?.includes("Công việc") && (
              <div className="space-y-3 bg-slate-50 p-5 rounded-2xl border border-slate-100 page-fade-enter">
                <label className="text-xs font-black text-vibrant-indigo uppercase tracking-widest block font-display">Cấu hình mục đích Công việc</label>
                
                <div className="space-y-1">
                  <span className="text-[11px] font-bold text-slate-500">Nhóm ngành nghề (Chọn mẫu chuẩn)</span>
                  <select
                    value={settings.industryCategory || ""}
                    onChange={(e) => {
                      const updated = { ...settings, industryCategory: e.target.value };
                      handleSaveSettings(updated);
                    }}
                    className="w-full bg-white border border-slate-100 rounded-xl px-3 py-2 text-xs font-semibold outline-none transition-all cursor-pointer"
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
                  <span className="text-[11px] font-bold text-slate-500">Mô tả cụ thể / Từ khóa bổ sung</span>
                  <input
                    type="text"
                    value={settings.industry || ""}
                    onChange={(e) => {
                      const updated = { ...settings, industry: e.target.value };
                      handleSaveSettings(updated);
                    }}
                    placeholder="Ví dụ: Backend engineer, chuyên về cloud, họp hàng ngày..."
                    className="w-full bg-white border border-slate-100 focus:border-vibrant-indigo rounded-xl px-4 py-2.5 text-xs font-semibold outline-none transition-all"
                  />
                </div>

                <span className="text-[10px] text-vibrant-indigo/80 font-medium block leading-relaxed">
                  💡 <strong>Tối ưu hóa:</strong> AI sẽ kết hợp nhóm ngành chuẩn và từ khóa chi tiết để đề xuất từ vựng, văn phong công sở chuyên biệt cho ngành này.
                </span>
              </div>
            )}

            {/* Hobby (if Sở thích is selected) */}
            {settings.learningPurposes?.includes("Sở thích") && (
              <div className="space-y-3 bg-slate-50 p-5 rounded-2xl border border-slate-100 page-fade-enter">
                <label className="text-xs font-black text-vibrant-coral uppercase tracking-widest block font-display">Cấu hình mục đích Sở thích</label>
                
                <div className="space-y-1">
                  <span className="text-[11px] font-bold text-slate-500">Nhóm sở thích (Chọn mẫu chuẩn)</span>
                  <select
                    value={settings.hobbyCategory || ""}
                    onChange={(e) => {
                      const updated = { ...settings, hobbyCategory: e.target.value };
                      handleSaveSettings(updated);
                    }}
                    className="w-full bg-white border border-slate-100 rounded-xl px-3 py-2 text-xs font-semibold outline-none transition-all cursor-pointer"
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
                  <span className="text-[11px] font-bold text-slate-500">Mô tả cụ thể / Chi tiết sở thích</span>
                  <input
                    type="text"
                    value={settings.hobby || ""}
                    onChange={(e) => {
                      const updated = { ...settings, hobby: e.target.value };
                      handleSaveSettings(updated);
                    }}
                    placeholder="Ví dụ: Thích nghe nhạc Indie, thích bóng đá Ngoại hạng Anh..."
                    className="w-full bg-white border border-slate-100 focus:border-vibrant-coral rounded-xl px-4 py-2.5 text-xs font-semibold outline-none transition-all"
                  />
                </div>

                <span className="text-[10px] text-vibrant-coral/80 font-medium block leading-relaxed">
                  💡 <strong>Tối ưu hóa:</strong> AI sẽ ưu tiên chọn các cụm từ đắt giá liên quan mật thiết đến chủ đề sở thích và thói quen giải trí yêu thích này của bạn.
                </span>
              </div>
            )}
          </div>
        </div>

        {/* AI Provider Config */}
        <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm space-y-5">
          <div className="flex items-center gap-2.5 text-vibrant-indigo font-display font-black text-xl">
            <Shield size={22} className="text-vibrant-indigo" />
            <h2>Cấu Hình Mô Hình AI</h2>
          </div>

          <div className="space-y-4">
            {/* Provider buttons */}
            <div className="space-y-1.5">
              <label className="text-xs font-black text-slate-400 uppercase tracking-widest block">Nhà cung cấp dịch vụ AI (AI Provider)</label>
              <div className="flex gap-2">
                {(["gemini", "openai", "xai"] as const).map((prov) => {
                  const isSelected = settings.aiProvider === prov;
                  return (
                    <button
                      key={prov}
                      type="button"
                      onClick={() => handleProviderChange(prov)}
                      className={`flex-1 py-3 rounded-2xl text-xs font-black uppercase tracking-wider transition-all border cursor-pointer ${
                        isSelected
                          ? "bg-slate-900 border-slate-900 text-white"
                          : "bg-white hover:bg-slate-50 border-slate-100 text-slate-600"
                      }`}
                    >
                      {prov === "gemini" ? "Gemini" : prov === "openai" ? "OpenAI" : "xAI"}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* API Key details */}
            <div className="space-y-1.5">
              <label className="text-xs font-black text-slate-400 uppercase tracking-widest block">API Key</label>
              
              <div className="space-y-2">
                <input
                  type="password"
                  value={settings.apiKey}
                  onChange={handleApiKeyChange}
                  placeholder={`Nhập API Key của ${settings.aiProvider.toUpperCase()}...`}
                  className="w-full bg-slate-50 border border-slate-100 focus:border-vibrant-indigo focus:bg-white rounded-2xl px-4 py-3 text-sm font-semibold outline-none transition-all"
                />
                <span className="text-[10px] text-slate-400 font-medium block leading-relaxed">
                  {settings.aiProvider === "gemini" ? (
                    <>
                      💡 <strong>Lưu ý về Gemini API Key:</strong> Khi sử dụng trong môi trường AI Studio, hệ thống tự động nhận diện khóa bí mật từ cấu hình Secrets. Tuy nhiên, khi deploy lên <strong>GitHub Pages</strong> để chạy độc lập (client-side), bạn hãy tự nhập và sử dụng Gemini API Key của riêng bạn ở đây. Khóa này sẽ chỉ được lưu an toàn tại bộ nhớ trình duyệt (localStorage) cá nhân của bạn, không lo bị lộ hay lạm dụng.
                    </>
                  ) : (
                    <>
                      Khóa này sẽ được lưu an toàn tại bộ nhớ của trình duyệt (localStorage) và chỉ dùng để thực hiện yêu cầu dịch từ thiết bị này.
                    </>
                  )}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right panel: Model Priority List & App Reset */}
      <div className="lg:col-span-6 space-y-6">
        {/* Model Priority List config */}
        <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2.5 text-vibrant-indigo font-display font-black text-xl">
              <Sparkles size={22} className="text-vibrant-coral" />
              <h2>Danh Sách Ưu Tiên</h2>
            </div>
            <span className="text-[10px] uppercase font-mono bg-vibrant-indigo/10 text-vibrant-indigo px-3 py-1 rounded-full font-black">
              {settings.aiProvider.toUpperCase()} MODELS
            </span>
          </div>

          <p className="text-xs text-slate-500 font-medium leading-relaxed">
            Hệ thống sẽ thử gọi mô hình theo đúng thứ tự ưu tiên bên dưới. Nếu mô hình hàng đầu bị lỗi hoặc vượt quá giới hạn cuộc gọi, hệ thống sẽ tự động chuyển sang mô hình tiếp theo.
          </p>

          {/* Render models priority queue */}
          <div className="space-y-2.5 pt-1">
            {currentModels.map((model, idx) => (
              <div
                key={`${model}-${idx}`}
                className="bg-slate-50 border border-slate-100 p-3.5 rounded-2xl flex items-center justify-between hover:bg-slate-100/80 transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-vibrant-indigo text-white font-mono text-[10px] flex items-center justify-center font-black">
                    {idx + 1}
                  </span>
                  <span className="font-mono text-xs font-bold text-slate-800">{model}</span>
                </div>

                <div className="flex items-center gap-1">
                  {/* Move Up */}
                  <button
                    type="button"
                    onClick={() => moveModel("up", idx)}
                    disabled={idx === 0}
                    className="p-1.5 text-slate-400 hover:text-vibrant-indigo disabled:text-slate-200 hover:bg-white rounded-lg border border-transparent hover:border-slate-200 transition-all"
                    title="Đưa lên"
                  >
                    <ArrowUp size={14} />
                  </button>

                  {/* Move Down */}
                  <button
                    type="button"
                    onClick={() => moveModel("down", idx)}
                    disabled={idx === currentModels.length - 1}
                    className="p-1.5 text-slate-400 hover:text-vibrant-indigo disabled:text-slate-200 hover:bg-white rounded-lg border border-transparent hover:border-slate-200 transition-all"
                    title="Đưa xuống"
                  >
                    <ArrowDown size={14} />
                  </button>

                  {/* Delete */}
                  <button
                    type="button"
                    onClick={() => handleDeleteModel(idx)}
                    className="p-1.5 text-slate-400 hover:text-vibrant-coral hover:bg-white rounded-lg border border-transparent hover:border-slate-200 transition-all ml-1"
                    title="Xóa mô hình"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Form to add a new model */}
          <form onSubmit={handleAddModel} className="flex gap-2 pt-1">
            <input
              type="text"
              value={newModelName}
              onChange={(e) => setNewModelName(e.target.value)}
              placeholder="Thêm mã mô hình tùy chọn khác..."
              className="flex-1 bg-slate-50 border border-slate-100 focus:border-vibrant-indigo focus:bg-white rounded-2xl px-4 py-3 text-xs font-semibold outline-none transition-all"
            />
            <button
              type="submit"
              disabled={!newModelName.trim()}
              className="bg-vibrant-indigo hover:bg-vibrant-indigo/90 disabled:bg-slate-100 disabled:text-slate-400 text-white font-black px-5 py-3 rounded-2xl text-xs flex items-center gap-1 transition-all active:scale-95 cursor-pointer"
            >
              <Plus size={14} />
              Thêm
            </button>
          </form>
        </div>

        {/* Reset settings / Data Wipeout */}
        <div className="bg-rose-50 border border-rose-100 p-8 rounded-[2rem] space-y-4">
          <div className="space-y-1">
            <h3 className="font-display font-black text-rose-900 text-base">Khôi Phục Cài Đặt Gốc</h3>
            <p className="text-xs text-rose-700 font-medium leading-relaxed">
              Thao tác này sẽ dọn sạch toàn bộ dữ liệu lưu trong cơ sở dữ liệu IndexedDB của ứng dụng trên thiết bị này, bao gồm cả nhật ký của bạn. Hãy chắc chắn trước khi nhấn!
            </p>
          </div>

          <button
            id="btn-reset-app"
            onClick={handleResetApp}
            className="flex items-center gap-2 bg-vibrant-coral hover:bg-vibrant-coral/90 text-white font-black text-xs px-5 py-3.5 rounded-2xl shadow-md transition-all active:scale-95 cursor-pointer uppercase tracking-tight"
          >
            <RotateCcw size={14} />
            Khôi Phục Toàn Bộ Dữ Liệu
          </button>
        </div>
      </div>

      {/* Save state notification toast */}
      {saveSuccess && (
        <div className="fixed bottom-6 right-6 bg-emerald-600 text-white px-4 py-3 rounded-xl shadow-lg z-50 flex items-center gap-2 font-display text-xs font-semibold animate-scaleUp">
          <Check size={16} />
          <span>Cài đặt đã tự động lưu thành công!</span>
        </div>
      )}
    </div>
  );
}
