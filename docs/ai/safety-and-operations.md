# AI Safety And Operations

## 1. Privacy Defaults

- Diary text is sensitive personal content.
- Store it locally by default during beta.
- Do not put raw diary text in analytics, logs, error reports, or browser
  fingerprint records.
- Cloud storage of raw stories requires explicit product consent and a retention
  policy.
- Generated chunks and progress should be separated from raw diary storage so
  users can sync learning data without syncing the original story.

## 2. Secret Handling

- Gemini/provider keys live only in Apps Script or the Supabase Edge Function
  secret store.
- Publishable Supabase keys may be present in the client; service-role keys must
  never be shipped there.
- Native app binaries are not secret containers.
- Do not accept arbitrary provider keys or model names from public clients in the
  production gateway.

## 3. Abuse And Cost Controls

Even a small beta can be abused when an endpoint is public. Add:

- Maximum diary characters and semantic-group count.
- Per-anonymous-user generation quota.
- Per-linked-user quota.
- Rate limiting by IP as a secondary signal.
- Maximum model output tokens.
- Request timeout and concurrency limit.
- Clear `RATE_LIMITED` and `PAYLOAD_TOO_LARGE` errors.

Browser fingerprints are not reliable identity and must not replace auth.

## 4. Observability

Record only operational metadata:

- request id
- backend and model version
- contract and prompt version
- success/failure code
- latency
- input/output token counts when available
- chunk count
- retry count

Do not record diary content, full prompts, access tokens, or provider error dumps.

Suggested beta metrics:

- generation success rate
- validation rejection rate
- median and p95 latency
- fallback rate from Supabase to Apps Script
- average chunks per semantic unit
- user retry rate
- sync success and restore success rate

## 5. Quality Evaluation

Maintain a small consented, anonymized evaluation set covering:

- short and long diaries
- hobby and work profiles
- each supported target language
- different CEFR levels
- empty/ambiguous input
- non-Latin scripts

Review:

- translation naturalness
- semantic-unit boundaries
- chunk usefulness
- meaning correctness
- IPA/romanization validity
- semantic-group reuse accuracy
- harmful or invented personalization

Prompt or model changes should be evaluated against the previous version before
being enabled for all users.

## 6. Failure Policy

- Invalid model output: reject and allow retry; do not partially persist.
- Provider timeout: keep the local story and offer retry or backend fallback.
- Quota exceeded: explain that generation is temporarily unavailable.
- Cloud sync failure: keep local data and mark it pending/failed.
- Auth failure: keep local mode available and ask the user to relink only when a
  cloud operation is requested.
- TTS/STT failure: provide typing input and system voice fallback where possible.

## 7. Account Linking Risks

Google linking must be tested for:

- anonymous session with existing data
- interrupted OAuth callback
- already-linked Google identity
- account switching on the same device
- restoring on a second device
- anonymous account cleanup policy

The critical invariant is: linking must upgrade the existing anonymous identity,
not create a new identity and strand the user's data.

## 8. Release Gates

Do not promote Supabase generation beyond internal beta until:

- contract compatibility is verified;
- RLS ownership tests pass;
- provider keys are confirmed server-side only;
- quota and payload limits are active;
- local fallback works;
- Google linking preserves data;
- privacy text and consent behavior are approved;
- rollback can be completed through configuration.
