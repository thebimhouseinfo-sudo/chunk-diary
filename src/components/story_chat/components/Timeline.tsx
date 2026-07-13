import React, { useEffect, useRef } from "react";
import { ChatMessage } from "../workflow/chatbotWorkflow";
import { Sparkles, User, MessageCircle } from "lucide-react";

interface TimelineProps {
  messages: ChatMessage[];
  nickname?: string;
}

function renderTextWithHighlightedNickname(text: string, nickname: string | undefined) {
  if (!nickname || !nickname.trim()) {
    return text;
  }

  const escapedNickname = nickname.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
  const regex = new RegExp(`(${escapedNickname})`, 'gi');
  const parts = text.split(regex);

  return (
    <>
      {parts.map((part, index) =>
        regex.test(part) ? (
          <span key={index} className="text-rose-600 font-extrabold">
            {part}
          </span>
        ) : (
          <React.Fragment key={index}>{part}</React.Fragment>
        )
      )}
    </>
  );
}

export default function Timeline({ messages, nickname }: TimelineProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-y-auto px-6 py-8 space-y-6 scroll-smooth"
    >
      {messages.map((msg) => {
        const isBot = msg.sender === "bot";
        return (
          <div
            key={msg.id}
            className={`flex items-end gap-3 max-w-[85%] sm:max-w-[75%] ${
              isBot ? "mr-auto text-left" : "ml-auto flex-row-reverse text-right"
            } animate-pageFadeIn`}
          >
            {/* Avatar */}
            <div
              className={`w-9 h-9 rounded-2xl flex items-center justify-center shrink-0 shadow-sm ${
                isBot
                  ? "bg-vibrant-mint/20 text-vibrant-indigo border border-vibrant-mint/30"
                  : "bg-vibrant-coral/20 text-vibrant-coral border border-vibrant-coral/30"
              }`}
            >
              {isBot ? <MessageCircle size={16} /> : <User size={16} />}
            </div>

            {/* Bubble Container */}
            <div className="space-y-1">
              <div
                className={`px-5 py-3.5 rounded-[1.5rem] text-sm leading-relaxed font-medium shadow-sm border ${
                  isBot
                    ? "bg-white text-slate-800 border-slate-100 rounded-bl-none"
                    : "bg-vibrant-indigo text-white border-vibrant-indigo/10 rounded-br-none"
                }`}
              >
                {/* Highlight bot's questions/guidelines cleanly */}
                {isBot && msg.text.includes("?") ? (
                  <div className="space-y-2">
                    <div className="text-slate-800 font-semibold flex items-start gap-1.5">
                      <Sparkles size={14} className="text-vibrant-coral shrink-0 mt-1" />
                      <div className="whitespace-pre-wrap">{renderTextWithHighlightedNickname(msg.text, nickname)}</div>
                    </div>
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap">{renderTextWithHighlightedNickname(msg.text, nickname)}</p>
                )}
              </div>
              <div className="text-[10px] text-slate-400 px-1 font-semibold tracking-tight">
                {new Date(msg.createdAt).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit"
                })}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
