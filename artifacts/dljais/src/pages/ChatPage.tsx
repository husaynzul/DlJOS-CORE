import { useState, useRef, useEffect, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import {
  useGetConversation,
  getGetConversationQueryKey,
  useCreateConversation,
  useSendMessage,
  getListConversationsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Send, Mic, MicOff, Paperclip, Sparkles } from "lucide-react";
import { ActionCard } from "@/components/ActionCard";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

const SUGGESTION_CHIPS = [
  "Post a new reel to Instagram",
  "Check crypto trading signals",
  "Launch a Google Ads campaign",
  "Order food for delivery",
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
  const [isVoiceActive, setIsVoiceActive] = useState(false);
  const [localMessages, setLocalMessages] = useState<MessageItem[]>([]);
  const [localActionCards, setLocalActionCards] = useState<Map<number, ActionCardData>>(new Map());
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const { data: conversation, refetch } = useGetConversation(
    conversationId!,
    { query: { enabled: !!conversationId, queryKey: getGetConversationQueryKey(conversationId!) } }
  );

  const createConversation = useCreateConversation();
  const sendMessage = useSendMessage(conversationId!);

  useEffect(() => {
    if (conversation?.messages) {
      setLocalMessages(conversation.messages as MessageItem[]);
    }
  }, [conversation]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [localMessages]);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || isSending) return;

    setInput("");
    setIsSending(true);

    try {
      let activeConvId = conversationId;

      if (!activeConvId) {
        const newConv = await new Promise<{ id: number }>((resolve, reject) => {
          createConversation.mutate(
            { data: { title: text.slice(0, 60) || "New conversation" } },
            { onSuccess: resolve, onError: reject }
          );
        });
        activeConvId = newConv.id;
        queryClient.invalidateQueries({ queryKey: getListConversationsQueryKey() });
        setLocation(`/chat/${activeConvId}`);
      }

      const optimisticUser: MessageItem = {
        id: Date.now(),
        role: "user",
        content: text,
        createdAt: new Date().toISOString(),
      };
      setLocalMessages((prev) => [...prev, optimisticUser]);

      const result = await new Promise<{
        userMessage: MessageItem;
        aiMessage: MessageItem;
        actionCard?: ActionCardData;
      }>((resolve, reject) => {
        const mutation = useSendMessageMutation(activeConvId!);
        mutation.mutate(
          { data: { content: text } },
          { onSuccess: resolve as any, onError: reject }
        );
      });

      setLocalMessages((prev) => {
        const withoutOptimistic = prev.filter((m) => m.id !== optimisticUser.id);
        return [...withoutOptimistic, result.userMessage, result.aiMessage];
      });

      if (result.actionCard) {
        setLocalActionCards((prev) => new Map(prev).set(result.aiMessage.id, result.actionCard!));
      }

      queryClient.invalidateQueries({ queryKey: getGetConversationQueryKey(activeConvId) });
      queryClient.invalidateQueries({ queryKey: getListConversationsQueryKey() });
    } catch {
      toast({ title: "Error", description: "Failed to send message.", variant: "destructive" });
      setInput(text);
    } finally {
      setIsSending(false);
    }
  }, [input, isSending, conversationId, createConversation, queryClient, setLocation, toast]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendDirect();
    }
  };

  // Direct send without useCallback for the sendMessage hook
  const handleSendDirect = async () => {
    const text = input.trim();
    if (!text || isSending) return;

    setInput("");
    setIsSending(true);

    try {
      let activeConvId = conversationId;

      if (!activeConvId) {
        const newConv = await createConversationAsync(text);
        activeConvId = newConv;
        queryClient.invalidateQueries({ queryKey: getListConversationsQueryKey() });
        setLocation(`/chat/${activeConvId}`);
        // Wait a tick for state to settle
        await new Promise((r) => setTimeout(r, 100));
      }

      const optimisticUser: MessageItem = {
        id: Date.now(),
        role: "user",
        content: text,
        createdAt: new Date().toISOString(),
      };
      setLocalMessages((prev) => [...prev, optimisticUser]);

      const response = await fetch(`${import.meta.env.BASE_URL}api/conversations/${activeConvId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text }),
      });
      const result = await response.json();

      setLocalMessages((prev) => {
        const withoutOptimistic = prev.filter((m) => m.id !== optimisticUser.id);
        return [...withoutOptimistic, result.userMessage, result.aiMessage];
      });

      if (result.actionCard) {
        setLocalActionCards((prev) => new Map(prev).set(result.aiMessage.id, result.actionCard));
      }

      queryClient.invalidateQueries({ queryKey: getGetConversationQueryKey(activeConvId!) });
      queryClient.invalidateQueries({ queryKey: getListConversationsQueryKey() });
    } catch {
      toast({ title: "Error", description: "Failed to send message.", variant: "destructive" });
      setInput(text);
    } finally {
      setIsSending(false);
    }
  };

  const createConversationAsync = async (title: string): Promise<number> => {
    const response = await fetch(`${import.meta.env.BASE_URL}api/conversations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: title.slice(0, 60) }),
    });
    const conv = await response.json();
    return conv.id;
  };

  const handleChipClick = (chip: string) => {
    setInput(chip);
    inputRef.current?.focus();
  };

  const handleRefetch = () => {
    refetch();
  };

  const isEmpty = !conversationId || localMessages.length === 0;

  return (
    <div className="flex flex-col h-full">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto">
        {isEmpty ? (
          <EmptyState onChipClick={handleChipClick} />
        ) : (
          <div className="max-w-[750px] mx-auto px-4 py-6 pb-4 space-y-1">
            {localMessages.map((msg) => (
              <div key={msg.id}>
                <MessageBubble message={msg} />
                {msg.role === "assistant" && localActionCards.has(msg.id) && (
                  <ActionCard
                    {...localActionCards.get(msg.id)!}
                    onUpdate={handleRefetch}
                  />
                )}
              </div>
            ))}
            {isSending && <ThinkingIndicator />}
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
                style={{
                  height: `${[60, 100, 40, 80, 50][i - 1]}%`,
                  animationDelay: `${i * 0.12}s`,
                }}
              />
            ))}
          </div>
          <span className="text-[13px] text-muted-foreground">Listening — say "Hey DLJAIS"</span>
          <div className="pulse-dot w-2 h-2 rounded-full bg-primary" />
        </div>
      )}

      {/* Input bar */}
      <div className="px-4 py-4 border-t border-border bg-background">
        <div className="max-w-[750px] mx-auto">
          <div className="relative bg-card border border-border rounded-2xl shadow-sm focus-within:ring-1 focus-within:ring-ring focus-within:border-ring transition-all">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Message DLJAIS..."
              rows={1}
              className="w-full resize-none bg-transparent text-[14px] text-foreground placeholder:text-muted-foreground px-4 pt-3.5 pb-3 pr-24 focus:outline-none leading-relaxed max-h-40 overflow-y-auto"
              style={{ minHeight: "52px" }}
              data-testid="input-message"
            />
            <div className="absolute right-2 bottom-2 flex items-center gap-1.5">
              <button
                className="p-2 text-muted-foreground hover:text-foreground rounded-lg hover:bg-accent transition-colors"
                data-testid="button-attach"
              >
                <Paperclip size={16} />
              </button>
              <button
                onClick={() => setIsVoiceActive((v) => !v)}
                className={cn(
                  "p-2 rounded-lg transition-colors",
                  isVoiceActive
                    ? "text-primary bg-primary/10"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent"
                )}
                data-testid="button-voice"
              >
                {isVoiceActive ? <MicOff size={16} /> : <Mic size={16} />}
              </button>
              <button
                onClick={handleSendDirect}
                disabled={!input.trim() || isSending}
                className={cn(
                  "p-2 rounded-xl transition-all",
                  input.trim() && !isSending
                    ? "bg-foreground text-background hover:opacity-80"
                    : "text-muted-foreground opacity-40 cursor-not-allowed"
                )}
                data-testid="button-send"
              >
                <Send size={15} />
              </button>
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground text-center mt-2">
            DLJAIS requires your approval before executing any action.
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
          <path
            d="M12 2L13.8 8.2L20 10L13.8 11.8L12 18L10.2 11.8L4 10L10.2 8.2L12 2Z"
            fill="hsl(14, 65%, 58%)"
          />
          <path
            d="M19 15L19.9 17.1L22 18L19.9 18.9L19 21L18.1 18.9L16 18L18.1 17.1L19 15Z"
            fill="hsl(14, 65%, 58%)"
            opacity="0.6"
          />
        </svg>
      </div>
      <h1 className="text-[22px] font-semibold text-foreground mb-2 tracking-tight">
        What would you like to do?
      </h1>
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
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-4 py-2.5 text-[14px] leading-[1.65]",
          isUser
            ? "bg-foreground text-background rounded-br-sm"
            : "text-foreground bg-transparent rounded-bl-sm"
        )}
      >
        {message.content}
      </div>
    </div>
  );
}

function ThinkingIndicator() {
  return (
    <div className="flex items-center gap-3 mt-2">
      <div className="w-7 h-7 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0">
        <Sparkles size={13} className="text-primary" />
      </div>
      <div className="flex items-center gap-1.5 h-6">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce"
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </div>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function useSendMessageMutation(_id: number) {
  return useSendMessage(_id);
}
