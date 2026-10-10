# M5 — Browser-only voice selector

Status: **Web-only implementation on development branch**. No native iOS/Android voice adapter, offline voice guarantee, native microphone permission implementation or production deployment.

- `src/utils/tts.ts` lists the actual speechSynthesis voices exposed by the browser, filters voices by target language, ranks exact locale first and safely falls back to another available voice of the **same base language**. Never presents an unrelated-language voice as a choice.
- Users can choose **one voice** for the target language, then press **Nghe thử giọng**. No controls for speaking rate, pitch, audio quality, cloud TTS tier or explicit accent preference. Accent is whatever the selected voice itself provides.
- The preference is saved under a simple local guest `chunkdiary.webVoice.<locale>` key. **Before enabling signed-in account switching, M6 must move voice preference into the owner-scoped settings repository**; preferences currently are not scoped by account.
- A device/browser with zero exposed matching voices shows a nonblocking text-learning fallback. Web Speech voices may depend on browser, installed voices and network; availability does not prove offline support.
- `VoiceInput.tsx` now receives the user's native language from StoryChat profile, rather than hardcoded `vi-VN`. Unsupported browser SpeechRecognition **no longer fabricates a Vietnamese transcript**. A clear text-input fallback remains.
- Tests `tests/browser-voice.test.ts` verify locale mapping, multilingual sample previews, persistence of selected voice ID, no incorrect-language fallback, and absence of speed/pitch UI. Workflow `.github/workflows/m5-web-voice.yml` runs TypeScript check, Vite build and regression tests.
- These are browser-API contract tests, not manual iOS Safari / Android Chrome listening evaluations. Real-device listening remains a Web checkpoint before final release.

The separate Native Phase, not this Web roadmap, will cover OS microphone permissions, installed/offline voices, native speech sessions and background playback.
