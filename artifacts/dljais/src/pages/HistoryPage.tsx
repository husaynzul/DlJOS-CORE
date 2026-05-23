import { Link } from "wouter";
import { useListConversations, useDeleteConversation, getListConversationsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { MessageSquare, Trash2, ChevronRight, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

function formatDate(dateStr: string) {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const hours = diff / (1000 * 60 * 60);
  if (hours < 24) return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (hours < 48) return "Yesterday";
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

export default function HistoryPage() {
  const { data: conversations, isLoading } = useListConversations();
  const deleteConversation = useDeleteConversation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleDelete = (id: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    deleteConversation.mutate(
      { id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListConversationsQueryKey() });
          toast({ title: "Conversation deleted" });
        },
        onError: () => toast({ title: "Error", description: "Failed to delete.", variant: "destructive" }),
      }
    );
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="max-w-[700px] mx-auto w-full px-6 py-8">
        <div className="mb-6">
          <h1 className="text-[22px] font-semibold text-foreground tracking-tight">Conversation History</h1>
          <p className="text-[13.5px] text-muted-foreground mt-1">All your previous sessions with DlJiS.</p>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 rounded-xl shimmer" />
            ))}
          </div>
        ) : !conversations?.length ? (
          <div className="text-center py-20 text-muted-foreground">
            <MessageSquare size={32} className="mx-auto mb-3 opacity-30" />
            <p className="text-[14px]">No conversations yet</p>
            <Link href="/">
              <span className="text-[13px] text-primary hover:underline cursor-pointer mt-1 inline-block">
                Start your first conversation
              </span>
            </Link>
          </div>
        ) : (
          <div className="space-y-1.5">
            {conversations.map((conv) => (
              <Link key={conv.id} href={`/chat/${conv.id}`}>
                <div
                  className={cn(
                    "group flex items-center gap-4 px-4 py-3.5 rounded-xl border border-transparent hover:border-border hover:bg-card transition-all cursor-pointer"
                  )}
                  data-testid={`conversation-row-${conv.id}`}
                >
                  <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                    <MessageSquare size={15} className="text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13.5px] font-medium text-foreground truncate">{conv.title}</p>
                    {conv.lastMessage && (
                      <p className="text-[12px] text-muted-foreground truncate mt-0.5">{conv.lastMessage}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <div className="flex items-center gap-1 text-[11.5px] text-muted-foreground">
                      <Clock size={11} />
                      {formatDate(conv.updatedAt)}
                    </div>
                    <span className="text-[11px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                      {conv.messageCount} msg
                    </span>
                    <button
                      onClick={(e) => handleDelete(conv.id, e)}
                      className="opacity-0 group-hover:opacity-100 p-1.5 text-muted-foreground hover:text-destructive rounded-lg hover:bg-destructive/10 transition-all"
                      data-testid={`button-delete-conv-${conv.id}`}
                    >
                      <Trash2 size={14} />
                    </button>
                    <ChevronRight size={14} className="text-muted-foreground opacity-40" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
