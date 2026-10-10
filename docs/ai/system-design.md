# AI System Design

## 1. Goals

The AI system converts a short diary/story into learning material:

1. Translate the source story into an English pivot narrative.
2. Split the story into ordered semantic units.
3. Extract common and personalized target-language chunks.
4. Produce pronunciation metadata and native-language meanings.
5. Reuse matching semantic groups when the client supplies them.

The system must support the existing web beta, an optional cloud identity, and a
future native mobile client without duplicating product logic.

## 2. Non-goals

- The conversational guide is not an LLM chat system. Its current prompts and
  workflow remain deterministic and local.
- The backend does not own the user's local diary database in the first migration.
- The system does not promise human-level pronunciation scoring from plain text
  transcription.
- Native mobile does not automatically provide unlimited microphone access or
  unlimited free Siri voices. It provides better platform integration and access
  to voices available under the device/platform rules.

## 3. Current and Target Architecture

### Current beta

```text
Web client
  |
  +-- IndexedDB: diary, chunks, progress, settings
  |
  +-- AI adapter
        |
        +-- Google Apps Script (production)
```

### Migration target

```text
Web or native client
  |
  +-- Local repository (IndexedDB / SQLite)
  |
  +-- AI client adapter
        |
        +-- Apps Script adapter (legacy, beta fallback)
        +-- Supabase Edge Function adapter (new)
        +-- Future provider adapters
  |
  +-- Optional sync adapter
        |
        +-- Anonymous cloud session
        +-- Linked Google account
```

The client chooses a backend through configuration or a feature flag. UI code
must not know whether the request went to Apps Script or Supabase.

## 4. Responsibilities

### Client

- Collect and edit the story.
- Load local learner settings and semantic groups.
- Enforce input size limits before sending.
- Send a canonical `GenerateChunksRequest`.
- Validate the response again before writing IndexedDB.
- Save generated chunks locally before attempting cloud sync.
- Queue failed sync operations for retry.

### AI gateway

- Authenticate the request when cloud mode is enabled.
- Apply request limits and quota checks.
- Normalize provider-specific requests.
- Keep provider API keys server-side.
- Call the selected model.
- Validate and normalize model output.
- Return the canonical response or a stable error code.

### Cloud sync

- Store only the data covered by product consent.
- Associate rows with the authenticated Supabase user id.
- Support anonymous users during beta.
- Preserve the same user id when the user links Google.
- Never use a browser fingerprint as an identity or authorization mechanism.

## 5. Generation Flow

```text
[User finishes story]
        |
        v
[Read local profile and semantic groups]
        |
        v
[Validate size, language, CEFR, and consent]
        |
        v
[AI client adapter]
   |                    |
   +-- Apps Script       +-- Supabase Edge Function
        |                    |
        +-------- canonical response --------+
                                             |
                                             v
                              [Schema validation and normalization]
                                             |
                                             v
                              [Atomic local save: diary, units, chunks]
                                             |
                                             v
                              [Optional sync queue]
```

The local save must not depend on cloud sync success. A temporary cloud outage
must not discard generated learning material.

## 6. Model Strategy

The gateway should support a small provider-neutral configuration:

```text
provider: gemini | openai-compatible | mock
model: provider-specific model name
temperature: provider-specific optional value
maxInputCharacters: enforced server-side
maxOutputTokens: enforced server-side
```

For the beta, use one low-cost or free-eligible model and avoid exposing model
selection to normal users. A `mock` provider is useful for tests and UI demos.
The model name must be configured on the server, not trusted from the client.

## 7. Prompt Design

The prompt should contain these sections in a stable order:

1. Role and output rules.
2. Native language, target language, CEFR level, and learning purpose.
3. Specialty and sub-specialty, if provided.
4. Existing semantic groups, capped and normalized.
5. Diary content, clearly delimited as untrusted user content.
6. Exact task list and JSON schema.

The prompt must explicitly require:

- No markdown fences.
- No invented user facts.
- Natural target-language chunks, not arbitrary single words.
- Empty `semanticGroupId` when there is no reliable match.
- `proposedCanonicalMeaning` only for a new group.
- The requested number of chunks per semantic unit.

Prompt changes should be versioned, for example `chunk-extraction-v1` and
`chunk-extraction-v2`, so output quality can be compared during rollout.

## 8. Native Speech and TTS Boundary

Speech recognition and TTS are not part of the text-generation API. They belong
to a platform service:

```text
SpeechRecognitionService
  start(language)
  stop()
  onPartialResult
  onFinalResult

TextToSpeechService
  speak(text, language, voicePreference?)
  listVoices(language?)
```

The web implementation can use Web Speech APIs. The native implementation can
use iOS Speech/AVAudioSession and AVSpeechSynthesizer, and Android speech/TTS
APIs. The app should expose the available voice quality and offline capability,
not promise a specific Siri voice on every device.

## 9. Architectural Decisions

### ADR-001: Local-first remains the source of truth during migration

Decision: local writes complete before cloud sync is attempted.

Reason: beta users must not lose data because of backend rollout failures.

### ADR-002: Canonical contract between all AI backends

Decision: Apps Script and Supabase both adapt to one request/response contract.

Reason: prevents backend selection leaking into UI and simplifies native clients.

### ADR-003: Optional identity linking

Decision: anonymous cloud identity is allowed; Google linking is an explicit user
action and must preserve the anonymous user id.

Reason: users can try the product without account friction while retaining a
clear path to cross-device restore.
