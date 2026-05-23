import { useState, useRef, useEffect, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import {
  useGetConversation,
  getGetConversationQueryKey,
  getListConversationsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Send, Mic, MicOff, Plus, Sparkles, ChevronDown, Check, AudioLines } from "lucide-react";
import { ActionCard } from "@/components/ActionCard";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

const SUGGESTION_CHIPS = [
  "Post to Instagram",
  "Trade signals",
  "Run Google Ads",
  "Order food",
];

const MODELS = [
  // OpenAI
  { id: "gpt-4o",        label: "GPT-4o",       desc: "OpenAI · Best",     color: "text-emerald-500", group: "OpenAI" },
  { id: "gpt-4o-mini",   label: "GPT-4o mini",  desc: "OpenAI · Fast",     color: "text-emerald-400", group: "OpenAI" },
  // Google Gemini
  { id: "gemini-2.0-flash-exp", label: "Gemini Flash", desc: "Google · Fastest", color: "text-blue-400", group: "Google" },
  { id: "gemini-1.5-pro",       label: "Gemini Pro",   desc: "Google · Smart",   color: "text-blue-500", group: "Google" },
  // Anthropic Claude
  { id: "claude-sonnet-4-6", label: "Claude Sonnet", desc: "Anthropic",     color: "text-orange-400", group: "Anthropic" },
  { id: "claude-haiku-4-5",  label: "Claude Haiku",  desc: "Anthropic · Fast", color: "text-orange-300", group: "Anthropic" },
];

interface MessageItem {
  id: number;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  actionCardId?: number | null;
}

interface ActionCardData {
  id: number; title: string; platform: string; intent: string;
  status: string; riskLevel: string; estimatedCost?: string | null;
  details: string; preview?: string | null;
}

// Web Speech API types
declare global {
  interface Window {
    SpeechRecognition: typeof SpeechRecognition;
    webkitSpeechRecognition: typeof SpeechRecognition;
  }
}

export default function ChatPage() {
  const params = useParams<{ id?: string }>();
  const conversationId = params.id ? parseInt(params.id) : null;
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [input, setInput] = useState("");
  const [selectedModel, setSelectedModel] = useState(MODELS[0]);
  const [modelPickerOpen, setModelPickerOpen] = useState(false);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [isVoiceActive, setIsVoiceActive] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState("");
  const [localMessages, setLocalMessages] = useState<MessageItem[]>([]);
  const [localActionCards, setLocalActionCards] = useState<Map<number, ActionCardData>>(new Map());
  const [isSending, setIsSending] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

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

  // Voice recognition setup
  const startVoice = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast({ title: "Voice not supported", description: "Use Chrome or Safari for voice input.", variant: "destructive" });
      return;
    }
    const rec = new SpeechRecognition();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-US";

    rec.onresult = (e) => {
      let interim = "";
      let final = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) final += t;
        else interim += t;
      }
      setVoiceTranscript(interim);
      if (final) {
        setInput((prev) => (prev + " " + final).trim());
        setVoiceTranscript("");
      }
    };

    rec.onerror = () => stopVoice();
    rec.onend = () => setIsVoiceActive(false);

    recognitionRef.current = rec;
    rec.start();
    setIsVoiceActive(true);
  }, [toast]);

  const stopVoice = useCallback(() => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setIsVoiceActive(false);
    setVoiceTranscript("");
  }, []);

  const toggleVoice = () => {
    if (isVoiceActive) stopVoice();
    else startVoice();
  };

  const createConversation = async (title: string): Promise<number> => {
    const res = await fetch(`${import.meta.env.BASE_URL}api/conversations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: title.slice(0, 60) }),
    });
    return (await res.json()).id;
  };

  const handleSend = async () => {
    const text = (input + " " + voiceTranscript).trim();
    if (!text || isSending) return;

    if (isVoiceActive) stopVoice();
    setInput("");
    setVoiceTranscript("");
    setIsSending(true);
    setStreamingText("");

    try {
      let convId = conversationId;
      if (!convId) {
        convId = await createConversation(text);
        queryClient.invalidateQueries({ queryKey: getListConversationsQueryKey() });
        setLocation(`/chat/${convId}`);
        await new Promise((r) => setTimeout(r, 80));
      }

      const optimisticId = Date.now();
      setLocalMessages((prev) => [...prev, {
        id: optimisticId, role: "user", content: text, createdAt: new Date().toISOString(),
      }]);

      const response = await fetch(
        `${import.meta.env.BASE_URL}api/ai/conversations/${convId}/messages`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content: text, model: selectedModel.id }) }
      );

      if (!response.ok || !response.body) throw new Error("Stream failed");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let streamed = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const lines = decoder.decode(value, { stream: true }).split("\n");
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const parsed = JSON.parse(line.slice(6).trim());
            if (parsed.content) { streamed += parsed.content; setStreamingText(streamed); }
            if (parsed.done) {
              setStreamingText("");
              setLocalMessages((prev) => {
                const without = prev.filter((m) => m.id !== optimisticId);
                return [...without, parsed.userMessage, parsed.aiMessage];
              });
              if (parsed.actionCard) {
                setLocalActionCards((prev) => new Map(prev).set(parsed.aiMessage.id, parsed.actionCard));
              }
              queryClient.invalidateQueries({ queryKey: getGetConversationQueryKey(convId!) });
              queryClient.invalidateQueries({ queryKey: getListConversationsQueryKey() });
            }
            if (parsed.error) throw new Error(parsed.error);
          } catch (e) { if (e instanceof SyntaxError) continue; throw e; }
        }
      }
    } catch {
      toast({ title: "Error", description: "Could not get a response. Try again.", variant: "destructive" });
      setInput(text);
      setStreamingText("");
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const isEmpty = !conversationId && localMessages.length === 0 && !streamingText;

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        {isEmpty ? (
          <EmptyState onChipClick={(c) => { setInput(c); inputRef.current?.focus(); }} />
        ) : (
          <div className="max-w-[700px] mx-auto px-4 py-4 space-y-1 pb-4">
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
              <div className="flex items-start gap-3 mt-2">
                <div className="w-7 h-7 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Sparkles size={13} className="text-primary" />
                </div>
                <div className="flex-1 text-[14px] text-foreground leading-[1.65] pt-1">
                  {streamingText
                    ? <span>{streamingText}<span className="inline-block w-0.5 h-4 bg-foreground ml-0.5 animate-pulse align-middle" /></span>
                    : <div className="flex gap-1.5 pt-1">{[0,1,2].map(i => <div key={i} className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: `${i*0.15}s` }} />)}</div>
                  }
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Voice listening indicator */}
      {isVoiceActive && (
        <div className="mx-4 mb-2 px-4 py-3 bg-primary/8 border border-primary/20 rounded-2xl flex items-center gap-3">
          <div className="flex items-end gap-0.5 h-5 flex-shrink-0">
            {[1,2,3,4,5].map((i) => (
              <div key={i} className="waveform-bar w-1 bg-primary rounded-full"
                style={{ height: `${[50,100,60,90,40][i-1]}%`, animationDelay: `${i*0.1}s` }} />
            ))}
          </div>
          <p className="text-[13px] text-primary font-medium flex-1 truncate">
            {voiceTranscript || "Listening…"}
          </p>
          <button onClick={stopVoice} className="text-[11px] text-primary/70 font-medium">Done</button>
        </div>
      )}

      {/* Input bar */}
      <div className="px-3 pb-4 pt-2 bg-background">
        <div className="max-w-[700px] mx-auto">
          <div className="bg-card border border-border rounded-3xl shadow-sm focus-within:ring-1 focus-within:ring-ring transition-all overflow-hidden">
            {/* Text area */}
            <textarea
              ref={inputRef}
              value={input + (voiceTranscript ? " " + voiceTranscript : "")}
              onChange={(e) => {
                const val = e.target.value;
                setInput(val);
                setVoiceTranscript("");
              }}
              onKeyDown={handleKeyDown}
              placeholder="Message DlJiS…"
              rows={1}
              readOnly={isVoiceActive}
              className="w-full resize-none bg-transparent text-[14px] text-foreground placeholder:text-muted-foreground px-4 pt-3.5 pb-2 focus:outline-none leading-relaxed"
              style={{ minHeight: "48px", maxHeight: "120px", overflowY: "auto" }}
              data-testid="input-message"
            />

            {/* Toolbar row */}
            <div className="flex items-center justify-between px-3 pb-2.5">
              {/* Left: + and model pill */}
              <div className="flex items-center gap-2">
                {/* + button */}
                <div className="relative">
                  <button
                    onClick={() => setAddMenuOpen((v) => !v)}
                    className="w-8 h-8 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                    data-testid="button-add"
                  >
                    <Plus size={16} />
                  </button>
                  {addMenuOpen && (
                    <div className="absolute bottom-full mb-2 left-0 bg-popover border border-border rounded-2xl shadow-lg p-3 w-52 z-50"
                      onMouseLeave={() => setAddMenuOpen(false)}>
                      <p className="text-[11.5px] font-semibold text-muted-foreground mb-2 px-1">Add to chat</p>
                      {["Camera", "Photos", "Files"].map((item) => (
                        <button key={item} className="w-full text-left px-3 py-2 text-[13px] text-foreground hover:bg-accent rounded-xl transition-colors">{item}</button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Model pill */}
                <div className="relative">
                  <button
                    onClick={() => setModelPickerOpen((v) => !v)}
                    className="flex items-center gap-1.5 h-8 px-3 bg-muted hover:bg-accent rounded-full text-[13px] font-medium text-muted-foreground hover:text-foreground transition-colors"
                    data-testid="button-model-picker"
                  >
                    <span className={selectedModel.color}>{selectedModel.label}</span>
                    <ChevronDown size={11} className={cn("transition-transform", modelPickerOpen && "rotate-180")} />
                  </button>

                  {modelPickerOpen && (
                    <div className="absolute bottom-full mb-2 left-0 bg-popover border border-border rounded-2xl shadow-xl overflow-hidden z-50 w-60">
                      <div className="px-4 py-3 border-b border-border">
                        <p className="text-[13px] font-semibold text-foreground">Select model</p>
                      </div>
                      {(["OpenAI", "Google", "Anthropic"] as const).map((group) => {
                        const groupModels = MODELS.filter((m) => m.group === group);
                        return (
                          <div key={group}>
                            <p className="text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground px-4 pt-2.5 pb-1">{group}</p>
                            {groupModels.map((m) => (
                              <button key={m.id}
                                onClick={() => { setSelectedModel(m); setModelPickerOpen(false); }}
                                className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-accent transition-colors text-left"
                                data-testid={`model-${m.id}`}
                              >
                                <div>
                                  <p className={cn("text-[13px] font-medium", m.color)}>{m.label}</p>
                                  <p className="text-[11px] text-muted-foreground">{m.desc}</p>
                                </div>
                                {selectedModel.id === m.id && <Check size={13} className="text-primary flex-shrink-0" />}
                              </button>
                            ))}
                          </div>
                        );
                      })}
                      <div className="px-4 py-2.5 border-t border-border">
                        <p className="text-[11px] text-muted-foreground">Add API keys in <span className="text-primary">Settings → API Keys</span></p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Right: mic + send */}
              <div className="flex items-center gap-2">
                <button
                  onClick={toggleVoice}
                  className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center transition-all",
                    isVoiceActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent"
                  )}
                  data-testid="button-voice"
                >
                  {isVoiceActive ? <MicOff size={16} /> : <Mic size={16} />}
                </button>

                {/* Send / waveform button */}
                <button
                  onClick={handleSend}
                  disabled={!(input.trim() || voiceTranscript.trim()) || isSending}
                  className={cn(
                    "w-9 h-9 rounded-full flex items-center justify-center transition-all",
                    (input.trim() || voiceTranscript.trim()) && !isSending
                      ? "bg-foreground text-background"
                      : "bg-muted text-muted-foreground cursor-not-allowed"
                  )}
                  data-testid="button-send"
                >
                  {isSending ? <AudioLines size={16} className="animate-pulse" /> : <Send size={15} />}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ onChipClick }: { onChipClick: (chip: string) => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full px-4 py-12">
      <div className="mb-5">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
          <path d="M12 2L13.8 8.2L20 10L13.8 11.8L12 18L10.2 11.8L4 10L10.2 8.2L12 2Z" fill="hsl(14, 65%, 58%)" />
          <path d="M19 15L19.9 17.1L22 18L19.9 18.9L19 21L18.1 18.9L16 18L18.1 17.1L19 15Z" fill="hsl(14, 65%, 58%)" opacity="0.6" />
        </svg>
      </div>
      <h1 className="text-[22px] font-semibold text-foreground mb-1.5 tracking-tight text-center">
        HusaynZul returns!
      </h1>
      <p className="text-[13.5px] text-muted-foreground mb-8 text-center max-w-xs leading-relaxed">
        Control your digital life — social, trading, ads, food — through conversation.
      </p>
      <div className="flex flex-wrap gap-2 justify-center max-w-xs">
        {SUGGESTION_CHIPS.map((chip) => (
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
    <div className={cn("flex mt-3", isUser ? "justify-end" : "justify-start")} data-testid={`message-${message.id}`}>
      {!isUser && (
        <div className="w-7 h-7 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0 mr-2.5 mt-0.5">
          <Sparkles size={13} className="text-primary" />
        </div>
      )}
      <div className={cn(
        "max-w-[82%] px-4 py-2.5 text-[14px] leading-[1.65] whitespace-pre-wrap",
        isUser
          ? "bg-foreground text-background rounded-[20px] rounded-br-md"
          : "text-foreground rounded-[20px] rounded-bl-md"
      )}>
        {message.content}
      </div>
    </div>
  );
}
