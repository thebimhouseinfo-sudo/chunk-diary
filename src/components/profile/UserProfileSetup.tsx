import React, { useState } from "react";
import { Sparkles, Mic } from "lucide-react";
import { UserSettings } from "../../types";
import { saveSettings } from "../../db/userDb";

interface UserProfileSetupProps {
  show: boolean;
  onCompleted: (settings: UserSettings) => void;
  onRequestMicPermission?: () => void;
}

export default function UserProfileSetup({ show, onCompleted, onRequestMicPermission }: UserProfileSetupProps) {
  const [onboardForm, setOnboardForm] = useState({
    nickname: "",
    nativeLanguage: "Vietnamese",
    learningLanguage: "English",
    learningPurpose: "hobby" as "hobby" | "work",
    specialty: "Công nghệ thông tin",
    subSpecialty: "",
    cefrLevel: "A2"
  });

  const handleOnboardingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onboardForm.nickname.trim() || !onboardForm.nativeLanguage.trim() || !onboardForm.learningLanguage.trim()) {
      alert("Vui lòng điền đầy đủ nickname, ngôn ngữ mẹ đẻ và ngôn ngữ muốn học!");
      return;
    }

    const updatedSettings: UserSettings = {
      nickname: onboardForm.nickname.trim(),
      nativeLanguage: onboardForm.nativeLanguage.trim(),
      learningLanguages: [onboardForm.learningLanguage.trim()],
      learningPurpose: onboardForm.learningPurpose,
      specialty: onboardForm.learningPurpose === "work" ? onboardForm.specialty : "",
      subSpecialty: onboardForm.learningPurpose === "work" ? onboardForm.subSpecialty.trim() : "",
      cefrLevel: onboardForm.cefrLevel,
      onboarded: true
    };

    try {
      // Lưu đồng bộ thẳng vào IndexedDB (userDb thông qua saveSettings)
      await saveSettings(updatedSettings);
      
      // Đồng thời cập nhật localStorage để đảm bảo các luồng kiểm tra nhanh đồng bộ theo
      localStorage.setItem("user_settings", JSON.stringify(updatedSettings));
      
      onCompleted(updatedSettings);
      
      // Request mic permission after profile creation
      if (onRequestMicPermission) {
        onRequestMicPermission();
      }
    } catch (err) {
      console.error("Lỗi khi lưu cấu hình người dùng:", err);
      alert("Đã xảy ra lỗi khi lưu thông tin. Vui lòng thử lại!");
    }
  };

  if (!show) return null;

  return (
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
  );
}
