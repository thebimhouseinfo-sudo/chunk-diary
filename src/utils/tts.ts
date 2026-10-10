/**
 * M5: browser Web Speech voice selection only.
 * No cloud voice subscription, native TTS, offline guarantee, speed/pitch
 * controls, or OS microphone/audio-session permissions.
 */
import { getLanguageProfile } from "../domain/language";
import { workspaceLocalKey } from "../db/workspaceRouter";

export interface BrowserVoiceOption {
  voiceURI: string;
  name: string;
  lang: string;
  localService?: boolean;
  default?: boolean;
}

const preferencePrefix = "chunkdiary.webVoice.";
export function voiceLocale(language: string): string {
  return getLanguageProfile(language).locale;
}
function preferenceKey(language: string): string {
  return workspaceLocalKey(preferencePrefix + getLanguageProfile(language).baseLanguage);
}
export function getPreferredVoice(language: string, storage?: Pick<Storage, "getItem">): string | null {
  try {
    const store = storage ?? (typeof localStorage === "undefined" ? undefined : localStorage);
    return store?.getItem(preferenceKey(language)) || null;
  } catch { return null; }
}
export function setPreferredVoice(
  language: string, voiceURI: string | null,
  storage?: Pick<Storage, "setItem" | "removeItem">,
): void {
  const store = storage ?? (typeof localStorage === "undefined" ? undefined : localStorage);
  if (!store) return;
  if (voiceURI) store.setItem(preferenceKey(language), voiceURI);
  else store.removeItem(preferenceKey(language));
}

export function availableVoices(
  language: string,
  allVoices?: readonly BrowserVoiceOption[],
): BrowserVoiceOption[] {
  const voices = allVoices ?? (
    typeof window !== "undefined" && window.speechSynthesis
      ? window.speechSynthesis.getVoices() : []
  );
  const locale = voiceLocale(language).toLowerCase();
  const base = locale.split("-")[0];
  // Never offer a voice of an unrelated language as a selectable option.
  return voices
    .filter((v) => typeof v.voiceURI === "string" &&
      v.lang.toLowerCase().split("-")[0] === base)
    .sort((a, b) =>
      Number(b.lang.toLowerCase() === locale) - Number(a.lang.toLowerCase() === locale) ||
      Number(Boolean(b.default)) - Number(Boolean(a.default)) ||
      a.name.localeCompare(b.name));
}

export function chooseVoice(
  language: string, voices: readonly BrowserVoiceOption[],
  storedId: string | null,
): BrowserVoiceOption | null {
  const matching = availableVoices(language, voices);
  return matching.find((voice) => storedId && voice.voiceURI === storedId) ?? matching[0] ?? null;
}

export function voicePreviewText(language: string): string {
  const text: Record<string, string> = {
    en: "Hello! This is my reading voice.",
    zh: "你好！这是我的朗读声音。",
    ja: "こんにちは。これは私の読み上げ音声です。",
    ko: "안녕하세요. 이것은 제 읽기 목소리입니다.",
    es: "Hola, esta es mi voz de lectura.",
    fr: "Bonjour, voici ma voix de lecture.",
    de: "Hallo, das ist meine Lesestimme.",
    it: "Ciao, questa è la mia voce di lettura.",
    vi: "Xin chào, đây là giọng đọc của tôi.",
  };
  return text[getLanguageProfile(language).baseLanguage] || "Hello";
}

export function speakText(text: string, language: string): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === "undefined" ||
        typeof SpeechSynthesisUtterance === "undefined" || !window.speechSynthesis) {
      resolve();
      return;
    }
    const clean = text.replace(/·/g, " ").replace(/-/g, " ").trim();
    if (!clean) { resolve(); return; }
    const synthesizer = window.speechSynthesis;
    synthesizer.cancel();
    const utterance = new SpeechSynthesisUtterance(clean);
    utterance.lang = voiceLocale(language);
    const selected = chooseVoice(language, synthesizer.getVoices(), getPreferredVoice(language));
    if (selected) {
      const native = synthesizer.getVoices().find((voice) => voice.voiceURI === selected.voiceURI);
      if (native) utterance.voice = native;
    }
    // Deliberately use the voice's natural defaults. User chooses only voice.
    utterance.onend = () => resolve();
    utterance.onerror = () => resolve();
    try { synthesizer.speak(utterance); }
    catch { resolve(); }
  });
}
export function stopSpeech(): void {
  if (typeof window !== "undefined" && window.speechSynthesis) window.speechSynthesis.cancel();
}
export function loadVoices(): void {
  if (typeof window !== "undefined" && window.speechSynthesis) window.speechSynthesis.getVoices();
}

// Preserve existing app behavior: pressing unrelated controls interrupts speech.
if (typeof window !== "undefined") {
  document.addEventListener("click", (event) => {
    const target = event.target as HTMLElement | null;
    if (target && !target.closest("[data-tts]") &&
        window.speechSynthesis?.speaking) window.speechSynthesis.cancel();
  }, { capture: true });
}
