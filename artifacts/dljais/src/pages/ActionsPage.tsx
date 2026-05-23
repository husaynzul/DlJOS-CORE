import { useState } from "react";
import { useListActions } from "@workspace/api-client-react";
import { ActionCard } from "@/components/ActionCard";
import { Zap } from "lucide-react";
import { cn } from "@/lib/utils";

const STATUS_TABS = [
  { value: undefined, label: "All" },
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "completed", label: "Completed" },
  { value: "rejected", label: "Rejected" },
];

export default function ActionsPage() {
  const [activeTab, setActiveTab] = useState<string | undefined>(undefined);

  const { data: actions, isLoading, refetch } = useListActions(
    activeTab ? { status: activeTab as any } : {},
    { query: { queryKey: ["listActions", activeTab] as any } }
  );

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="max-w-[700px] mx-auto w-full px-6 py-8">
        <div className="mb-6">
          <h1 className="text-[22px] font-semibold text-foreground tracking-tight">Action History</h1>
          <p className="text-[13.5px] text-muted-foreground mt-1">
            Review and manage all actions across your platforms.
          </p>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 p-1 bg-muted rounded-xl mb-6 w-fit">
          {STATUS_TABS.map((tab) => (
            <button
              key={String(tab.value)}
              onClick={() => setActiveTab(tab.value)}
              className={cn(
                "px-3.5 py-1.5 rounded-lg text-[13px] font-medium transition-all",
                activeTab === tab.value
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
              data-testid={`tab-${tab.label.toLowerCase()}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-36 rounded-2xl shimmer" />
            ))}
          </div>
        ) : !actions?.length ? (
          <div className="text-center py-20 text-muted-foreground">
            <Zap size={32} className="mx-auto mb-3 opacity-30" />
            <p className="text-[14px]">No actions yet</p>
            <p className="text-[13px] mt-1">Actions appear here when DlJiS prepares something for your approval.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {actions.map((action) => (
              <ActionCard
                key={action.id}
                {...action}
                estimatedCost={action.estimatedCost ?? null}
                preview={action.preview ?? null}
                onUpdate={() => refetch()}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
