import { useState, useRef, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import {
  useGetConversation,
  getGetConversationQueryKey,
  getListConversationsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Send, Mic, MicOff, Paperclip, Sparkles, ChevronDown, Check } from "lucide-react";
import { ActionCard } from "@/components/ActionCard";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

const SUGGESTION_CHIPS = [
  "Post a new reel to Instagram",
  "Check crypto trading signals",
  "Launch a Google Ads campaign",
  "Order food for delivery",
];

const MODELS = [
  { id: "claude-opus-4-7", label: "Claude Opus", provider: "Anthropic", color: "text-orange-500" },
  { id: "claude-sonnet-4-6", label: "Claude Sonnet", provider: "Anthropic", color: "text-orange-400" },
  { id: "claude-haiku-4-5", label: "Claude Haiku", provider: "Anthropic", color: "text-orange-300" },
];

interface MessageItem {
  id: number;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  actionCardId?: number | null;
}

interface ActionCardData {
  id: number;
  title: string;
  platform: string;
  intent: string;
  status: string;
  riskLevel: string;
  estimatedCost?: string | null;
  details: string;
  preview?: string | null;
}

export default function ChatPage() {
  const params = useParams<{ id?: string }>();
  const conversationId = params.id ? parseInt(params.id) : null;
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [input, setInput] = useState("");
  const [selectedModel, setSelectedModel] = useState(MODELS[1]);
  const [modelPickerOpen, setModelPickerOpen] = useState(false);
  const [isVoiceActive, setIsVoiceActive] = useState(false);
  const [localMessages, setLocalMessages] = useState<MessageItem[]>([]);
  const [localActionCards, setLocalActionCards] = useState<Map<number, ActionCardData>>(new Map());
  const [isSending, setIsSending] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const modelPickerRef = useRef<HTMLDivElement>(null);

  const { data: conversation, refetch } = useGetConversation(
    conversationId!,
    { query: { enabled: !!conversationId, queryKey: getGetConversationQueryKey(conversationId!) } }
  );

  useEffect(() => {
    if (conversation?.messages) {
      setLocalMessages(conversation.messages as MessageItem[]);
    }
  }, [conversation]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [localMessages, streamingText]);

  // Close model picker on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (modelPickerRef.current && !modelPickerRef.current.contains(e.target as Node)) {
        setModelPickerOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const createConversation = async (title: string): Promise<number> => {
    const res = await fetch(`${import.meta.env.BASE_URL}api/conversations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: title.slice(0, 60) }),
    });
    const conv = await res.json();
    return conv.id;
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isSending) return;

    setInput("");
    setIsSending(true);
    setStreamingText("");

    try {
      let activeConvId = conversationId;

      if (!activeConvId) {
        activeConvId = await createConversation(text);
        queryClient.invalidateQueries({ queryKey: getListConversationsQueryKey() });
        setLocation(`/chat/${activeConvId}`);
        await new Promise((r) => setTimeout(r, 80));
      }

      // Optimistic user message
      const optimisticId = Date.now();
      const optimisticUser: MessageItem = {
        id: optimisticId,
        role: "user",
        content: text,
        createdAt: new Date().toISOString(),
      };
      setLocalMessages((prev) => [...prev, optimisticUser]);

      // Stream from Claude
      const response = await fetch(
        `${import.meta.env.BASE_URL}api/ai/conversations/${activeConvId}/messages`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: text, model: selectedModel.id }),
        }
      );

      if (!response.ok || !response.body) {
        throw new Error("Stream failed");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let streamed = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (!data) continue;

          try {
            const parsed = JSON.parse(data);

            if (parsed.content) {
              streamed += parsed.content;
              setStreamingText(streamed);
            }

            if (parsed.done) {
              setStreamingText("");
              setLocalMessages((prev) => {
                const without = prev.filter((m) => m.id !== optimisticId);
                return [...without, parsed.userMessage, parsed.aiMessage];
              });
              if (parsed.actionCard) {
                setLocalActionCards((prev) =>
                  new Map(prev).set(parsed.aiMessage.id, parsed.actionCard)
                );
              }
              queryClient.invalidateQueries({ queryKey: getGetConversationQueryKey(activeConvId!) });
              queryClient.invalidateQueries({ queryKey: getListConversationsQueryKey() });
            }

            if (parsed.error) {
              throw new Error(parsed.error);
            }
          } catch (e) {
            if (e instanceof SyntaxError) continue;
            throw e;
          }
        }
      }
    } catch (err) {
      toast({ title: "Error", description: "Failed to get a response. Please try again.", variant: "destructive" });
      setInput(text);
      setStreamingText("");
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleChipClick = (chip: string) => {
    setInput(chip);
    inputRef.current?.focus();
  };

  const isEmpty = !conversationId || (localMessages.length === 0 && !streamingText);

  return (
    <div className="flex flex-col h-full">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto">
        {isEmpty ? (
          <EmptyState onChipClick={handleChipClick} />
        ) : (
          <div className="max-w-[750px] mx-auto px-4 py-6 space-y-1">
            {localMessages.map((msg) => (
              <div key={msg.id}>
                <MessageBubble message={msg} />
                {msg.role === "assistant" && localActionCards.has(msg.id) && (
                  <ActionCard
                    {...localActionCards.get(msg.id)!}
                    estimatedCost={localActionCards.get(msg.id)!.estimatedCost ?? null}
                    preview={localActionCards.get(msg.id)!.preview ?? null}
                    onUpdate={refetch}
                  />
                )}
              </div>
            ))}

            {/* Streaming indicator */}
            {isSending && (
              <div className="flex items-start gap-3 mt-2">
                <div className="w-7 h-7 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Sparkles size={13} className="text-primary" />
                </div>
                <div className="flex-1 text-[14px] text-foreground leading-[1.65]">
                  {streamingText ? (
                    <span>{streamingText}<span className="inline-block w-0.5 h-4 bg-foreground ml-0.5 animate-pulse align-middle" /></span>
                  ) : (
                    <div className="flex items-center gap-1.5 h-6 pt-1">
                      {[0, 1, 2].map((i) => (
                        <div key={i} className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Voice indicator */}
      {isVoiceActive && (
        <div className="flex items-center justify-center gap-3 py-3 bg-background/80 border-t border-border backdrop-blur-sm">
          <div className="flex items-end gap-1 h-6">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="waveform-bar w-1 bg-primary rounded-full"
                style={{ height: `${[60, 100, 40, 80, 50][i - 1]}%`, animationDelay: `${i * 0.12}s` }}
              />
            ))}
          </div>
          <span className="text-[13px] text-muted-foreground">Listening — say "Hey DlJiS"</span>
          <div className="pulse-dot w-2 h-2 rounded-full bg-primary" />
        </div>
      )}

      {/* Input area */}
      <div className="px-4 py-4 border-t border-border bg-background">
        <div className="max-w-[750px] mx-auto">
          <div className="relative bg-card border border-border rounded-2xl shadow-sm focus-within:ring-1 focus-within:ring-ring focus-within:border-ring transition-all">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Message DlJiS..."
              rows={1}
              className="w-full resize-none bg-transparent text-[14px] text-foreground placeholder:text-muted-foreground px-4 pt-3.5 pb-12 focus:outline-none leading-relaxed max-h-40 overflow-y-auto"
              style={{ minHeight: "52px" }}
              data-testid="input-message"
            />

            {/* Bottom toolbar inside input */}
            <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                {/* Model picker */}
                <div className="relative" ref={modelPickerRef}>
                  <button
                    onClick={() => setModelPickerOpen((v) => !v)}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 bg-muted hover:bg-accent rounded-lg text-[12px] font-medium text-muted-foreground hover:text-foreground transition-colors"
                    data-testid="button-model-picker"
                  >
                    <span className={selectedModel.color}>{selectedModel.label}</span>
                    <ChevronDown size={11} className={cn("transition-transform", modelPickerOpen && "rotate-180")} />
                  </button>

                  {modelPickerOpen && (
                    <div className="absolute bottom-full mb-2 left-0 w-52 bg-popover border border-popover-border rounded-xl shadow-lg overflow-hidden z-50">
                      <div className="px-3 py-2 border-b border-border">
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Select model</p>
                      </div>
                      {MODELS.map((model) => (
                        <button
                          key={model.id}
                          onClick={() => { setSelectedModel(model); setModelPickerOpen(false); }}
                          className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-accent transition-colors text-left"
                          data-testid={`model-option-${model.id}`}
                        >
                          <div>
                            <p className={cn("text-[13px] font-medium", model.color)}>{model.label}</p>
                            <p className="text-[11px] text-muted-foreground">{model.provider}</p>
                          </div>
                          {selectedModel.id === model.id && <Check size={13} className="text-primary flex-shrink-0" />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-accent transition-colors"
                  data-testid="button-attach"
                >
                  <Paperclip size={15} />
                </button>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setIsVoiceActive((v) => !v)}
                  className={cn(
                    "p-1.5 rounded-lg transition-colors",
                    isVoiceActive ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground hover:bg-accent"
                  )}
                  data-testid="button-voice"
                >
                  {isVoiceActive ? <MicOff size={15} /> : <Mic size={15} />}
                </button>
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || isSending}
                  className={cn(
                    "p-1.5 rounded-xl transition-all",
                    input.trim() && !isSending
                      ? "bg-foreground text-background hover:opacity-80"
                      : "text-muted-foreground opacity-40 cursor-not-allowed"
                  )}
                  data-testid="button-send"
                >
                  <Send size={14} />
                </button>
              </div>
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground text-center mt-2">
            DlJiS requires your approval before executing any action.
          </p>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ onChipClick }: { onChipClick: (chip: string) => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full px-4 py-16">
      <div className="mb-6">
        <svg width="44" height="44" viewBox="0 0 24 24" fill="none">
          <path d="M12 2L13.8 8.2L20 10L13.8 11.8L12 18L10.2 11.8L4 10L10.2 8.2L12 2Z" fill="hsl(14, 65%, 58%)" />
          <path d="M19 15L19.9 17.1L22 18L19.9 18.9L19 21L18.1 18.9L16 18L18.1 17.1L19 15Z" fill="hsl(14, 65%, 58%)" opacity="0.6" />
        </svg>
      </div>
      <h1 className="text-[22px] font-semibold text-foreground mb-2 tracking-tight">What would you like to do?</h1>
      <p className="text-[14px] text-muted-foreground mb-8 text-center max-w-sm leading-relaxed">
        Control your digital life through conversation. Say it, confirm it, done.
      </p>
      <div className="flex flex-wrap gap-2 justify-center max-w-md">
        {SUGGESTION_CHIPS.map((chip) => (
          <button
            key={chip}
            onClick={() => onChipClick(chip)}
            className="px-3.5 py-2 bg-card border border-border rounded-xl text-[13px] text-foreground hover:bg-accent hover:border-accent-border transition-all"
            data-testid={`chip-${chip.toLowerCase().replace(/\s/g, "-")}`}
          >
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
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")} data-testid={`message-${message.id}`}>
      {!isUser && (
        <div className="flex-shrink-0 mr-3 mt-1">
          <div className="w-7 h-7 rounded-full bg-primary/15 flex items-center justify-center">
            <Sparkles size={13} className="text-primary" />
          </div>
        </div>
      )}
      <div className={cn(
        "max-w-[85%] rounded-2xl px-4 py-2.5 text-[14px] leading-[1.65] whitespace-pre-wrap",
        isUser
          ? "bg-foreground text-background rounded-br-sm"
          : "text-foreground rounded-bl-sm"
      )}>
        {message.content}
      </div>
    </div>
  );
}
