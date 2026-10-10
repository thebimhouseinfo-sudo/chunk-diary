# M2 — Language-neutral learning domain and AI response v2

Status: code is implemented on `codex/supabase-app`; only dev/test contract evidence applies. No deployment, production/main merge or provider certification.

## Locale and semantic contract

- `src/domain/language.ts` is the canonical BCP-47 language registry: Vietnamese source, English, Mandarin Chinese, Japanese, Korean, Spanish and French. Beta language labels (English, Chinese, Korean, Japanese, etc.) are parsed and normalized; original legacy rows remain unchanged.
- Script-appropriate tokenization uses `Intl.Segmenter` when the browser supports it, with a conservative Unicode fallback. Don't treat Chinese, Japanese or Korean text as space-delimited English.
- Source-language text (`sourceText` / legacy `nativeText`) and target-language text (`targetText` / compatible `text`) are first-class. Meaning is in the learner's native language; English is NOT a universal semantic pivot.
- `MeaningUnit.englishPivot` is **optional** for new rows. Old v4 English pivots remain readable. `Chunk.language` remains backward-compatible; new `targetLocale` is optional normalized metadata.
- No new IndexedDB stores/version changes in M2.

## Versioned response contract

New provider output (`contractVersion: "2"`) may contain:

```json
{
  "contractVersion": "2",
  "sourceLanguage": "vi-VN",
  "targetLanguage": "ja-JP",
  "narrative": "今日は少し遅く起きました。",
  "semanticUnits": [
    {
      "order": 1,
      "sourceText": "Hôm nay tôi dậy muộn.",
      "commonChunks": [{
        "targetText": "寝坊しました",
        "meaning": "đã ngủ quên",
        "romanization": "nebou shimashita",
        "proposedCanonicalMeaning": "ngủ quên"
      }],
      "personalizedChunks": []
    }
  ]
}
```

V2 **does not require** `englishNarrative`, `englishText` or `english`. The pure validator in `src/domain/generation.ts` enforces positive unique order, bounded nonempty strings, 1 common + 1 personalized chunk maximum per unit, a group ID or a proposed canonical meaning, and a 40-unit limit. It rejects malformed whole results without partial persistence. Legacy v1 responses without `contractVersion` continue to parse and preserve genuine optional English metadata.

`src/utils/aiService.ts` adapts current server output (including old JSON string envelope) into the canonical validated response. The client never synthesizes an English pivot for Japanese/Korean/Chinese. `StoryChatView.tsx` writes source/target metadata and only saves genuine English text to the English corpus; `userProgress.targetMeaning` uses the native-language meaning rather than assuming English.

## M3 backend dependency and limitations

The existing public Edge/Express generation prompts still request English narrative and expose old prompt text. **M2 is not provider-level completeness**. M3 must produce a truly versioned private server-only prompt and provider output matching this contract, verify security/privacy/auth and test actual configured provider calls. Old published prompt text cannot become secret retroactively.

The following do not require user action: local domain, types, normalizers, contract tests and simulated provider responses. **External provider keys/private prompt storage require separate protected configuration and must never be committed to source or entered into ChatGPT messages.**

M2 CI `.github/workflows/m2-domain.yml` runs TypeScript check, Vite production build, synthetic Japanese/Chinese/English validation tests and negative controls. This is dev CI, not an M8 production migration rehearsal.
