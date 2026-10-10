import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  availableVoices, chooseVoice, getPreferredVoice, setPreferredVoice,
  voiceLocale, voicePreviewText,
} from "../src/utils/tts.ts";

const voices = [
  { voiceURI: "default-en", name: "English 1", lang: "en-US", default: true },
  { voiceURI: "ja-jp-1", name: "Japanese 1", lang: "ja-JP", default: true },
  { voiceURI: "ja-jp-2", name: "Japanese 2", lang: "ja-JP", default: false },
  { voiceURI: "ja-other", name: "Japanese region", lang: "ja-JP", default: false },
  { voiceURI: "ko-kr-1", name: "Korean voice", lang: "ko-KR", default: false },
  { voiceURI: "es-es-1", name: "Spanish voice", lang: "es-ES", default: false },
];

test("M5 browser voices: list only the current learning language and prefer exact locale", () => {
  const available = availableVoices("Japanese", voices);
  assert.equal(available.length, 3);
  assert.equal(available[0].lang, "ja-JP");
  assert.equal(available.some((v) => v.lang === "en-US"), false);
  assert.equal(voiceLocale("Chinese"), "zh-CN");
  assert.equal(voiceLocale("Korean"), "ko-KR");
});

test("M5 user chooses a voice (one option); fallback retains correct language", () => {
  assert.equal(chooseVoice("ja-JP", voices, "ja-jp-2")?.voiceURI, "ja-jp-2");
  assert.equal(chooseVoice("ja-JP", voices, "missing")?.voiceURI, "ja-jp-1");
  assert.equal(chooseVoice("ja-JP", voices.filter(v => v.lang === "ko-KR"), "ko-kr-1"), null);
  assert.equal(chooseVoice("es-ES", voices, null)?.voiceURI, "es-es-1");
});

test("M5 per-locale voice preference persists only the voice identifier", () => {
  const values = new Map<string,string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key,value); },
    removeItem: (key: string) => { values.delete(key); },
  };
  setPreferredVoice("Japanese", "ja-jp-2", storage);
  assert.equal(getPreferredVoice("ja-JP", storage), "ja-jp-2");
  assert.equal(getPreferredVoice("English", storage), null);
  assert.equal([...values.values()][0], "ja-jp-2");
  setPreferredVoice("ja", null, storage);
  assert.equal(getPreferredVoice("Japanese", storage), null);
});

test("M5 previews speak the selected target language and never fabricate audio availability", () => {
  assert.match(voicePreviewText("Japanese"), /[ぁ-んァ-ン一-龯]/u);
  assert.match(voicePreviewText("Korean"), /[가-힣]/u);
  assert.match(voicePreviewText("Chinese"), /[\u4e00-\u9fff]/u);
  assert.match(voicePreviewText("Spanish"), /Hola/);
  assert.equal(availableVoices("English", []).length, 0);
});

test("NEGATIVE CONTROL M5: no user-facing or forced pitch/rate controls", async () => {
  const ttsCode = await readFile(new URL("../src/utils/tts.ts", import.meta.url), "utf8");
  const settingsCode = await readFile(new URL("../src/components/SettingsView.tsx", import.meta.url), "utf8");
  assert.ok(!ttsCode.includes("utterance.rate ="));
  assert.ok(!ttsCode.includes("utterance.pitch ="));
  assert.ok(!settingsCode.includes("id=\"voice-speed\""));
  assert.ok(!settingsCode.includes("id=\"voice-pitch\""));
  assert.ok(settingsCode.includes('id="web-voice-choice"'));
});
