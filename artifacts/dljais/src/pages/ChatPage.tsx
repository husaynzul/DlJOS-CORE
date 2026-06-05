import { useState, useRef, useEffect, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import {
  useGetConversation,
  getGetConversationQueryKey,
  getListConversationsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Send, Mic, MicOff, Plus, Sparkles, Check, AudioLines, X, ChevronDown, Key, Download } from "lucide-react";
import { ActionCard } from "@/components/ActionCard";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { DlJOSLogo } from "@/components/AppLayout";
import { useDefaultModel } from "@/hooks/use-default-model";

const CHIPS = ["Post to Instagram", "Trade signals", "Run Google Ads", "Order food"];

const MODELS = [
  { id: "auto",              label: "Auto",            desc: "Best for your task",         color: "text-foreground" },
  { id: "openai",            label: "OPENAI",           desc: "GPT-4o, GPT-4o mini",        color: "text-emerald-500" },
  { id: "anthropic",         label: "ANTHROPIC",        desc: "Claude Sonnet, Haiku",        color: "text-orange-400" },
  { id: "google-gemini",     label: "GOOGLE_GEMINI",    desc: "Gemini Flash, Pro",           color: "text-blue-400" },
  { id: "deepseek",          label: "DEEPSEEK",         desc: "DeepSeek Chat, Coder",        color: "text-purple-400" },
  { id: "grokai",            label: "GROKAI",           desc: "Grok-2, Grok Vision",         color: "text-cyan-400" },
  { id: "mistral",           label: "MISTRAL",          desc: "Mistral Large, Small",        color: "text-yellow-400" },
  { id: "cohere",            label: "COHERE",           desc: "Command R+, Command R",       color: "text-rose-400" },
  { id: "elevenlabs",        label: "ELEVENLABS",       desc: "Text to Speech",              color: "text-violet-400" },
  { id: "runway",            label: "RUNWAY",           desc: "Video Generation",            color: "text-pink-400" },
  { id: "pika",              label: "PIKA",             desc: "Video Creation",              color: "text-fuchsia-400" },
  { id: "stable",            label: "STABLE",           desc: "Stable Diffusion",            color: "text-amber-400" },
];

const AI_MODES = [
  { id: "platform", label: "DlJOS AI",      desc: "Powered by DlJOS" },
  { id: "byok",     label: "Custom Model",  desc: "Use your own API" },
];

interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}
interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: Event) => void) | null;
  onend: (() => void) | null;
}
interface SpeechRecognitionCtor {
  new(): SpeechRecognitionInstance;
}
declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  }
}

interface MessageItem {
  id: number; role: "user" | "assistant"; content: string; createdAt: string; actionCardId?: number | null;
}
interface ActionCardData {
  id: number; title: string; platform: string; intent: string; status: string;
  riskLevel: string; estimatedCost?: string | null; details: string; preview?: string | null;
}

export default function ChatPage() {
  const params = useParams<{ id?: string }>();
  const conversationId = params.id ? parseInt(params.id) : null;
  const [, setLocation] = useLocation();
  const qc = useQueryClient();
  const { toast } = useToast();

  const { defaultModel, setDefaultModel } = useDefaultModel();
  const [input, setInput] = useState("");
  const [selectedModel, setSelectedModel] = useState(defaultModel);
  const [aiMode, setAiMode] = useState<"platform"|"byok">("platform");
  const [modelSheetOpen, setModelSheetOpen] = useState(false);
  const [isVoiceActive, setIsVoiceActive] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState("");
  const [localMessages, setLocalMessages] = useState<MessageItem[]>([]);
  const [localActionCards, setLocalActionCards] = useState<Map<number, ActionCardData>>(new Map());
  const [isSending, setIsSending] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const recRef = useRef<SpeechRecognitionInstance | null>(null);

  const { data: conversation, refetch } = useGetConversation(
    conversationId!,
    { query: { enabled: !!conversationId, queryKey: getGetConversationQueryKey(conversationId!) } }
  );

  useEffect(() => {
    setSelectedModel(defaultModel);
  }, [defaultModel]);

  useEffect(() => {
    if (conversation?.messages) setLocalMessages(conversation.messages as MessageItem[]);
  }, [conversation]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [localMessages, streamingText]);

  const stopVoice = useCallback(() => {
    recRef.current?.stop(); recRef.current = null; setIsVoiceActive(false); setVoiceTranscript("");
  }, []);

  const startVoice = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { toast({ title: "Voice not supported", description: "Use Chrome or Safari.", variant: "destructive" }); return; }
    const rec = new SR();
    rec.continuous = true; rec.interimResults = true; rec.lang = "en-US";
    rec.onresult = (e) => {
      let interim = ""; let final = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) final += e.results[i][0].transcript;
        else interim += e.results[i][0].transcript;
      }
      setVoiceTranscript(interim);
      if (final) { setInput((p) => (p + " " + final).trim()); setVoiceTranscript(""); }
    };
    rec.onerror = () => stopVoice();
    rec.onend = () => setIsVoiceActive(false);
    recRef.current = rec; rec.start(); setIsVoiceActive(true);
  }, [toast, stopVoice]);

  const toggleVoice = () => isVoiceActive ? stopVoice() : startVoice();

  const handleSend = async () => {
    const text = (input + " " + voiceTranscript).trim();
    if (!text || isSending) return;
    if (isVoiceActive) stopVoice();
    setInput(""); setVoiceTranscript(""); setIsSending(true); setStreamingText("");

    try {
      let convId = conversationId;
      if (!convId) {
        const r = await fetch(`${import.meta.env.BASE_URL}api/conversations`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: text.slice(0, 60) }),
        });
        convId = (await r.json()).id;
        qc.invalidateQueries({ queryKey: getListConversationsQueryKey() });
        setLocation(`/chat/${convId}`);
        await new Promise((r) => setTimeout(r, 80));
      }

      const optimisticId = Date.now();
      setLocalMessages((p) => [...p, { id: optimisticId, role: "user", content: text, createdAt: new Date().toISOString() }]);

      const modelId = selectedModel.id === "auto" ? "gpt-4o-mini" : selectedModel.id;
      const res = await fetch(`${import.meta.env.BASE_URL}api/ai/conversations/${convId}/messages`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text, model: modelId, aiMode }),
      });

      if (!res.ok || !res.body) throw new Error("Stream failed");
      const reader = res.body.getReader(); const dec = new TextDecoder(); let streamed = "";
      while (true) {
        const { done, value } = await reader.read(); if (done) break;
        for (const line of dec.decode(value, { stream: true }).split("\n")) {
          if (!line.startsWith("data: ")) continue;
          try {
            const p = JSON.parse(line.slice(6).trim());
            if (p.content) { streamed += p.content; setStreamingText(streamed); }
            if (p.done) {
              setStreamingText("");
              setLocalMessages((prev) => [...prev.filter((m) => m.id !== optimisticId), p.userMessage, p.aiMessage]);
              if (p.actionCard) setLocalActionCards((prev) => new Map(prev).set(p.aiMessage.id, p.actionCard));
              qc.invalidateQueries({ queryKey: getGetConversationQueryKey(convId!) });
              qc.invalidateQueries({ queryKey: getListConversationsQueryKey() });
            }
            if (p.error) throw new Error(p.error);
          } catch (e) { if (e instanceof SyntaxError) continue; throw e; }
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not get a response.";
      toast({ title: "Error", description: msg.slice(0, 120), variant: "destructive" });
      setInput(text); setStreamingText("");
    } finally { setIsSending(false); }
  };

  const isEmpty = !conversationId && localMessages.length === 0 && !streamingText;

  return (
    <div className="flex flex-col h-full overflow-hidden">

      <div className="flex-1 overflow-y-auto min-h-0">
        {isEmpty ? (
          <EmptyState onChipClick={(c) => { setInput(c); inputRef.current?.focus(); }} />
        ) : (
          <div className="max-w-[700px] mx-auto px-4 pt-4 pb-8 space-y-1">
            {localMessages.map((msg) => (
              <div key={msg.id}>
                <MessageBubble message={msg} />
                {msg.role === "assistant" && localActionCards.has(msg.id) && (
                  <ActionCard {...localActionCards.get(msg.id)!}
                    estimatedCost={localActionCards.get(msg.id)!.estimatedCost ?? null}
                    preview={localActionCards.get(msg.id)!.preview ?? null}
                    onUpdate={refetch}
                  />
                )}
              </div>
            ))}

            {isSending && (
              <div className="flex items-start gap-2.5 mt-3">
                <div className="w-7 h-7 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Sparkles size={13} className="text-primary" />
                </div>
                <div className="flex-1 text-[14px] text-foreground leading-[1.65] pt-1">
                  {streamingText
                    ? <span>{streamingText}<span className="inline-block w-0.5 h-4 bg-foreground ml-0.5 animate-pulse align-middle" /></span>
                    : <div className="flex gap-1.5">{[0,1,2].map(i=><div key={i} className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" style={{animationDelay:`${i*0.15}s`}}/>)}</div>
                  }
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {isVoiceActive && (
        <div className="mx-3 mb-2 px-4 py-2.5 bg-primary/8 border border-primary/20 rounded-2xl flex items-center gap-3 flex-shrink-0">
          <div className="flex items-end gap-0.5 h-5 flex-shrink-0">
            {[50,100,60,90,40].map((h, i) => (
              <div key={i} className="w-1 bg-primary rounded-full" style={{ height: `${h}%`, animation: `dljos-wave 0.8s ease-in-out ${i*0.12}s infinite alternate` }} />
            ))}
          </div>
          <p className="text-[13px] text-primary font-medium flex-1 truncate">{voiceTranscript || "Listening…"}</p>
          <button onClick={stopVoice} className="text-[11px] text-primary/70 font-medium px-2 py-1">Done</button>
        </div>
      )}

      <div className="flex-shrink-0 px-3 pt-2 pb-[max(12px,env(safe-area-inset-bottom))] bg-background border-t border-border">
        <div className="max-w-[700px] mx-auto">
          <div className="bg-card border border-border rounded-3xl shadow-sm focus-within:ring-1 focus-within:ring-ring transition-all overflow-hidden">
            <textarea
              ref={inputRef}
              value={input + (voiceTranscript ? " " + voiceTranscript : "")}
              onChange={(e) => { setInput(e.target.value); setVoiceTranscript(""); }}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              placeholder="Message DlJOS…"
              rows={1}
              readOnly={isVoiceActive}
              className="w-full resize-none bg-transparent text-[14px] text-foreground placeholder:text-muted-foreground px-4 pt-3.5 pb-2 focus:outline-none leading-relaxed"
              style={{ minHeight: 48, maxHeight: 120, overflowY: "auto" }}
              data-testid="input-message"
            />

            <div className="flex items-center justify-between px-3 pb-2.5">
              <div className="flex items-center gap-2">
                <button className="w-8 h-8 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors" data-testid="button-add">
                  <Plus size={16} />
                </button>

                <button
                  onClick={() => setModelSheetOpen(true)}
                  className="flex items-center gap-1.5 h-8 px-3 bg-muted hover:bg-accent rounded-full text-[13px] font-medium text-muted-foreground hover:text-foreground transition-colors"
                  data-testid="button-model-picker"
                >
                  <span className={selectedModel.color}>{selectedModel.label}</span>
                  <ChevronDown size={11} />
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button onClick={toggleVoice}
                  className={cn("w-8 h-8 rounded-full flex items-center justify-center transition-all",
                    isVoiceActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-accent"
                  )} data-testid="button-voice">
                  {isVoiceActive ? <MicOff size={16} /> : <Mic size={16} />}
                </button>

                <button onClick={handleSend}
                  disabled={!(input.trim() || voiceTranscript.trim()) || isSending}
                  className={cn("w-9 h-9 rounded-full flex items-center justify-center transition-all",
                    (input.trim() || voiceTranscript.trim()) && !isSending
                      ? "bg-foreground text-background" : "bg-muted text-muted-foreground cursor-not-allowed"
                  )} data-testid="button-send">
                  {isSending ? <AudioLines size={16} className="animate-pulse" /> : <Send size={15} />}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Model selector — centered popup modal ── */}
      {modelSheetOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={() => setModelSheetOpen(false)}
        >
          <div className="absolute inset-0 bg-black/50 backdrop-blur-[3px]" />
          <div
            className="relative bg-background rounded-2xl shadow-2xl w-full max-w-[360px] max-h-[80dvh] overflow-hidden flex flex-col animate-in zoom-in-95 fade-in duration-150 z-10"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3.5 border-b border-border flex-shrink-0">
              <div>
                <p className="text-[15px] font-semibold text-foreground">Select model</p>
                <p className="text-[11.5px] text-muted-foreground mt-0.5">Powered by DlJOS AI</p>
              </div>
              <button onClick={() => setModelSheetOpen(false)} className="p-1.5 rounded-xl text-muted-foreground hover:bg-accent transition-colors">
                <X size={17} />
              </button>
            </div>

            {/* AI Mode tabs */}
            <div className="px-4 pt-3 pb-2 flex-shrink-0">
              <div className="p-1 bg-muted rounded-xl flex gap-1">
                {AI_MODES.map((m) => (
                  <button key={m.id}
                    onClick={() => setAiMode(m.id as "platform"|"byok")}
                    className={cn("flex-1 py-2 rounded-lg text-[13px] font-medium transition-all",
                      aiMode === m.id ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
                    )} data-testid={`ai-mode-${m.id}`}>
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Content area */}
            <div className="overflow-y-auto flex-1">

              {/* DlJOS AI → show all 11 AI providers */}
              {aiMode === "platform" && (
                <div className="px-4 pb-4 divide-y divide-border">
                  {MODELS.map((m) => (
                    <button key={m.id}
                      onClick={() => { setSelectedModel(m); setDefaultModel(m); setModelSheetOpen(false); }}
                      className="w-full flex items-center gap-3 py-3 hover:opacity-75 transition-opacity text-left"
                      data-testid={`model-${m.id}`}
                    >
                      {m.id !== "auto" && (
                        <div className={cn("w-2 h-2 rounded-full flex-shrink-0", m.color.replace("text-", "bg-"))} />
                      )}
                      {m.id === "auto" && <div className="w-2 h-2 flex-shrink-0" />}
                      <div className="flex-1 min-w-0">
                        <p className={cn("text-[14px] font-medium", m.color)}>{m.label}</p>
                        <p className="text-[12px] text-muted-foreground mt-0.5">{m.desc}</p>
                      </div>
                      {selectedModel.id === m.id && <Check size={15} className="text-primary flex-shrink-0" />}
                    </button>
                  ))}
                </div>
              )}

              {/* Custom Model → Import API button only */}
              {aiMode === "byok" && (
                <div className="px-4 pb-6 pt-5 flex flex-col items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center">
                    <Key size={26} className="text-muted-foreground" />
                  </div>
                  <div className="text-center">
                    <p className="text-[14px] font-semibold text-foreground">Custom Model</p>
                    <p className="text-[12.5px] text-muted-foreground mt-1">Import your API keys to use your own models</p>
                  </div>
                  <button
                    onClick={() => { setModelSheetOpen(false); setLocation("/settings?tab=custom"); }}
                    className="flex items-center gap-2 px-5 py-3 bg-foreground text-background rounded-2xl text-[13.5px] font-semibold w-full justify-center hover:opacity-90 transition-opacity"
                  >
                    <Download size={15} />
                    Import API
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes dljos-wave {
          from { transform:scaleY(0.4); opacity:0.6; }
          to   { transform:scaleY(1);   opacity:1; }
        }
      `}</style>
    </div>
  );
}

function EmptyState({ onChipClick }: { onChipClick: (c: string) => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full px-4 py-12">
      <div className="mb-5">
        <DlJOSLogo size={64} className="opacity-90" />
      </div>
      <h2 className="text-[22px] font-bold text-foreground mb-1.5">What can I help with?</h2>
      <p className="text-[14px] text-muted-foreground text-center mb-8 max-w-[260px]">
        Ask me anything or pick an action below.
      </p>
      <div className="flex flex-wrap justify-center gap-2.5 max-w-[320px]">
        {CHIPS.map((c) => (
          <button key={c} onClick={() => onChipClick(c)}
            className="px-4 py-2 bg-muted hover:bg-accent border border-border rounded-full text-[13px] text-foreground font-medium transition-colors">
            {c}
          </button>
        ))}
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: MessageItem }) {
  const isUser = message.role === "user";
  return (
    <div className={cn("flex items-start gap-2.5 py-2", isUser && "justify-end")}>
      {!isUser && (
        <div className="w-7 h-7 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0 mt-0.5">
          <Sparkles size={13} className="text-primary" />
        </div>
      )}
      <div className={cn(
        "max-w-[82%] text-[14px] leading-[1.65]",
        isUser
          ? "bg-primary text-primary-foreground px-4 py-2.5 rounded-[20px] rounded-br-[6px]"
          : "text-foreground pt-1"
      )}>
        {message.content}
      </div>
    </div>
  );
}
