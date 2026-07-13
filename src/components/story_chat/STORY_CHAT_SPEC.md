# Story Chat Specification

## Overview

Story Chat replaces the traditional diary writing experience with a guided conversation.

The chatbot is NOT an AI assistant.

Its only responsibility is guiding the user to tell a story naturally.

The story is later converted into language chunks for learning.

---

# Goals

Story Chat should encourage users to:

- speak naturally
- review their speech
- edit before sending
- create learning chunks

This is NOT a chatting application.

This is NOT ChatGPT.

---

# Learning Flow

Home

↓

Story Chat

↓

Summary

↓

Create Chunks

↓

Chunk Library

↓

Practice

---

# Input Modes

Story Chat supports two input modes.

## Voice (Default)

Voice is always the default mode.

Workflow

Hold Mic

↓

Speech Recognition

↓

Draft Review

↓

Send

↓

Timeline

---

## Typing

Typing is always available.

Users may switch at any time.

Typing is intended as a fallback.

---

# Draft Review

Speech recognition NEVER sends automatically.

After recognition

↓

Draft Review

↓

Delete

Edit

Send

Delete returns to Voice Mode.

---

# Summary

Summary is displayed before AI processing.

Users may

- Edit sentence

- Delete sentence

Users cannot

- Add sentence

- Reorder sentence

---

# Chatbot

Name

Sky

Gender

Neutral

No avatar

No AI

No LLM

No dynamic response.

All messages are predefined.

---

# AI

Story Chat never translates.

Story Chat never generates chunks.

Story Chat only prepares story text.

Chunk generation uses

callGenerateChunks()

from the existing project.

---

# Auto Save

Only sent messages are saved.

Draft is never saved.

---

# Resume

If Story is unfinished

↓

Resume automatically.

No new session.

---

# Idle

30s

↓

Reminder

60s

↓

Reminder

↓

Stop

---

# End Story

Users may finish by

Settings

↓

Create Chunks

or

Chatbot button

↓

Create Chunks

or

typing

"Tạo chunks"

All paths lead to Summary.

---

# Architecture

Story Chat is completely independent.

Everything belongs inside

src/components/story_chat

except shared services.

Reuse

IndexedDB

Speech

TTS

AI

Types

from existing project.