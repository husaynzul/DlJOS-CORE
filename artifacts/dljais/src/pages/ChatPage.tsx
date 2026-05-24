import { useState, useRef, useEffect, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import {
  useGetConversation,
  getGetConversationQueryKey,
  getListConversationsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Send, Mic, MicOff, Plus, Sparkles, Check, AudioLines, X, ChevronDown } from "lucide-react";
import { ActionCard } from "@/components/ActionCard";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { DlJOSLogo } from "@/components/AppLayout";

const CHIPS = ["Post to Instagram", "Trade signals", "Run Google Ads", "Order food"];

const MODELS = [
  { id: "auto",              label: "Auto",            desc: "Best for your task",    color: "text-foreground",  group: "DlJOS AI" },
  { id: "gemini-2.5-flash",  label: "Gemini 2.5 Flash",desc: "Google · Fastest & free", color: "text-blue-400", group: "DlJOS AI" },
  { id: "gemini-2.0-flash",  label: "Gemini 2.0 Flash",desc: "Google · Stable",      color: "text-blue-500",    group: "DlJOS AI" },
  { id: "gemini-2.5-pro",    label: "Gemini 2.5 Pro",  desc: "Google · Smartest",    color: "text-indigo-400",  group: "DlJOS AI" },
  { id: "gpt-4o",            label: "GPT-4o",          desc: "OpenAI · Best",        color: "text-emerald-500", group: "DlJOS AI" },
  { id: "gpt-4o-mini",       label: "GPT-4o mini",     desc: "OpenAI · Fast",        color: "text-emerald-400", group: "DlJOS AI" },
  { id: "claude-sonnet-4-6", label: "Claude Sonnet",   desc: "Anthropic",            color: "text-orange-400",  group: "DlJOS AI" },
];

const AI_MODES = [
  { id: "platform", label: "DlJOS AI",  desc: "Powered by DlJOS",    badge: "Platform" },
  { id: "byok",     label: "My API Key", desc: "Your provider, your bill", badge: "BYOK" },
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

  const [input, setInput] = useState("");
  const [selectedModel, setSelectedModel] = useState(MODELS[0]);
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
    if (conversation?.messages) setLocalMessages(conversation.messages as MessageItem[]);
  }, [conversation]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [localMessages, streamingText]);

  // ── Voice ──
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

  // ── Send ──
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

      {/* ── Messages area (scrollable, never overlaps composer) ── */}
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

            {/* Streaming bubble */}
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

      {/* ── Voice indicator (above composer, inside scroll boundary) ── */}
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

      {/* ── Composer (sticky bottom, never overlaps messages) ── */}
      <div className="flex-shrink-0 px-3 pt-2 pb-[max(12px,env(safe-area-inset-bottom))] bg-background border-t border-border">
        <div className="max-w-[700px] mx-auto">
          <div className="bg-card border border-border rounded-3xl shadow-sm focus-within:ring-1 focus-within:ring-ring transition-all overflow-hidden">

            {/* Textarea */}
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

            {/* Toolbar */}
            <div className="flex items-center justify-between px-3 pb-2.5">
              {/* Left: + and model pill */}
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

              {/* Right: mic + send */}
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

      {/* ── Model selector bottom sheet ── */}
      {modelSheetOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end" onClick={() => setModelSheetOpen(false)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />
          <div
            className="relative bg-background rounded-t-3xl max-h-[80dvh] overflow-y-auto animate-in slide-in-from-bottom duration-200 z-10"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 bg-muted rounded-full" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-border">
              <div>
                <p className="text-[15px] font-semibold text-foreground">Select model</p>
                <p className="text-[12px] text-muted-foreground">Powered by DlJOS AI</p>
              </div>
              <button onClick={() => setModelSheetOpen(false)} className="p-1.5 rounded-xl text-muted-foreground hover:bg-accent transition-colors">
                <X size={18} />
              </button>
            </div>

            {/* AI Mode toggle */}
            <div className="mx-4 mt-3 mb-1 p-1 bg-muted rounded-xl flex gap-1">
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

            {/* Model list */}
            <div className="px-4 pt-2 pb-6 divide-y divide-border">
              {MODELS.map((m) => (
                <button key={m.id}
                  onClick={() => { setSelectedModel(m); setModelSheetOpen(false); }}
                  className="w-full flex items-center justify-between py-3.5 hover:opacity-75 transition-opacity text-left"
                  data-testid={`model-${m.id}`}
                >
                  <div>
                    <p className={cn("text-[14px] font-medium", m.color)}>{m.label}</p>
                    <p className="text-[12px] text-muted-foreground mt-0.5">{m.desc}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-[10.5px] text-muted-foreground px-2 py-0.5 bg-muted rounded-full">{aiMode === "byok" ? "My API" : "DlJOS"}</span>
                    {selectedModel.id === m.id && <Check size={15} className="text-primary" />}
                  </div>
                </button>
              ))}
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
      <h1 className="text-[22px] font-semibold text-foreground mb-1.5 tracking-tight text-center">HusaynZul returns!</h1>
      <p className="text-[13.5px] text-muted-foreground mb-8 text-center max-w-xs leading-relaxed">
        Control your digital life — social, trading, ads, food — through conversation.
      </p>
      <div className="flex flex-wrap gap-2 justify-center max-w-xs">
        {CHIPS.map((chip) => (
          <button key={chip} onClick={() => onChipClick(chip)}
            className="px-4 py-2 bg-card border border-border rounded-2xl text-[13px] text-foreground hover:bg-accent transition-all"
            data-testid={`chip-${chip}`}>
            {chip}
          </button>
        ))}
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: MessageItem }) {
  const isUser = message.role === "user";
  return (
    <div className={cn("flex mt-3", isUser ? "justify-end" : "justify-start")}>
      {!isUser && (
        <div className="w-7 h-7 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0 mr-2.5 mt-0.5">
          <Sparkles size={13} className="text-primary" />
        </div>
      )}
      <div className={cn(
        "max-w-[82%] px-4 py-2.5 text-[14px] leading-[1.65] whitespace-pre-wrap break-words",
        isUser ? "bg-foreground text-background rounded-[20px] rounded-br-md"
               : "text-foreground rounded-[20px] rounded-bl-md"
      )}>
        {message.content}
      </div>
    </div>
  );
}
