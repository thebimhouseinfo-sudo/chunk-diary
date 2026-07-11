import React from 'react';
import { Mic, X, AlertTriangle } from 'lucide-react';

interface MicPermissionModalProps {
  onClose: () => void;
  errorType: 'denied' | 'not_found' | 'other';
}

export function MicPermissionModal({ onClose, errorType }: MicPermissionModalProps) {
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isAndroid = /android/i.test(navigator.userAgent);
  const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-pageFadeIn">
      <div className="bg-white w-full max-w-md rounded-[2rem] shadow-2xl overflow-hidden relative">
        <div className="absolute top-4 right-4">
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 sm:p-8 space-y-6">
          <div className="w-16 h-16 bg-vibrant-coral/10 text-vibrant-coral rounded-2xl flex items-center justify-center mx-auto">
            {errorType === 'not_found' ? <AlertTriangle size={32} /> : <Mic size={32} />}
          </div>

          <div className="text-center space-y-2">
            <h2 className="text-2xl font-black font-display text-slate-900">
              {errorType === 'not_found' ? "Không tìm thấy Micro" : "Cần cấp quyền Micro"}
            </h2>
            <p className="text-slate-500 text-sm">
              {errorType === 'not_found' 
                ? "Thiết bị của bạn dường như không có micro hoặc micro đang bị hỏng. Vui lòng kiểm tra lại thiết bị."
                : "Để luyện phát âm và chấm điểm độ chính xác, ứng dụng cần sử dụng Micro của bạn."}
            </p>
          </div>

          {errorType !== 'not_found' && (
            <div className="bg-slate-50 p-4 rounded-2xl space-y-3 border border-slate-100">
              <p className="text-xs font-bold text-slate-700 uppercase tracking-widest mb-2">Cách cấp quyền:</p>
              
              {isIOS || isSafari ? (
                <ol className="text-sm text-slate-600 space-y-2 list-decimal list-inside">
                  <li>Mở <b>Cài đặt (Settings)</b> trên thiết bị</li>
                  <li>Kéo xuống chọn ứng dụng trình duyệt (Safari/Chrome)</li>
                  <li>Bật quyền truy cập <b>Microphone</b></li>
                  <li>Tải lại trang web này</li>
                </ol>
              ) : isAndroid ? (
                <ol className="text-sm text-slate-600 space-y-2 list-decimal list-inside">
                  <li>Bấm vào biểu tượng <b>Khóa</b> cạnh thanh địa chỉ web</li>
                  <li>Chọn <b>Quyền (Permissions)</b></li>
                  <li>Bật quyền <b>Microphone</b></li>
                  <li>Tải lại trang web này</li>
                </ol>
              ) : (
                <ol className="text-sm text-slate-600 space-y-2 list-decimal list-inside">
                  <li>Bấm vào biểu tượng <b>Khóa</b> hoặc <b>Cài đặt trang</b> cạnh thanh địa chỉ URL</li>
                  <li>Tìm mục <b>Microphone</b></li>
                  <li>Chọn <b>Cho phép (Allow)</b></li>
                  <li>Tải lại trang web này</li>
                </ol>
              )}
            </div>
          )}

          <button
            onClick={onClose}
            className="w-full bg-slate-900 text-white font-bold py-4 rounded-2xl active:scale-95 transition-all shadow-lg"
          >
            Đã hiểu
          </button>
        </div>
      </div>
    </div>
  );
}
