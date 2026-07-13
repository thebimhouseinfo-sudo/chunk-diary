import React, { useState, useRef, useEffect } from "react";
import { Mic, Keyboard, Sparkles, Volume2 } from "lucide-react";

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
  const [isRecognitionStarted, setIsRecognitionStarted] = useState(false);
  const recognitionRef = useRef<any>(null);
  const intervalRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

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
        streamRef.current = stream;
        
        // Set up audio context for real-time amplitude detection
        audioContextRef.current = new AudioContext();
        analyserRef.current = audioContextRef.current.createAnalyser();
        analyserRef.current.fftSize = 64;
        sourceRef.current = audioContextRef.current.createMediaStreamSource(stream);
        sourceRef.current.connect(analyserRef.current);
        
        setIsMicReady(true);
        
        // Start monitoring amplitude
        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
        
        const updateAmplitude = () => {
          if (analyserRef.current && isHolding && isRecognitionStarted) {
            analyserRef.current.getByteFrequencyData(dataArray);
            const values = Array.from(dataArray.slice(0, 8)).map(v => Math.max(10, v * 0.6));
            setAmplitude(values);
          } else if (!isHolding || !isRecognitionStarted) {
            setAmplitude([10, 10, 10, 10, 10]);
          }
          requestAnimationFrame(updateAmplitude);
        };
        
        updateAmplitude();
        
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
    };
  }, []);

  const startListening = async () => {
    setIsHolding(true);
    onTranscriptionStart();

    // Wait for mic to be ready before starting recognition
    if (!isMicReady) {
      console.log("Waiting for mic to be ready...");
      return;
    }

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = "vi-VN";

      // iOS Safari specific: prevent the recognition from ending prematurely
      recognition.maxAlternatives = 1;

      recognition.onresult = (event: any) => {
        const text = event.results[0][0].transcript;
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
        }
        onTranscriptionEnd("");
      };

      recognition.onend = () => {
        setIsHolding(false);
        setIsRecognitionStarted(false);
      };

      // Wait for actual microphone activation before showing waveform
      // Use onstart + onaudiostart/onsoundstart combination for best cross-browser support
      recognition.onstart = () => {
        console.log("SpeechRecognition started");
        setIsRecognitionStarted(true);
      };

      // Chrome/Edge: onaudiostart fires when audio is actually being captured
      recognition.onaudiostart = () => {
        console.log("Audio capture started");
        setIsRecognitionStarted(true);
      };

      // Firefox: onsoundstart fires when sound is detected
      recognition.onsoundstart = () => {
        console.log("Sound detected");
        setIsRecognitionStarted(true);
      };

      // Safari: onspeechstart fires when speech is detected
      recognition.onspeechstart = () => {
        console.log("Speech detected");
        setIsRecognitionStarted(true);
      };

      recognitionRef.current = recognition;
      
      // Start recognition - waveform will only show after onstart/onaudiostart fires
      try {
        recognition.start();
      } catch (e) {
        console.error("Failed to start recognition:", e);
        setIsHolding(false);
        setIsRecognitionStarted(false);
        onTranscriptionEnd("");
      }
    } else {
      // Mockup transcription fallback
      setTimeout(() => {
        onTranscriptionEnd("Hôm nay mình dậy hơi muộn. Sau đó mình đưa con đi học.");
        setIsHolding(false);
      }, 2000);
    }
  };

  const stopListening = () => {
    if (recognitionRef.current && isHolding) {
      recognitionRef.current.stop();
    }
    setIsHolding(false);
    setIsRecognitionStarted(false);
  };

  return (
    <div className="mic-input-container flex flex-col items-center justify-center py-1 px-4 bg-slate-50/50 rounded-b-[2.5rem] border-t border-slate-100 relative">
      {/* Sóng âm sinh động - only shows when mic is actually active */}
      <div className="mic-waveform-container h-8 flex items-center justify-center gap-1.5 mb-1 w-full">
        {isHolding && isRecognitionStarted && (
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

        {/* Nút Mic chính cỡ lớn - optimized for mobile */}
        <button
          onMouseDown={startListening}
          onMouseUp={stopListening}
          onTouchStart={startListening}
          onTouchEnd={stopListening}
          className={`w-18 h-18 sm:w-24 sm:h-24 bg-gradient-to-tr from-vibrant-indigo to-vibrant-indigo/90 text-white rounded-full flex items-center justify-center shadow-xl transition-all cursor-pointer select-none active:scale-90 ${
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
          isRecognitionStarted ? (
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
