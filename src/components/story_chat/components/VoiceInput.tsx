import React, { useState, useRef, useEffect, useCallback } from "react";
import { AudioLines, Keyboard, Volume2, AlertTriangle } from "lucide-react";
import { getBrowserInfo } from "../../../utils/browser";
import { MicStatus } from "../../../hooks/useMicPermission";

interface VoiceInputProps {
  onTranscriptionStart: () => void;
  onTranscriptionEnd: (text: string) => void;
  onSwitchMode: () => void;
  micStatus?: MicStatus;
  onRequestMic?: (isUserGesture: boolean) => Promise<boolean>;
}

export default function VoiceInput({
  onTranscriptionStart,
  onTranscriptionEnd,
  onSwitchMode,
  micStatus = 'idle',
  onRequestMic
}: VoiceInputProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [amplitude, setAmplitude] = useState<number[]>([10, 10, 10, 10, 10]);
  const [recognitionState, setRecognitionState] = useState<'idle' | 'initializing' | 'listening'>('idle');
  const needsSecureContext = !window.isSecureContext || !navigator.mediaDevices?.getUserMedia;
  const recognitionRef = useRef<any>(null);
  const intervalRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const waveformTimeoutRef = useRef<any>(null);
  const pointerActiveRef = useRef(false);
  const recognitionStartedRef = useRef(false);

  useEffect(() => {
    return () => {
      // Cleanup audio resources
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (waveformTimeoutRef.current) clearTimeout(waveformTimeoutRef.current);
    };
  }, []);

  const startListening = useCallback(async () => {
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      console.warn("Microphone access requires a secure context. Use HTTPS on iPhone when testing from a LAN IP.");
      if (onRequestMic) await onRequestMic(true);
      return;
    }

    if (micStatus !== 'granted') {
      const granted = onRequestMic ? await onRequestMic(true) : false;
      if (!granted) return;
    }

    if (pointerActiveRef.current) return; // Prevent double-triggering
    pointerActiveRef.current = true;
    recognitionStartedRef.current = false;
    
    setIsRecording(true);
    setRecognitionState('initializing');
    onTranscriptionStart();

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      
      const browserInfo = getBrowserInfo();
      recognition.lang = "vi-VN";
      recognition.maxAlternatives = 1;

      recognition.onresult = (event: any) => {
        const text = event.results[0][0].transcript;
        console.log("Speech recognition result:", text);
        if (text && text.trim()) {
          onTranscriptionEnd(text.trim());
        } else {
          onTranscriptionEnd("");
        }
      };

      recognition.onerror = (event: any) => {
        console.error("Voice input recognition error:", event.error);
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          if (onRequestMic) onRequestMic(true);
        }
        setRecognitionState('idle');
        setIsRecording(false);
        pointerActiveRef.current = false;
        onTranscriptionEnd("");
      };

      recognition.onend = () => {
        console.log("Speech recognition ended");
        setIsRecording(false);
        setRecognitionState('idle');
        pointerActiveRef.current = false;
        recognitionStartedRef.current = false;
      };

      let waveformActivated = false;
      const activateWaveform = () => {
        if (!waveformActivated) {
          waveformActivated = true;
          setRecognitionState('listening');
        }
      };

      recognition.onstart = () => {
        console.log("SpeechRecognition started");
        recognitionStartedRef.current = true;
        activateWaveform();
      };
      recognition.onaudiostart = () => activateWaveform();
      recognition.onsoundstart = () => activateWaveform();
      recognition.onspeechstart = () => activateWaveform();

      recognitionRef.current = recognition;
      
      try {
        // SYNCHRONOUS CALL — MUST NOT BE BEHIND AN AWAIT OR SETTIMEOUT TO PRESERVE iOS USER GESTURE
        recognition.start();
        console.log("SpeechRecognition.start() called synchronously");
        
        waveformTimeoutRef.current = setTimeout(() => {
          if (!waveformActivated && isRecording) {
            activateWaveform();
          }
        }, 300);
        
      } catch (e: any) {
        console.error("Failed to start recognition:", e);
        if (onRequestMic) onRequestMic(true);
        setIsRecording(false);
        setRecognitionState('idle');
        pointerActiveRef.current = false;
        onTranscriptionEnd("");
      }
    } else {
      console.log("Speech recognition not supported, using fallback");
      setTimeout(() => {
        onTranscriptionEnd("Hôm nay mình dậy hơi muộn.");
        setIsRecording(false);
        setRecognitionState('idle');
        pointerActiveRef.current = false;
      }, 2000);
    }
  }, [onTranscriptionStart, onTranscriptionEnd, micStatus, onRequestMic]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current && isRecording) {
      recognitionRef.current.stop();
    }
    setIsRecording(false);
    setRecognitionState('idle');
    pointerActiveRef.current = false;
    
    // Clear waveform timeout
    if (waveformTimeoutRef.current) {
      clearTimeout(waveformTimeoutRef.current);
      waveformTimeoutRef.current = null;
    }
  }, [isRecording]);

  const handleMicClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    if (isRecording) {
      stopListening();
    } else {
      void startListening();
    }
  }, [isRecording, startListening, stopListening]);

  return (
    <div className="mic-input-container flex flex-col items-center justify-center px-4 bg-slate-50/50 rounded-b-none sm:rounded-b-[2.5rem] border-t border-slate-100 relative shrink-0">
      {(needsSecureContext || micStatus === 'denied' || micStatus === 'not_found') && (
        <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-rose-50 border border-rose-200 px-4 py-2 rounded-xl flex items-center gap-2 text-rose-800 shadow-md whitespace-nowrap z-20">
          <AlertTriangle size={16} />
          <span className="text-xs font-bold">{needsSecureContext ? "Can HTTPS de dung Micro tren iPhone" : "Can quyen Micro de noi"}</span>
        </div>
      )}

      {/* Sóng âm sinh động - only shows when mic is actually active */}
      <div className="mic-waveform-container h-6 sm:h-8 flex items-center justify-center gap-1.5 mb-1 w-full">
        {isRecording && recognitionState === 'listening' && (
          <div className="flex items-center gap-1">
            <Volume2 className="text-vibrant-coral animate-bounce mr-2" size={12} />
            {amplitude.map((h, i) => (
              <span
                key={i}
                style={{ height: `${h * 0.6}px` }}
                className="w-1 bg-gradient-to-t from-vibrant-coral to-vibrant-indigo rounded-full transition-all duration-100"
              ></span>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between w-full max-w-sm px-4 sm:px-6">
        {/* Nút chuyển chế độ gõ phím */}
        <button
          onClick={onSwitchMode}
          className="w-11 h-11 bg-white border border-slate-100 rounded-full text-slate-500 hover:text-slate-900 shadow-sm hover:shadow active:scale-95 transition-all cursor-pointer touch-manipulation flex items-center justify-center"
          title="Chuyển sang nhập văn bản"
        >
          <Keyboard size={20} />
        </button>

        {/* Nút Mic chính cỡ lớn - click to record, click to stop */}
        <button
          onClick={handleMicClick}
          className={`w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-tr ${
             (needsSecureContext || micStatus === 'denied' || micStatus === 'not_found') 
               ? "from-slate-400 to-slate-500 hover:scale-102"
               : isRecording
                 ? "from-vibrant-coral to-vibrant-coral/90 ring-6 ring-vibrant-coral/25 scale-105 shadow-vibrant-coral/20"
                 : "from-vibrant-indigo to-vibrant-indigo/90 hover:scale-102 shadow-vibrant-indigo/10"
          } text-white rounded-full flex items-center justify-center shadow-xl transition-all cursor-pointer select-none active:scale-90 touch-manipulation`}
        >
          <AudioLines size={30} strokeWidth={2.35} className={`${isRecording && micStatus !== 'denied' ? "text-white scale-110" : "text-white"}`} />
        </button>

        {/* Placeholder giữ thăng bằng */}
        <div className="w-11 h-11"></div>
      </div>

    </div>
  );
}





