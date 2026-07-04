/**
 * Text-To-Speech (TTS) helper using standard Web Speech API
 */

export function speakText(text: string, language: string): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      console.warn("Speech synthesis is not supported in this environment");
      resolve();
      return;
    }

    // Cancel any ongoing speech
    window.speechSynthesis.cancel();

    // Clean up any double periods, etc.
    const cleanText = text.replace(/·/g, " ").replace(/-/g, " ").trim();
    const utterance = new SpeechSynthesisUtterance(cleanText);
    
    // Map language names or codes to standard BCP-47 codes
    const langLower = language.toLowerCase();
    if (langLower.includes("english") || langLower === "en") {
      utterance.lang = "en-US";
    } else if (langLower.includes("japanese") || langLower === "ja" || langLower === "jp") {
      utterance.lang = "ja-JP";
    } else if (langLower.includes("chinese") || langLower === "zh" || langLower === "cn") {
      utterance.lang = "zh-CN";
    } else if (langLower.includes("korean") || langLower === "ko" || langLower === "kr") {
      utterance.lang = "ko-KR";
    } else if (langLower.includes("vietnamese") || langLower === "vi") {
      utterance.lang = "vi-VN";
    } else if (langLower.includes("french") || langLower === "fr") {
      utterance.lang = "fr-FR";
    } else if (langLower.includes("spanish") || langLower === "es") {
      utterance.lang = "es-ES";
    } else if (langLower.includes("german") || langLower === "de") {
      utterance.lang = "de-DE";
    } else if (langLower.includes("italian") || langLower === "it") {
      utterance.lang = "it-IT";
    } else if (langLower.includes("russian") || langLower === "ru") {
      utterance.lang = "ru-RU";
    } else {
      utterance.lang = language;
    }

    // Attempt to locate a high-quality voice
    const voices = window.speechSynthesis.getVoices();
    const langPrefix = utterance.lang.split("-")[0];
    
    // Try exact matches first
    let voice = voices.find(v => v.lang === utterance.lang);
    if (!voice) {
      // Then prefix match (e.g. ja, zh, ko)
      voice = voices.find(v => v.lang.startsWith(langPrefix));
    }
    
    if (voice) {
      utterance.voice = voice;
    }

    // Moderate reading rate for learners
    utterance.rate = 0.85;

    utterance.onend = () => {
      resolve();
    };

    utterance.onerror = (e) => {
      console.error("Speech synthesis error", e);
      resolve();
    };

    window.speechSynthesis.speak(utterance);
  });
}

// Global cancellation of current speech
export function stopSpeech(): void {
  if (typeof window !== "undefined" && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
}

// Set up global click interception to abort ongoing audio if user clicks "another button"
if (typeof window !== "undefined") {
  document.addEventListener("click", (event) => {
    const target = event.target as HTMLElement | null;
    if (!target) return;
    
    // If the click is not on a dedicated TTS button, interrupt any active speech
    const isTtsButton = target.closest("[data-tts]");
    if (!isTtsButton) {
      if (window.speechSynthesis && window.speechSynthesis.speaking) {
        window.speechSynthesis.cancel();
      }
    }
  }, { capture: true }); // Capturing phase ensures early execution
}

// Helper to pre-load voices (Chrome sometimes delays voice loading)
export function loadVoices(): void {
  if (typeof window !== "undefined" && window.speechSynthesis) {
    window.speechSynthesis.getVoices();
  }
}
