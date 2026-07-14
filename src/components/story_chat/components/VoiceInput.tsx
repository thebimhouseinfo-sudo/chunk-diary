import React, { useState, useRef, useEffect, useCallback } from "react";
import { Mic, Keyboard, Sparkles, Volume2 } from "lucide-react";
import { getBrowserInfo } from "../../../utils/browser";

interface VoiceInputProps {
  onTranscriptionStart: () => void;
  onTranscriptionEnd: (text: string) => void;
  onSwitchMode: () => void;
}

export default function VoiceInput({
  onTranscriptionStart,
  onTranscriptionEnd,
  onSwitchMode
}: VoiceInputProps) {
  const [isHolding, setIsHolding] = useState(false);
  const [amplitude, setAmplitude] = useState<number[]>([10, 10, 10, 10, 10]);
  const [isMicReady, setIsMicReady] = useState(false);
  const [recognitionState, setRecognitionState] = useState<'idle' | 'initializing' | 'listening'>('idle');
  const recognitionRef = useRef<any>(null);
  const intervalRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const waveformTimeoutRef = useRef<any>(null);
  const pointerActiveRef = useRef(false);
  const recognitionStartedRef = useRef(false);

  // Initialize microphone and audio analysis on mount
  useEffect(() => {
    const initMic = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          } 
        });
        
        // Stop the stream immediately after getting permission
        // This saves battery, avoids persistent mic icon on Android, and prevents Safari from keeping audio session
        stream.getTracks().forEach(track => track.stop());
        
        setIsMicReady(true);
        
      } catch (err) {
        console.error("Mic initialization failed:", err);
        setIsMicReady(false);
      }
    };
    
    initMic();
    
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
    if (pointerActiveRef.current) return; // Prevent double-triggering
    pointerActiveRef.current = true;
    recognitionStartedRef.current = false;
    
    setIsHolding(true);
    setRecognitionState('initializing');
    onTranscriptionStart();

    // Wait for mic to be ready before starting recognition
    if (!isMicReady) {
      console.log("Waiting for mic to be ready...");
      pointerActiveRef.current = false;
      setIsHolding(false);
      setRecognitionState('idle');
      return;
    }

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      
      // Get browser info and set language accordingly
      const browserInfo = getBrowserInfo();
      recognition.lang = "vi-VN";

      // iOS Safari specific: prevent the recognition from ending prematurely
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
        // iOS Safari: handle specific errors gracefully
        if (event.error === 'no-speech') {
          console.log("No speech detected, waiting for retry");
        } else if (event.error === 'not-allowed') {
          console.log("Microphone permission not allowed");
        } else if (event.error === 'audio-capture') {
          console.log("No microphone found or audio capture failed");
        } else if (event.error === 'bad-grammar') {
          console.log("Bad grammar in recognition request");
        }
        setRecognitionState('idle');
        onTranscriptionEnd("");
      };

      recognition.onend = () => {
        console.log("Speech recognition ended");
        setIsHolding(false);
        setRecognitionState('idle');
        pointerActiveRef.current = false;
        recognitionStartedRef.current = false;
      };

      // Waveform activation with priority order and fallback timeout
      let waveformActivated = false;
      
      const activateWaveform = () => {
        if (!waveformActivated) {
          waveformActivated = true;
          setRecognitionState('listening');
        }
      };

      // Priority 1: onstart fires when recognition begins
      recognition.onstart = () => {
        console.log("SpeechRecognition started");
        recognitionStartedRef.current = true;
        activateWaveform();
      };

      // Priority 2: onaudiostart fires when audio capture begins (Chrome/Edge)
      recognition.onaudiostart = () => {
        console.log("Audio capture started");
        activateWaveform();
      };

      // Priority 3: onsoundstart fires when sound is detected (Firefox)
      recognition.onsoundstart = () => {
        console.log("Sound detected");
        activateWaveform();
      };

      // Priority 4: onspeechstart fires when speech is detected (Safari)
      recognition.onspeechstart = () => {
        console.log("Speech detected");
        activateWaveform();
      };

      recognitionRef.current = recognition;
      
      // Start recognition with a small delay to ensure all handlers are set up
      try {
        setTimeout(() => {
          recognition.start();
          console.log("SpeechRecognition.start() called");
        }, 50);
        
        // Fallback timeout: if no event fires within 500ms, show waveform anyway
        waveformTimeoutRef.current = setTimeout(() => {
          if (!waveformActivated && isHolding) {
            console.log("Waveform timeout fallback - showing waveform");
            activateWaveform();
          }
        }, 500);
        
      } catch (e) {
        console.error("Failed to start recognition:", e);
        setIsHolding(false);
        setRecognitionState('idle');
        pointerActiveRef.current = false;
        onTranscriptionEnd("");
      }
    } else {
      // Mockup transcription fallback
      console.log("Speech recognition not supported, using fallback");
      setTimeout(() => {
        onTranscriptionEnd("Hôm nay mình dậy hơi muộn. Sau đó mình đưa con đi học.");
        setIsHolding(false);
        setRecognitionState('idle');
        pointerActiveRef.current = false;
      }, 2000);
    }
  }, [isMicReady, onTranscriptionStart, onTranscriptionEnd, isHolding]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current && isHolding) {
      recognitionRef.current.stop();
    }
    setIsHolding(false);
    setRecognitionState('idle');
    pointerActiveRef.current = false;
    
    // Clear waveform timeout
    if (waveformTimeoutRef.current) {
      clearTimeout(waveformTimeoutRef.current);
      waveformTimeoutRef.current = null;
    }
  }, [isHolding]);

  // Handle pointer events for unified desktop/mobile interaction
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    startListening();
  }, [startListening]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    stopListening();
  }, [stopListening]);

  const handlePointerCancel = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    stopListening();
  }, [stopListening]);

  const handlePointerLeave = useCallback(() => {
    // Stop recording if pointer leaves the button while holding
    if (isHolding) {
      stopListening();
    }
  }, [isHolding, stopListening]);

  return (
    <div className="mic-input-container flex flex-col items-center justify-center py-1 px-4 bg-slate-50/50 rounded-b-[2.5rem] border-t border-slate-100 relative">
      {/* Sóng âm sinh động - only shows when mic is actually active */}
      <div className="mic-waveform-container h-8 flex items-center justify-center gap-1.5 mb-1 w-full">
        {isHolding && recognitionState === 'listening' && (
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

      <div className="flex items-center justify-between w-full max-w-sm px-6">
        {/* Nút chuyển chế độ gõ phím */}
        <button
          onClick={onSwitchMode}
          className="p-2.5 bg-white border border-slate-100 rounded-xl text-slate-500 hover:text-slate-800 shadow-sm hover:shadow active:scale-95 transition-all cursor-pointer"
          title="Chuyển sang nhập văn bản"
        >
          <Keyboard size={18} />
        </button>

        {/* Nút Mic chính cỡ lớn - optimized for mobile using Pointer Events */}
        <button
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
          onPointerLeave={handlePointerLeave}
          className={`w-18 h-18 sm:w-24 sm:h-24 bg-gradient-to-tr from-vibrant-indigo to-vibrant-indigo/90 text-white rounded-full flex items-center justify-center shadow-xl transition-all cursor-pointer select-none active:scale-90 touch-none ${
            isHolding
              ? "ring-6 ring-vibrant-indigo/25 scale-105 shadow-vibrant-indigo/20"
              : "hover:scale-102 shadow-vibrant-indigo/10"
          }`}
        >
          <Mic size={28} className={`${isHolding ? "text-vibrant-mint scale-110" : "text-white"}`} />
        </button>

        {/* Placeholder giữ thăng bằng */}
        <div className="w-10 h-10"></div>
      </div>

      <div className="text-xs text-slate-500 mt-2 font-bold tracking-tight text-center select-none max-w-xs leading-relaxed">
        {isHolding ? (
          recognitionState === 'listening' ? (
            <span className="text-vibrant-coral animate-pulse">Đang ghi âm... Thả tay để gửi</span>
          ) : (
            <span className="text-slate-400 animate-pulse">Đang khởi tạo micro...</span>
          )
        ) : (
          <span className="text-slate-400 flex items-center justify-center gap-1.5 uppercase tracking-wide">
            <Sparkles size={12} className="text-vibrant-indigo shrink-0" /> Nhấn giữ để kể câu chuyện của bạn bằng tiếng Việt
          </span>
        )}
      </div>
    </div>
  );
}
