# AI Documentation

This directory describes the AI architecture and the migration from the current
Google Apps Script backend to an optional cloud backend.

## Documents

- [AI system design](./system-design.md): boundaries, data flow, provider strategy,
  and client/mobile responsibilities.
- [AI API contract](./api-contract.md): the canonical request/response contract
  and compatibility rules for Apps Script, Supabase, and future providers.
- [Implementation plan](./implementation-plan.md): staged work plan for the beta,
  cloud sync, account linking, and native mobile phase.
- [Safety and operations](./safety-and-operations.md): privacy, abuse controls,
  observability, quality evaluation, and rollout gates.

## Current Product Context

- The beta is local-first and has a small number of users.
- IndexedDB is the current source of truth on the client.
- Google Apps Script is the current production AI backend.
- Cloud persistence is optional and is being introduced incrementally.
- Users may link a Google account later to preserve and sync their data.
- A future native mobile client is expected to provide more reliable speech input
  and better platform TTS than the browser APIs.

## Design Principles

1. Keep the existing beta working while introducing the new backend.
2. Keep provider-specific details behind an AI gateway/adapter.
3. Treat model output as untrusted input and validate it before local persistence.
4. Keep raw diary text local by default until explicit product consent exists.
5. Do not make native speech or TTS assumptions that are not guaranteed by the
   target platform and installed voices.
