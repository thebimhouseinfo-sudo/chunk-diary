import { useState, useRef, useEffect } from "react";

export function useVoiceRecorder(onTranscriptionComplete: (text: string) => void) {
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    // Check for speech recognition support
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = false;
      recognition.lang = "vi-VN";

      recognition.onresult = (event: any) => {
        const lastResultIndex = event.results.length - 1;
        const text = event.results[lastResultIndex][0].transcript;
        if (text && text.trim()) {
          onTranscriptionComplete(text.trim());
        }
      };

      recognition.onerror = (event: any) => {
        console.error("Speech recognition error:", event.error);
        if (event.error !== "no-speech") {
          setError(event.error);
        }
      };

      recognition.onend = () => {
        setIsRecording(false);
      };

      recognitionRef.current = recognition;
    } else {
      setError("not_supported");
    }
  }, [onTranscriptionComplete]);

  const startRecording = async () => {
    setError(null);
    if (!recognitionRef.current) {
      setError("not_supported");
      return;
    }

    try {
      // Request mic access first
      await navigator.mediaDevices.getUserMedia({ audio: true });
      setIsRecording(true);
      recognitionRef.current.start();
    } catch (err: any) {
      console.error("Mic access denied:", err);
      setError("permission_denied");
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    if (recognitionRef.current && isRecording) {
      recognitionRef.current.stop();
      setIsRecording(false);
    }
  };

  return {
    isRecording,
    error,
    startRecording,
    stopRecording
  };
}
