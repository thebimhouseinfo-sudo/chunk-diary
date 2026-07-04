/**
 * Speech Recognition and Pronunciation Evaluation helper
 */

// Simple Levenshtein distance for word comparison
function getEditDistance(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

function getSimilarity(s1: string, s2: string): number {
  const longer = s1.length > s2.length ? s1 : s2;
  const longerLength = longer.length;
  if (longerLength === 0) {
    return 1.0;
  }
  return (longerLength - getEditDistance(s1, s2)) / longerLength;
}

// Clean text for speech comparison
export function cleanTextForSpeech(text: string): string {
  return text
    .toLowerCase()
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"'·]|japanese|chinese|english/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export interface WordScore {
  word: string;
  status: "good" | "improve" | "wrong";
}

export interface PronunciationResult {
  accuracy: number;
  stars: number;
  wordFeedback: WordScore[];
  spokenText: string;
}

// Evaluate pronunciation accuracy and map to stars
export function evaluatePronunciation(targetText: string, spokenText: string, language: string): PronunciationResult {
  const cleanTarget = cleanTextForSpeech(targetText);
  const cleanSpoken = cleanTextForSpeech(spokenText);

  const langLower = language.toLowerCase();
  const isNoSpaceLang = langLower.includes("chinese") || langLower.includes("japanese") || langLower === "zh" || langLower === "ja";

  let wordFeedback: WordScore[] = [];
  let accuracy = 0;

  if (isNoSpaceLang) {
    // Character by character comparison for Chinese/Japanese
    const targetChars = targetText.split("");
    const cleanSpokenChars = cleanSpoken.replace(/\s/g, "").split("");
    
    let matchedCount = 0;
    wordFeedback = targetChars.map(char => {
      if (/[.,\/#!$%\^&\*;:{}=\-_`~()?"'·\s]/.test(char)) {
        return { word: char, status: "good" }; // Ignore punctuation/spaces
      }
      
      const charClean = char.toLowerCase();
      // See if character exists in spoken chars
      const index = cleanSpokenChars.indexOf(charClean);
      if (index !== -1) {
        cleanSpokenChars.splice(index, 1); // Consume character
        matchedCount++;
        return { word: char, status: "good" };
      } else {
        return { word: char, status: "wrong" };
      }
    });

    const totalActualChars = targetChars.filter(c => !/[.,\/#!$%\^&\*;:{}=\-_`~()?"'·\s]/.test(c)).length;
    accuracy = totalActualChars > 0 ? Math.round((matchedCount / totalActualChars) * 100) : 100;

  } else {
    // Word-by-word comparison for space-separated languages
    const targetWords = targetText.split(/\s+/);
    const spokenWords = cleanSpoken.split(/\s+/).filter(w => w.length > 0);

    let totalScore = 0;
    const usedSpokenIndices = new Set<number>();

    wordFeedback = targetWords.map(rawWord => {
      const cleanWord = cleanTextForSpeech(rawWord);
      if (!cleanWord) {
        return { word: rawWord, status: "good" }; // spacing/punctuation only
      }

      // Find the best matching word in spokenWords that hasn't been used yet
      let bestSim = 0;
      let bestIndex = -1;

      for (let i = 0; i < spokenWords.length; i++) {
        if (usedSpokenIndices.has(i)) continue;
        const sim = getSimilarity(cleanWord, spokenWords[i]);
        if (sim > bestSim) {
          bestSim = sim;
          bestIndex = i;
        }
      }

      let status: "good" | "improve" | "wrong" = "wrong";
      let score = 0;

      if (bestIndex !== -1 && bestSim > 0.4) {
        usedSpokenIndices.add(bestIndex);
        if (bestSim >= 0.8) {
          status = "good";
          score = 1.0;
        } else if (bestSim >= 0.5) {
          status = "improve";
          score = 0.6;
        } else {
          status = "wrong";
          score = 0.2;
        }
      }

      totalScore += score;
      return { word: rawWord, status };
    });

    const contentWordsCount = targetWords.filter(w => cleanTextForSpeech(w).length > 0).length;
    accuracy = contentWordsCount > 0 ? Math.round((totalScore / contentWordsCount) * 100) : 100;
  }

  // Double check overall text similarity to prevent false-positives
  const overallSimilarity = getSimilarity(cleanTarget, cleanSpoken);
  const matchedAccuracy = Math.round(overallSimilarity * 100);
  
  // Mix word score with overall sequence match to handle missing word penalties
  accuracy = Math.min(100, Math.max(0, Math.round(accuracy * 0.7 + matchedAccuracy * 0.3)));

  // Stars mapping:
  // 0-39% = 1 star
  // 40-59% = 2 stars
  // 60-79% = 3 stars
  // 80-94% = 4 stars
  // 95-100% = 5 stars
  let stars = 1;
  if (accuracy >= 95) stars = 5;
  else if (accuracy >= 80) stars = 4;
  else if (accuracy >= 60) stars = 3;
  else if (accuracy >= 40) stars = 2;

  return {
    accuracy,
    stars,
    wordFeedback,
    spokenText: spokenText || "(Không nghe thấy gì / No speech heard)"
  };
}

// Browser Web Speech Recognition service wrapper
export class SpeechService {
  private recognition: any = null;
  private isListening = false;

  constructor(language: string) {
    if (typeof window !== "undefined") {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        this.recognition = new SpeechRecognition();
        this.recognition.continuous = false;
        this.recognition.interimResults = false;

        // Map language strings to BCP-47
        const langLower = language.toLowerCase();
        if (langLower.includes("english") || langLower === "en") {
          this.recognition.lang = "en-US";
        } else if (langLower.includes("japanese") || langLower === "ja" || langLower === "jp") {
          this.recognition.lang = "ja-JP";
        } else if (langLower.includes("chinese") || langLower === "zh" || langLower === "cn") {
          this.recognition.lang = "zh-CN";
        } else if (langLower.includes("korean") || langLower === "ko" || langLower === "kr") {
          this.recognition.lang = "ko-KR";
        } else if (langLower.includes("vietnamese") || langLower === "vi") {
          this.recognition.lang = "vi-VN";
        } else if (langLower.includes("french") || langLower === "fr") {
          this.recognition.lang = "fr-FR";
        } else if (langLower.includes("spanish") || langLower === "es") {
          this.recognition.lang = "es-ES";
        } else if (langLower.includes("german") || langLower === "de") {
          this.recognition.lang = "de-DE";
        } else if (langLower.includes("italian") || langLower === "it") {
          this.recognition.lang = "it-IT";
        } else if (langLower.includes("russian") || langLower === "ru") {
          this.recognition.lang = "ru-RU";
        } else {
          this.recognition.lang = language;
        }
      }
    }
  }

  public isSupported(): boolean {
    return this.recognition !== null;
  }

  public startListening(
    onResult: (text: string) => void,
    onError: (err: string) => void,
    onEnd: () => void
  ) {
    if (!this.recognition) {
      onError("Speech recognition not supported in this browser.");
      return;
    }

    if (this.isListening) {
      this.recognition.stop();
    }

    this.isListening = true;

    this.recognition.onresult = (event: any) => {
      const resultText = event.results[0][0].transcript;
      onResult(resultText);
    };

    this.recognition.onerror = (event: any) => {
      console.error("Speech Recognition Error:", event.error);
      onError(event.error === "no-speech" ? "Không nghe thấy tiếng nói. Xin hãy nói to hơn!" : `Lỗi: ${event.error}`);
    };

    this.recognition.onend = () => {
      this.isListening = false;
      onEnd();
    };

    try {
      this.recognition.start();
    } catch (e: any) {
      onError(`Lỗi khởi động: ${e.message}`);
    }
  }

  public stopListening() {
    if (this.recognition && this.isListening) {
      this.recognition.stop();
      this.isListening = false;
    }
  }
}
