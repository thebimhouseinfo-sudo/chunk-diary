import React, { useState, useEffect, useCallback } from "react";
import Header from "./components/Header";
import Timeline from "./components/Timeline";
import VoiceInput from "./components/VoiceInput";
import DraftReview from "./components/DraftReview";
import TypingInput from "./components/TypingInput";
import SummaryView from "./components/SummaryView";
import SettingsModal from "./components/SettingsModal";
import UserProfileSetup from "../profile/UserProfileSetup";
import { MicPermissionModal } from "../MicPermissionModal";
import { ChatMessage, ChatbotWorkflow } from "./workflow/chatbotWorkflow";
import { StorySettings } from "./models/types";
import { StoryService } from "./servises/storyService";
import { useIdleTimer } from "./hooks/useIdleTimer";
import { callGenerateChunks } from "../../utils/aiService";
import { UserSettings, Chunk, MeaningUnit } from "../../types";
import { getSettings } from "../../db/userDb";
import { speakText } from "../../utils/tts";
import { Sparkles, MessageSquare, History, BookOpen, Volume2, Play, ArrowRight } from "lucide-react";

async function getDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("LanguageChunkDiaryDB");
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function addDiary(diary: any): Promise<string> {
  const db = await getDb();
  
  // Fetch all diaries to check if one exists on the same local calendar day
  const diaries: any[] = await new Promise((resolve, reject) => {
    const tx = db.transaction("diaries", "readonly");
    const store = tx.objectStore("diaries");
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

  const now = new Date();
  const existingTodayDiary = diaries.find(d => {
    const dDate = new Date(d.createdAt);
    return (
      dDate.getFullYear() === now.getFullYear() &&
      dDate.getMonth() === now.getMonth() &&
      dDate.getDate() === now.getDate()
    );
  });

  const formattedDate = now.toLocaleDateString("vi-VN");

  if (existingTodayDiary) {
    // Merge contents
    existingTodayDiary.content = existingTodayDiary.content + "\n\n" + diary.content;
    existingTodayDiary.title = "Nhật ký ngày " + formattedDate;
    
    return new Promise((resolve, reject) => {
      const tx = db.transaction("diaries", "readwrite");
      const store = tx.objectStore("diaries");
      const req = store.put(existingTodayDiary);
      req.onsuccess = () => resolve(existingTodayDiary.id);
      req.onerror = () => reject(req.error);
    });
  } else {
    // Create new diary card for today
    diary.title = "Nhật ký ngày " + formattedDate;
    return new Promise((resolve, reject) => {
      const tx = db.transaction("diaries", "readwrite");
      const store = tx.objectStore("diaries");
      if (!diary.id) diary.id = crypto.randomUUID();
      const req = store.put(diary);
      req.onsuccess = () => resolve(diary.id);
      req.onerror = () => reject(req.error);
    });
  }
}

interface StoryChatViewProps {
  onBack: () => void;
  onNavigate: (tab: string) => void;
  onStartPractice?: (chunks: any[]) => void;
}

export default function StoryChatView({ onBack, onNavigate, onStartPractice }: StoryChatViewProps) {
  const [hasProfile, setHasProfile] = useState<boolean | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [inputMode, setInputMode] = useState<"voice" | "typing">("voice");
  const [isSummaryView, setIsSummaryView] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isIdleStopped, setIsIdleStopped] = useState(false);
  
  // Onboarding Modal State
  const [showOnboarding, setShowOnboarding] = useState(false);
  
  // Mic Permission Modal State
  const [showMicPermissionModal, setShowMicPermissionModal] = useState(false);
  const [micErrorType, setMicErrorType] = useState<'denied' | 'not_found' | 'other'>('denied');

  const [settings, setSettings] = useState<StorySettings>({
    theme: "system",
    defaultInputMode: "voice"
  });

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draftText, setDraftText] = useState("");
  const [isReviewMode, setIsReviewMode] = useState(false);
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [hasRecommended, setHasRecommended] = useState(false);
  const [generatedChunks, setGeneratedChunks] = useState<Chunk[] | null>(null);
  const [userProfile, setUserProfile] = useState<UserSettings | null>(null);



  const initSession = async () => {
    // Ensure summary view is off by default when initializing a new session or after onboarding
    setIsSummaryView(false);

    const savedSettings = localStorage.getItem("story_chat_settings");
    if (savedSettings) {
      const parsed = JSON.parse(savedSettings);
      setSettings(parsed);
      setInputMode(parsed.defaultInputMode || "voice");
    }

    const userProfileData = await getSettings();
    setUserProfile(userProfileData);

    const isFirstTimeSeen = localStorage.getItem("story_chat_has_seen_first_greeting") === "true";
    const isFirstTime = !isFirstTimeSeen;

    const active = await StoryService.getActiveSession();
    if (active) {
      const restoredUserMsgs = active.messages.filter(m => m.sender === "user");
      if (restoredUserMsgs.length > 0) {
        const rebuiltMsgs: ChatMessage[] = [{
          id: "msg-greet-init",
          sender: "bot",
          text: ChatbotWorkflow.getGreeting(userProfileData, false),
          createdAt: active.createdAt
        }];

        restoredUserMsgs.forEach((userMsg, idx) => {
          rebuiltMsgs.push(userMsg);
          const userMsgCountSoFar = idx + 1;
          const randomSuffix = Math.random().toString(36).substring(2, 9);
          if (userMsgCountSoFar >= 50) {
            rebuiltMsgs.push({
              id: `msg-rec-${idx}-${Date.now()}-${randomSuffix}`,
              sender: "bot",
              text: ChatbotWorkflow.getRecommendation(),
              createdAt: userMsg.createdAt
            });
          } else {
            rebuiltMsgs.push({
              id: `msg-enc-${idx}-${Date.now()}-${randomSuffix}`,
              sender: "bot",
              text: ChatbotWorkflow.getEncouragement(),
              createdAt: userMsg.createdAt
            });
          }
        });
        setMessages(rebuiltMsgs);
      } else {
        const firstGreeting: ChatMessage = {
          id: "msg-greet-" + Date.now() + "-" + Math.random().toString(36).substring(2, 9),
          sender: "bot",
          text: ChatbotWorkflow.getGreeting(userProfileData, isFirstTime),
          createdAt: new Date().toISOString()
        };
        setMessages([firstGreeting]);
        if (isFirstTime) {
          localStorage.setItem("story_chat_has_seen_first_greeting", "true");
        }
      }

    } else {
      const firstGreeting: ChatMessage = {
        id: "msg-greet-" + Date.now() + "-" + Math.random().toString(36).substring(2, 9),
        sender: "bot",
        text: ChatbotWorkflow.getGreeting(userProfileData, isFirstTime),
        createdAt: new Date().toISOString()
      };
      setMessages([firstGreeting]);
      if (isFirstTime) {
        localStorage.setItem("story_chat_has_seen_first_greeting", "true");
      }
      await StoryService.saveSession({
        id: "active",
        status: "unfinished",
        messages: [firstGreeting],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }
  };

  useEffect(() => {
    const initializeApp = async () => {
      if (isInitialized) return;
      
      try {
        const parsed = await getSettings();
        if (parsed && parsed.onboarded) {
          setHasProfile(true);
          await initSession();
        } else {
          setShowOnboarding(true);
        }
      } catch (err) {
        console.warn("Could not load setting context, defaulting to onboarding", err);
        setShowOnboarding(true);
      }
      setIsInitialized(true);
    };

    initializeApp();
  }, [isInitialized]);

  const handleOnboardingCompleted = (updatedSettings: UserSettings) => {
    setShowOnboarding(false);
    setHasProfile(true);
    setIsSummaryView(false); // Ensure summary view is off after onboarding
    initSession();
  };

  // Request mic permission handler - called after profile creation or when user first clicks mic
  const requestMicPermission = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Stop the stream immediately after getting permission
      stream.getTracks().forEach(track => track.stop());
      // Permission granted, no need to show modal
      setShowMicPermissionModal(false);
    } catch (err: any) {
      console.error("Mic permission error:", err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setMicErrorType('denied');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setMicErrorType('not_found');
      } else {
        setMicErrorType('other');
      }
      setShowMicPermissionModal(true);
    }
  }, []);

  const handleUpdateSettings = (newSettings: Partial<StorySettings>) => {
    const updated = { ...settings, ...newSettings };
    setSettings(updated);
    localStorage.setItem("story_chat_settings", JSON.stringify(updated));
    if (newSettings.defaultInputMode) {
      setInputMode(newSettings.defaultInputMode);
    }
  };

  const handle30sReminder = useCallback(() => {
    if (isSummaryView || isReviewMode || isIdleStopped) return;
    const botMsg: ChatMessage = {
      id: "msg-reminder-30-" + Date.now() + "-" + Math.random().toString(36).substring(2, 9),
      sender: "bot",
      text: ChatbotWorkflow.get30sReminder(),
      createdAt: new Date().toISOString()
    };
    setMessages((prev) => [...prev, botMsg]);
  }, [isSummaryView, isReviewMode, isIdleStopped]);

  const handle60sReminder = useCallback(() => {
    if (isSummaryView || isReviewMode || isIdleStopped) return;
    const botMsg: ChatMessage = {
      id: "msg-reminder-60-" + Date.now() + "-" + Math.random().toString(36).substring(2, 9),
      sender: "bot",
      text: ChatbotWorkflow.get60sReminder(),
      createdAt: new Date().toISOString()
    };
    setMessages((prev) => [...prev, botMsg]);
  }, [isSummaryView, isReviewMode, isIdleStopped]);

  const handleStopIdle = useCallback(() => {
    setIsIdleStopped(true);
  }, []);

  const { resetTimers, clearTimers } = useIdleTimer({
    on30sReminder: handle30sReminder,
    on60sReminder: handle60sReminder,
    onStop: handleStopIdle,
    isActive: !isSummaryView && !isReviewMode && !isIdleStopped && messages.length > 0
  });

  const saveSessionProgress = async (updatedMessages: ChatMessage[]) => {
    const userMessagesOnly = updatedMessages.filter(m => m.sender === "user");
    await StoryService.saveSession({
      id: "active",
      status: "unfinished",
      messages: userMessagesOnly,
      createdAt: updatedMessages[0]?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  };

  const handleTranscriptionStart = () => {
    clearTimers();
  };

  const handleTranscriptionEnd = (text: string) => {
    if (text) {
      setDraftText(text);
      setIsReviewMode(true);
    } else {
      resetTimers();
    }
  };

  const handleDeleteDraft = () => {
    setDraftText("");
    setIsReviewMode(false);
    resetTimers();
  };

  const handleSendDraft = async (text: string) => {
    const randomSuffix = () => Math.random().toString(36).substring(2, 9);
    const userMsg: ChatMessage = {
      id: "msg-user-" + Date.now() + "-" + randomSuffix(),
      sender: "user",
      text: text,
      createdAt: new Date().toISOString()
    };

    const updatedMessages = [...messages, userMsg];
    const userMsgCount = updatedMessages.filter(m => m.sender === "user").length;

    const sentenceCount = text.split(/[.!?]+/).filter(s => s.trim().length > 0).length;
    const isTooLong = sentenceCount >= 3;

    if (isTooLong) {
      const warningMsg: ChatMessage = {
        id: "msg-warn-" + Date.now() + "-" + randomSuffix(),
        sender: "bot",
        text: ChatbotWorkflow.getTooLongWarning(),
        createdAt: new Date().toISOString()
      };
      updatedMessages.push(warningMsg);
    } else if (userMsgCount >= 50 && !hasRecommended) {
      const recMsg: ChatMessage = {
        id: "msg-rec-" + Date.now() + "-" + randomSuffix(),
        sender: "bot",
        text: ChatbotWorkflow.getRecommendation(),
        createdAt: new Date().toISOString()
      };
      updatedMessages.push(recMsg);
      setHasRecommended(true);
    } else {
      const encMsg: ChatMessage = {
        id: "msg-enc-" + Date.now() + "-" + randomSuffix(),
        sender: "bot",
        text: ChatbotWorkflow.getEncouragement(),
        createdAt: new Date().toISOString()
      };
      updatedMessages.push(encMsg);
    }

    setMessages(updatedMessages);
    setIsReviewMode(false);
    setDraftText("");
    await saveSessionProgress(updatedMessages);
    resetTimers();
  };

  const handleEndStory = async () => {
    const userMessages = messages.filter((m) => m.sender === "user");
    if (userMessages.length === 0) {
      alert("Bạn chưa nói câu nào. Hãy kể câu chuyện của bạn trước khi kết thúc nhé!");
      return;
    }
    setIsSummaryView(true);
    const active = await StoryService.getActiveSession();
    if (active) {
      await StoryService.saveSession({
        ...active,
        summary: "true"
      });
    }
  };

  const getSentences = () => {
    return messages
      .filter((m) => m.sender === "user")
      .map((m) => m.text);
  };

  const handleUpdateSentence = async (index: number, newText: string) => {
    const userMessages = messages.filter((m) => m.sender === "user");
    const targetUserMsg = userMessages[index];
    if (targetUserMsg) {
      const updatedMessages = messages.map((m) =>
        m.id === targetUserMsg.id ? { ...m, text: newText } : m
      );
      setMessages(updatedMessages);
      await saveSessionProgress(updatedMessages);
    }
  };

  const handleDeleteSentence = async (index: number) => {
    const userMessages = messages.filter((m) => m.sender === "user");
    const targetUserMsg = userMessages[index];
    if (targetUserMsg) {
      const updatedMessages = messages.filter((m) => m.id !== targetUserMsg.id);
      setMessages(updatedMessages);
      await saveSessionProgress(updatedMessages);
    }
  };

  const handleCreateChunks = async () => {
    const sentences = getSentences();
    if (sentences.length === 0) {
      alert("Không có nội dung câu chuyện để tạo chunks!");
      return;
    }

    setIsGenerating(true);
    const diaryContent = sentences.join("\n");

    try {
      const db = await getDb();
      let userSettings = {
        nativeLanguage: "vi",
        learningLanguages: ["en"],
        cefrLevel: "A2",
        profileContext: "General topic"
      };
      
      try {
        const currentSettings = await getSettings();
        if (currentSettings) {
          userSettings = {
            nativeLanguage: currentSettings.nativeLanguage || "vi",
            learningLanguages: currentSettings.learningLanguages || ["en"],
            cefrLevel: currentSettings.cefrLevel || "A2",
            profileContext: currentSettings.learningPurpose === "work" ? (currentSettings.specialty || "General study") : "General study"
          };
        }
      } catch (e) {
        console.warn("Could not load setting context, using defaults", e);
      }

      const apiResponse = await callGenerateChunks({
        diaryContent,
        nativeLanguage: userSettings.nativeLanguage,
        targetLanguage: userSettings.learningLanguages[0] || "en",
        cefrLevel: userSettings.cefrLevel,
        profileContext: userSettings.profileContext,
        existingSemanticGroups: []
      });

      const savedDiaryId = await addDiary({
        content: diaryContent,
        createdAt: new Date().toISOString()
      });

      // Saving chunks logic
      const txMU = db.transaction(["meaningUnits", "chunks"], "readwrite");
      const storeMU = txMU.objectStore("meaningUnits");
      const storeChunks = txMU.objectStore("chunks");

      const createdChunksList: Chunk[] = [];

      if (apiResponse && apiResponse.semanticUnits) {
        for (const unit of apiResponse.semanticUnits) {
          const muId = await new Promise<string>((resolve, reject) => {
            const req = storeMU.add({
              id: crypto.randomUUID(),
              diaryId: savedDiaryId,
              nativeText: unit.nativeText,
              englishPivot: unit.englishText,
              order: unit.order
            });
            req.onsuccess = () => resolve(req.result as string);
            req.onerror = () => reject(req.error);
          });

          const allChunks = [...unit.commonChunks, ...unit.personalizedChunks];
          for (const rawChunk of allChunks) {
            const newChunk: Chunk = {
              id: crypto.randomUUID(),
              meaningUnitId: muId,
              language: userSettings.learningLanguages[0] || "en",
              text: rawChunk.text,
              meaning: rawChunk.english,
              ipa: rawChunk.ipa || "",
              romanization: rawChunk.romanization || "",
              chunkType: unit.commonChunks.includes(rawChunk as any) ? "common" : "personalized",
              stars: 0,
              bestAccuracy: 0,
              timesPracticed: 0,
              lastPracticed: "",
              totalReviews: 0,
              averageRating: 0,
              lastRating: 0,
              lastReviewed: "",
              sourceDiaryId: savedDiaryId,
              sourceDiaryTitle: "Nhật ký ngày " + new Date().toLocaleDateString("vi-VN")
            };
            
            await new Promise<void>((resolve, reject) => {
              const req = storeChunks.add(newChunk);
              req.onsuccess = () => {
                createdChunksList.push(newChunk);
                resolve();
              };
              req.onerror = () => reject(req.error);
            });
          }
        }
      }

      await StoryService.clearActiveSession();
      setGeneratedChunks(createdChunksList);
    } catch (e) {
      console.error(e);
      alert("Đã xảy ra lỗi khi phân tích và bóc tách chunks. Vui lòng thử lại!");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="flex flex-col h-[78vh] sm:h-[80vh] md:h-[81vh] lg:h-[83vh] w-full bg-white rounded-[2rem] border border-slate-150/80 shadow-md overflow-hidden relative transition-all chat-container-fixed">
      <UserProfileSetup show={showOnboarding} onCompleted={handleOnboardingCompleted} onRequestMicPermission={requestMicPermission} />

      {/* Mic Permission Modal */}
      {showMicPermissionModal && (
        <MicPermissionModal 
          onClose={() => setShowMicPermissionModal(false)} 
          errorType={micErrorType} 
        />
      )}

      <div className="chat-header-spacer">
        <Header
          onBack={onBack}
          onEnd={handleEndStory}
          onOpenSettings={() => setShowSettings(true)}
          isSummaryView={isSummaryView || !!generatedChunks}
          isReviewMode={isReviewMode}
          isEmpty={messages.filter((m) => m.sender === "user").length === 0}
          inputMode={inputMode}
          onToggleInputMode={() => setInputMode(prev => prev === "voice" ? "typing" : "voice")}
        />
      </div>

      <div className="flex-1 overflow-hidden flex flex-col bg-slate-50/40 relative">
        {generatedChunks ? (
          <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-6 max-w-2xl w-full mx-auto animate-pageFadeIn text-left">
            {/* Celebration Hero Header Card */}
            <div className="bg-white p-6 sm:p-8 rounded-[2rem] border border-slate-150/80 shadow-xs space-y-4">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-vibrant-mint/20 text-vibrant-indigo rounded-full text-xs font-black uppercase tracking-wider">
                <Sparkles size={12} className="animate-spin-slow text-vibrant-coral" />
                Thành công!
              </div>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight leading-none">Hệ thống đã hoàn tất bóc tách Chunks tự học</h2>
              <p className="text-slate-500 text-sm font-medium leading-relaxed">
                Câu chuyện của bạn đã được bóc tách và chuyển đổi thành <strong className="text-vibrant-indigo font-black">{generatedChunks.length} chunks</strong> luyện phát âm tự nhiên. Hãy bắt đầu luyện nói ngay để cải thiện phản xạ và phát âm chuẩn bản xứ!
              </p>
            </div>

            {/* Chunks List */}
            <div className="space-y-4">
              <div className="flex items-center justify-between px-2 pt-2">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <Sparkles size={14} className="text-vibrant-indigo" />
                  Danh sách Chunks gợi ý ({generatedChunks.length})
                </h3>
              </div>

              {generatedChunks.map((chunk) => (
                <div 
                  key={chunk.id} 
                  className="bg-white rounded-2xl border border-slate-150 p-5 flex items-center justify-between hover:border-vibrant-indigo/30 hover:shadow-md hover:scale-[1.01] active:scale-100 transition-all duration-200"
                >
                  <div className="space-y-2 pr-4 flex-1">
                    <div className="flex items-center flex-wrap gap-2">
                      <span className={`font-black text-[9px] uppercase px-2.5 py-0.5 rounded-lg border ${
                        chunk.chunkType === "common" 
                          ? "bg-vibrant-indigo/10 text-vibrant-indigo border-vibrant-indigo/20" 
                          : "bg-vibrant-coral/10 text-vibrant-coral border-vibrant-coral/20"
                      }`}>
                        {chunk.chunkType === "common" ? "Phổ biến" : "Cá nhân hóa"}
                      </span>
                      {chunk.ipa && (
                        <span className="text-[11px] text-slate-400 font-mono bg-slate-100/60 px-2 py-0.5 rounded-md border border-slate-150/40">
                          /{chunk.ipa}/
                        </span>
                      )}
                    </div>
                    <h4 className="font-display font-black text-slate-900 text-base leading-tight">
                      {chunk.text}
                    </h4>
                    <p className="text-xs text-slate-500 font-bold">
                      {chunk.meaning}
                    </p>
                  </div>
                  <button
                    onClick={() => speakText(chunk.text, chunk.language)}
                    className="p-3 bg-slate-50 hover:bg-vibrant-indigo/10 text-slate-500 hover:text-vibrant-indigo rounded-xl transition-all active:scale-95 cursor-pointer border-none flex items-center justify-center shrink-0"
                    title="Phát âm thử"
                  >
                    <Volume2 size={18} />
                  </button>
                </div>
              ))}
            </div>

            {/* Bottom Actions Row */}
            <div className="pt-6 flex flex-col sm:flex-row gap-4">
              <button
                onClick={() => {
                  setGeneratedChunks(null);
                  setMessages([]);
                  setIsSummaryView(false);
                  setDraftText("");
                  setIsReviewMode(false);
                  onNavigate("chunks");
                }}
                className="flex-1 py-4 bg-slate-100 hover:bg-slate-200/80 text-slate-700 rounded-2xl text-xs font-black uppercase tracking-widest transition-all cursor-pointer text-center border-none"
              >
                Về thư viện Chunks
              </button>
              {onStartPractice && (
                <button
                  onClick={() => {
                    const playlist = [...generatedChunks];
                    setGeneratedChunks(null);
                    setMessages([]);
                    setIsSummaryView(false);
                    setDraftText("");
                    setIsReviewMode(false);
                    onStartPractice(playlist);
                  }}
                  className="flex-1 py-4 bg-gradient-to-r from-vibrant-coral to-vibrant-coral/95 hover:from-vibrant-coral/95 hover:to-vibrant-coral text-white rounded-2xl text-xs font-black uppercase tracking-widest transition-all shadow-lg shadow-vibrant-coral/20 hover:shadow-xl hover:shadow-vibrant-coral/25 hover:scale-[1.02] active:scale-100 cursor-pointer text-center border-none flex items-center justify-center gap-2"
                >
                  <Play size={14} className="fill-current" />
                  Luyện tập ngay ({generatedChunks.length} câu)
                  <ArrowRight size={14} />
                </button>
              )}
            </div>
          </div>
        ) : isSummaryView ? (
          <SummaryView
            sentences={getSentences()}
            isGenerating={isGenerating}
            onCreateChunks={handleCreateChunks}
            onUpdateSentence={handleUpdateSentence}
            onDeleteSentence={handleDeleteSentence}
          />
        ) : (
          <Timeline messages={messages} nickname={userProfile?.nickname} />
        )}
      </div>

      {!isSummaryView && !generatedChunks && (
        <div className="mic-input-container p-2 sm:p-3 bg-white border-t border-slate-100 shrink-0">
          {isReviewMode ? (
            <DraftReview
              draftText={draftText}
              onChange={setDraftText}
              onDelete={handleDeleteDraft}
              onSend={handleSendDraft}
            />
          ) : inputMode === "voice" ? (
            <VoiceInput
              onTranscriptionStart={handleTranscriptionStart}
              onTranscriptionEnd={handleTranscriptionEnd}
              onSwitchMode={() => setInputMode("typing")}
            />
          ) : (
            <TypingInput
              onSend={handleSendDraft}
              onSwitchMode={() => setInputMode("voice")}
            />
          )}
        </div>
      )}

      {showSettings && (
        <SettingsModal
          settings={settings}
          onClose={() => setShowSettings(false)}
          onUpdateSettings={handleUpdateSettings}
          onEndStory={handleEndStory}
        />
      )}
    </div>
  );
}
