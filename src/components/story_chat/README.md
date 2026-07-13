# Story Chat Module

This module implements a voice-first guided conversation experience that replaces the traditional diary writing view. It guides users to tell their stories naturally and prepare sentences for language chunk generation.

## Folder Structure

- `StoryChatView.tsx`: Main screen container coordinating the flow.
- `components/`: Pure visual and layout components (Header, Timeline, Footer/Controls, Summary).
- `hooks/`: Reusable hooks for state management, voice recording (Web Speech API integration), and idle timer.
- `workflow/`: Predefined chatbot messages and state flow engine.
- `models/`: Models/Interfaces representing stories, messages, and settings.
- `services/`: Local persistence (IndexedDB integrations) for story-chat sessions.

## Architecture

```
StoryChatView
   │
   ├─► Header
   ├─► Timeline
   ├─► Input (Voice/Typing Switch)
   ├─► Summary View
   └─► Create Chunks
```
