import { useState } from "react";
import { Check, X, Edit2, AlertTriangle, Shield, ShieldAlert, Loader2 } from "lucide-react";
import { useUpdateActionStatus, getListActionsQueryKey, getGetPendingActionCountQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

interface ActionCardProps {
  id: number;
  title: string;
  platform: string;
  intent: string;
  status: string;
  riskLevel: string;
  estimatedCost?: string | null;
  details: string;
  preview?: string | null;
  onUpdate?: () => void;
}

function RiskBadge({ level }: { level: string }) {
  const map: Record<string, { label: string; className: string; icon: React.ElementType }> = {
    low: { label: "Low Risk", className: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400", icon: Shield },
    medium: { label: "Medium Risk", className: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400", icon: AlertTriangle },
    high: { label: "High Risk", className: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400", icon: ShieldAlert },
  };
  const config = map[level] ?? map.low;
  const Icon = config.icon;
  return (
    <span className={cn("inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full", config.className)}>
      <Icon size={10} />
      {config.label}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400",
    approved: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400",
    rejected: "bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-400",
    executing: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-400",
    completed: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400",
    failed: "bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-400",
  };
  return (
    <span className={cn("inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-full capitalize", map[status] ?? map.pending)}>
      {status}
    </span>
  );
}

export function ActionCard({
  id,
  title,
  platform,
  status,
  riskLevel,
  estimatedCost,
  details,
  onUpdate,
}: ActionCardProps) {
  // Guard against invalid id to prevent PATCH /api/actions/undefined
  if (!id || isNaN(id)) return null;
  const [isEditing, setIsEditing] = useState(false);
  const [editedDetails, setEditedDetails] = useState(details);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const updateMutation = useUpdateActionStatus();

  const isPending = status === "pending";

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getListActionsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetPendingActionCountQueryKey() });
    onUpdate?.();
  };

  const handleApprove = () => {
    updateMutation.mutate(
      { id, data: { status: "approved" } },
      {
        onSuccess: () => {
          toast({ title: "Action approved", description: `${title} has been approved and queued for execution.` });
          invalidate();
        },
        onError: () => toast({ title: "Error", description: "Failed to approve action.", variant: "destructive" }),
      }
    );
  };

  const handleReject = () => {
    updateMutation.mutate(
      { id, data: { status: "rejected" } },
      {
        onSuccess: () => {
          toast({ title: "Action rejected", description: `${title} has been cancelled.` });
          invalidate();
        },
        onError: () => toast({ title: "Error", description: "Failed to reject action.", variant: "destructive" }),
      }
    );
  };

  const handleSaveEdit = () => {
    updateMutation.mutate(
      { id, data: { status: "approved", modifiedDetails: editedDetails } },
      {
        onSuccess: () => {
          setIsEditing(false);
          toast({ title: "Action modified", description: "Details updated. Ready for approval." });
          invalidate();
        },
      }
    );
  };

  return (
    <div className="my-3 max-w-[520px]" data-testid={`action-card-${id}`}>
      <div className="bg-card border border-card-border rounded-2xl shadow-md overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-card-border bg-background/40">
          <div className="flex items-center gap-2.5">
            <PlatformIcon platform={platform} />
            <div>
              <p className="text-[13.5px] font-semibold text-foreground">{title}</p>
              <p className="text-[11.5px] text-muted-foreground">{platform}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <RiskBadge level={riskLevel} />
            {!isPending && <StatusBadge status={status} />}
          </div>
        </div>

        {/* Body */}
        <div className="px-4 py-3 space-y-3">
          {isEditing ? (
            <textarea
              className="w-full text-[13px] text-foreground bg-muted rounded-lg p-3 resize-none border border-border focus:outline-none focus:ring-1 focus:ring-ring"
              rows={4}
              value={editedDetails}
              onChange={(e) => setEditedDetails(e.target.value)}
              data-testid="textarea-edit-details"
            />
          ) : (
            <div className="text-[13px] text-foreground leading-relaxed whitespace-pre-line">{details}</div>
          )}

          {estimatedCost && (
            <div className="flex items-center justify-between text-[12px]">
              <span className="text-muted-foreground">Estimated cost</span>
              <span className="font-medium text-foreground">{estimatedCost}</span>
            </div>
          )}
        </div>

        {/* Action buttons */}
        {isPending && (
          <div className="flex items-center gap-2 px-4 py-3 border-t border-card-border">
            {isEditing ? (
              <>
                <button
                  onClick={handleSaveEdit}
                  disabled={updateMutation.isPending}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground text-[12.5px] font-medium rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
                  data-testid={`button-save-edit-${id}`}
                >
                  {updateMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                  Save
                </button>
                <button
                  onClick={() => { setIsEditing(false); setEditedDetails(details); }}
                  className="px-3 py-1.5 text-[12.5px] font-medium text-muted-foreground hover:text-foreground border border-border rounded-lg hover:bg-accent transition-colors"
                  data-testid={`button-cancel-edit-${id}`}
                >
                  Cancel
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={handleApprove}
                  disabled={updateMutation.isPending}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white text-[12.5px] font-medium rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50"
                  data-testid={`button-approve-${id}`}
                >
                  {updateMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                  Approve
                </button>
                <button
                  onClick={handleReject}
                  disabled={updateMutation.isPending}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-[12.5px] font-medium text-muted-foreground hover:text-foreground border border-border rounded-lg hover:bg-accent transition-colors disabled:opacity-50"
                  data-testid={`button-reject-${id}`}
                >
                  <X size={13} />
                  Reject
                </button>
                <button
                  onClick={() => setIsEditing(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-[12.5px] font-medium text-muted-foreground hover:text-foreground border border-border rounded-lg hover:bg-accent transition-colors ml-auto"
                  data-testid={`button-edit-${id}`}
                >
                  <Edit2 size={13} />
                  Modify
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function PlatformIcon({ platform }: { platform: string }) {
  const lower = platform.toLowerCase();
  let bg = "bg-slate-100 dark:bg-slate-800";
  let label = platform.charAt(0).toUpperCase();

  if (lower.includes("instagram")) bg = "bg-pink-100 dark:bg-pink-950";
  else if (lower.includes("youtube")) bg = "bg-red-100 dark:bg-red-950";
  else if (lower.includes("tiktok")) bg = "bg-slate-900 dark:bg-slate-800";
  else if (lower.includes("binance")) bg = "bg-yellow-100 dark:bg-yellow-950";
  else if (lower.includes("google")) bg = "bg-blue-100 dark:bg-blue-950";
  else if (lower.includes("meta")) bg = "bg-blue-100 dark:bg-blue-950";
  else if (lower.includes("shopify")) bg = "bg-green-100 dark:bg-green-950";
  else if (lower.includes("mt5") || lower.includes("forex")) bg = "bg-purple-100 dark:bg-purple-950";
  else if (lower.includes("food")) bg = "bg-orange-100 dark:bg-orange-950";

  return (
    <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center text-[13px] font-bold", bg)}>
      {label}
    </div>
  );
}
