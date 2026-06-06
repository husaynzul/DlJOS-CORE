import { useState, useRef } from "react";
import {
  Check, X, Edit2, AlertTriangle, Shield, ShieldAlert, Loader2,
  Sparkles, Megaphone, PenLine, Link2, ChevronRight,
} from "lucide-react";
import { useUpdateActionStatus, getListActionsQueryKey, getGetPendingActionCountQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { BrandIcon } from "@/components/BrandIcon";

// ─── Types ────────────────────────────────────────────────────────────────────

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

interface AdDetails {
  objective?: string;
  targetAudience?: string;
  dailyBudget?: string;
  age?: string;
  duration?: string;
  gender?: string;
  estimatedTotal?: string;
  placements?: string;
  caption?: string;
  hashtags?: string;
  aiSummary?: string;
  platformFee?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseAdDetails(raw: string): AdDetails | null {
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
  } catch {}
  return null;
}

function isPlatformConnected(platformName: string): boolean {
  try {
    const raw = localStorage.getItem("dljois-platform-states");
    if (!raw) return false;
    const states = JSON.parse(raw) as Record<string, { status: string }>;
    const key = platformName.toLowerCase().replace(/\s/g, "-").replace(/[()]/g, "").replace(/x-twitter/, "x");
    const entry = Object.entries(states).find(([k]) => {
      const pk = k.toLowerCase();
      const pl = platformName.toLowerCase();
      return pk.includes(pl.split(" ")[0]) || pl.includes(pk);
    });
    return entry?.[1]?.status === "connected";
  } catch {
    return false;
  }
}

function isAdCampaign(intent: string, title: string): boolean {
  return intent === "ads" || /ad|campaign|adverti/i.test(title);
}

const PLATFORM_ICONS: Record<string, string> = {
  instagram: "📸", tiktok: "🎵", youtube: "▶️", facebook: "📘",
  whatsapp: "💬", x: "𝕏", twitter: "𝕏", gmail: "📧",
  "google drive": "📁", "meta ads": "📢", "google ads": "🔍",
  "tiktok ads": "🎯", meta: "📢", google: "🔍", shopify: "🛍️",
};
function getPlatformEmoji(platform: string) {
  const k = platform.toLowerCase();
  return Object.entries(PLATFORM_ICONS).find(([p]) => k.includes(p))?.[1] ?? "🌐";
}

// ─── OTP Input ────────────────────────────────────────────────────────────────

function OtpInput({ length = 6, value, onChange }: { length?: number; value: string; onChange: (v: string) => void }) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = value.padEnd(length, "").split("").slice(0, length);

  const handleChange = (i: number, v: string) => {
    const d = v.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[i] = d;
    onChange(next.join(""));
    if (d && i < length - 1) refs.current[i + 1]?.focus();
  };

  const handleKeyDown = (i: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !digits[i] && i > 0) refs.current[i - 1]?.focus();
  };

  return (
    <div className="flex items-center gap-2">
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => { refs.current[i] = el; }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={d || ""}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          className="w-10 h-11 text-center text-[16px] font-semibold bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 text-foreground"
          placeholder="-"
        />
      ))}
    </div>
  );
}

// ─── Ad Campaign Dialog ───────────────────────────────────────────────────────

function AdCampaignDialog({
  id, title, platform, riskLevel, estimatedCost, details,
  onClose, onApprove, onReject, onModify, isLoading,
}: {
  id: number; title: string; platform: string; riskLevel: string;
  estimatedCost?: string | null; details: string;
  onClose: () => void; onApprove: () => void; onReject: () => void;
  onModify: () => void; isLoading: boolean;
}) {
  const ad = parseAdDetails(details);
  const [verifyMode, setVerifyMode] = useState<"otp" | "email">("otp");
  const [otp, setOtp] = useState("");
  const [resendTimer] = useState(45);
  const connected = isPlatformConnected(platform);

  const riskConfig = {
    low:    { label: "Low",    icon: "🟢", bg: "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300" },
    medium: { label: "Medium", icon: "⚠️", bg: "bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300" },
    high:   { label: "High",   icon: "🔴", bg: "bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800 text-red-800 dark:text-red-300" },
  }[riskLevel] ?? { label: "Medium", icon: "⚠️", bg: "bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300" };

  const platFee = ad?.platformFee ?? "$2.00";
  const adSpend = ad?.estimatedTotal ?? estimatedCost ?? "$0.00";
  const totalCost = (() => {
    const a = parseFloat(adSpend.replace(/[^0-9.]/g, "") || "0");
    const f = parseFloat(platFee.replace(/[^0-9.]/g, "") || "2");
    return `$${(a + f).toFixed(2)}`;
  })();

  const fmt = (v: string | undefined, fallback: string) => v?.trim() || fallback;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60 backdrop-blur-[3px]" onClick={onClose}>
      <div
        className="relative w-full max-w-[560px] max-h-[92dvh] overflow-y-auto bg-background rounded-3xl shadow-2xl animate-in zoom-in-95 fade-in duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="flex items-start justify-between px-5 pt-5 pb-4 border-b border-border">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-100 dark:bg-amber-950 flex items-center justify-center flex-shrink-0 mt-0.5">
              <AlertTriangle size={20} className="text-amber-500" />
            </div>
            <div>
              <h2 className="text-[17px] font-bold text-foreground">Approve Ad Campaign</h2>
              <p className="text-[12px] text-muted-foreground mt-0.5 leading-snug">
                Please review the details below before executing this action.<br />
                No action will be executed without your explicit approval.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl text-muted-foreground hover:bg-accent transition-colors flex-shrink-0">
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">

          {/* Platform not connected warning */}
          {!connected && (
            <div className="flex items-center gap-2.5 px-3.5 py-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl">
              <ShieldAlert size={15} className="text-red-500 flex-shrink-0" />
              <p className="text-[12.5px] text-red-700 dark:text-red-300 flex-1">
                <span className="font-semibold">{platform}</span> is not connected.{" "}
                <a href="/platforms" className="underline hover:no-underline">Connect it in Platforms →</a>
              </p>
            </div>
          )}

          {/* ── Meta row ── */}
          <div className="bg-muted/40 border border-border rounded-2xl px-4 py-3 grid grid-cols-5 gap-2 text-center">
            {[
              { label: "Platform", value: `${getPlatformEmoji(platform)} ${platform}`, bold: true },
              { label: "+ Action Type", value: `📢 Ad Campaign` },
              { label: "+ Risk Level", value: `${riskConfig.icon} ${riskConfig.label}` },
              { label: "+ Model Used", value: "✨ DlJOS AI" },
              { label: "+ Mode", value: "DLJOS AI", pill: true },
            ].map((item) => (
              <div key={item.label} className="min-w-0">
                <p className="text-[10px] text-muted-foreground truncate">{item.label}</p>
                {item.pill ? (
                  <span className="inline-block mt-1 text-[11px] font-bold px-2 py-0.5 bg-primary/10 text-primary rounded-full">{item.value}</span>
                ) : (
                  <p className={cn("text-[12px] mt-1 truncate", item.bold ? "font-bold text-foreground" : "text-foreground")}>{item.value}</p>
                )}
              </div>
            ))}
          </div>

          {/* ── Campaign Overview ── */}
          <div className="bg-card border border-card-border rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
              <div className="flex items-center gap-2">
                <Megaphone size={13} className="text-muted-foreground" />
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Campaign Overview</p>
              </div>
              <button onClick={onModify} className="flex items-center gap-1 text-[12px] text-primary hover:opacity-75 transition-opacity">
                <Edit2 size={12} />Edit
              </button>
            </div>
            <div className="px-4 py-3 grid grid-cols-2 gap-x-6 gap-y-3">
              {[
                ["Campaign Objective", fmt(ad?.objective, "Traffic")],
                ["Target Audience",    fmt(ad?.targetAudience, "Global")],
                ["Daily Budget",       fmt(ad?.dailyBudget, estimatedCost ?? "—")],
                ["Age",                fmt(ad?.age, "18 – 45")],
                ["Duration",           fmt(ad?.duration, "7 Days")],
                ["Gender",             fmt(ad?.gender, "All")],
                ["Total Estimated Spend", fmt(ad?.estimatedTotal, estimatedCost ?? "—")],
                ["Placements",         fmt(ad?.placements, "Feed, Stories")],
              ].map(([label, val]) => (
                <div key={label}>
                  <p className="text-[11px] text-muted-foreground">{label}</p>
                  <p className="text-[13px] font-semibold text-foreground mt-0.5">{val}</p>
                </div>
              ))}
            </div>
          </div>

          {/* ── Creative Preview ── */}
          <div className="bg-card border border-card-border rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
              <div className="flex items-center gap-2">
                <span className="text-[13px]">🖼️</span>
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Creative Preview</p>
              </div>
              <button onClick={onModify} className="flex items-center gap-1 text-[12px] text-primary hover:opacity-75 transition-opacity">
                <Edit2 size={12} />Edit
              </button>
            </div>
            <div className="px-4 py-3 flex gap-4 items-start">
              {/* Thumbnail placeholder */}
              <div className="w-[90px] h-[90px] rounded-xl bg-gradient-to-br from-pink-400 via-orange-300 to-yellow-200 flex items-center justify-center flex-shrink-0 relative overflow-hidden">
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-9 h-9 rounded-full bg-black/40 flex items-center justify-center">
                    <div className="w-0 h-0 border-t-[7px] border-t-transparent border-b-[7px] border-b-transparent border-l-[13px] border-l-white ml-1" />
                  </div>
                </div>
                <div className="absolute bottom-1.5 right-1.5 bg-black/60 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded-md">0:15</div>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] text-muted-foreground mb-1">Caption</p>
                <p className="text-[13px] text-foreground leading-snug">
                  {fmt(ad?.caption, "Your ad creative goes here. ✨")}
                </p>
                <p className="text-[12px] text-primary/80 mt-1.5">
                  {fmt(ad?.hashtags, "#Ad #Campaign")}
                </p>
              </div>
            </div>
          </div>

          {/* ── Cost Breakdown + AI Summary ── */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-card border border-card-border rounded-2xl px-4 py-3 space-y-2">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-[13px]">💰</span>
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Cost Breakdown</p>
              </div>
              {[
                [`Ad Spend (${fmt(ad?.duration, "7 Days")})`, adSpend],
                ["Platform Fee (DLJOS)", platFee],
                ["Estimated Tax", "$0.00"],
              ].map(([label, val]) => (
                <div key={label} className="flex items-center justify-between">
                  <span className="text-[12px] text-muted-foreground">{label}</span>
                  <span className="text-[12px] text-foreground font-medium">{val}</span>
                </div>
              ))}
              <div className="flex items-center justify-between pt-2 border-t border-border">
                <span className="text-[12.5px] font-semibold text-foreground">Total Estimated Cost</span>
                <span className="text-[13px] font-bold text-emerald-600 dark:text-emerald-400">{totalCost}</span>
              </div>
            </div>

            <div className="bg-card border border-card-border rounded-2xl px-4 py-3">
              <div className="flex items-center gap-1.5 mb-2">
                <Sparkles size={13} className="text-primary" />
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">AI Summary</p>
              </div>
              <p className="text-[12px] text-muted-foreground leading-relaxed">
                {fmt(ad?.aiSummary, `This campaign targets your selected audience to maximize reach and engagement within your budget across all selected placements.`)}
              </p>
            </div>
          </div>

          {/* ── Security Verification ── */}
          <div className="bg-card border border-card-border rounded-2xl overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border">
              <Shield size={13} className="text-muted-foreground" />
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Security Verification</p>
            </div>
            <div className="px-4 py-3 space-y-3">
              <div className={cn("px-3.5 py-2.5 rounded-xl border text-[12.5px] font-medium flex items-center gap-2", riskConfig.bg)}>
                <span>{riskConfig.icon}</span>
                This is a <strong>{riskConfig.label} Risk</strong> action. Verification is required.
              </div>

              {/* Verify method toggle */}
              <div className="grid grid-cols-2 gap-2">
                {(["otp", "email"] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setVerifyMode(mode)}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2.5 rounded-xl border text-[12.5px] font-medium transition-colors",
                      verifyMode === mode
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-border text-muted-foreground hover:bg-accent"
                    )}
                  >
                    <div className={cn("w-3.5 h-3.5 rounded-full border-2 flex-shrink-0 flex items-center justify-center",
                      verifyMode === mode ? "border-primary" : "border-muted-foreground"
                    )}>
                      {verifyMode === mode && <div className="w-1.5 h-1.5 rounded-full bg-primary" />}
                    </div>
                    {mode === "otp" ? "OTP Verification (Recommended)" : "Email Verification"}
                  </button>
                ))}
              </div>

              {/* OTP input */}
              <div className="space-y-2">
                <p className="text-[12px] text-muted-foreground">
                  Enter the 6-digit code sent to your registered {verifyMode === "otp" ? "mobile number" : "email"}
                </p>
                <OtpInput value={otp} onChange={setOtp} />
                <div className="flex justify-end">
                  <p className="text-[11.5px] text-muted-foreground">
                    Resend code in <span className="text-primary font-semibold">00:{String(resendTimer).padStart(2, "0")}</span>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Bottom actions ── */}
        <div className="sticky bottom-0 bg-background border-t border-border px-5 py-4 flex items-center gap-3">
          <button onClick={onClose}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-border text-[13px] font-semibold text-muted-foreground hover:bg-accent transition-colors flex-shrink-0">
            <X size={14} />Cancel
          </button>
          <button onClick={onModify}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-border text-[13px] font-semibold text-foreground hover:bg-accent transition-colors flex-shrink-0">
            <PenLine size={14} />Modify Details
          </button>
          <button
            onClick={onApprove}
            disabled={isLoading || otp.length < 6}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[13.5px] font-bold transition-all",
              !isLoading && otp.length >= 6
                ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-md"
                : "bg-muted text-muted-foreground cursor-not-allowed"
            )}
          >
            {isLoading ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
            <span>
              Approve & Execute
              <span className="block text-[10.5px] font-normal opacity-75">Action will be queued for execution</span>
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Risk / Status badges ─────────────────────────────────────────────────────

function RiskBadge({ level }: { level: string }) {
  const map: Record<string, { label: string; className: string; icon: React.ElementType }> = {
    low:    { label: "Low Risk",    className: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400", icon: Shield },
    medium: { label: "Medium Risk", className: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400",         icon: AlertTriangle },
    high:   { label: "High Risk",   className: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400",                 icon: ShieldAlert },
  };
  const config = map[level] ?? map.low;
  const Icon = config.icon;
  return (
    <span className={cn("inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full", config.className)}>
      <Icon size={10} />{config.label}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending:   "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400",
    approved:  "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400",
    rejected:  "bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-400",
    executing: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-400",
    completed: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400",
    failed:    "bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-400",
  };
  return (
    <span className={cn("inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-full capitalize", map[status] ?? map.pending)}>
      {status}
    </span>
  );
}

// ─── Main ActionCard ──────────────────────────────────────────────────────────

export function ActionCard({
  id, title, platform, intent, status, riskLevel, estimatedCost, details, onUpdate,
}: ActionCardProps) {
  if (!id || isNaN(id)) return null;

  const [showDialog, setShowDialog] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedDetails, setEditedDetails] = useState(details);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const updateMutation = useUpdateActionStatus();

  const isPending = status === "pending";
  const isAds = isAdCampaign(intent, title);
  const connected = isPlatformConnected(platform);

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
          toast({ title: "Action approved", description: `${title} has been approved and queued.` });
          setShowDialog(false);
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
        onError: () => toast({ title: "Error", variant: "destructive" }),
      }
    );
  };

  const handleSaveEdit = () => {
    updateMutation.mutate(
      { id, data: { status: "approved", modifiedDetails: editedDetails } },
      {
        onSuccess: () => {
          setIsEditing(false);
          toast({ title: "Action modified", description: "Details updated." });
          invalidate();
        },
      }
    );
  };

  return (
    <>
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

          {/* Platform not connected warning */}
          {!connected && (
            <div className="mx-3 mt-3 flex items-center gap-2 px-3 py-2 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl">
              <AlertTriangle size={13} className="text-amber-500 flex-shrink-0" />
              <p className="text-[12px] text-amber-700 dark:text-amber-300 flex-1">
                <span className="font-semibold">{platform}</span> is not connected.{" "}
                <a href="/platforms" className="underline hover:no-underline font-medium">Connect →</a>
              </p>
            </div>
          )}

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
              <div className="text-[13px] text-foreground leading-relaxed whitespace-pre-line">
                {typeof details === "string" && details.trim().startsWith("{")
                  ? (() => {
                      const ad = parseAdDetails(details);
                      return ad
                        ? `${ad.objective ?? "Campaign"} · ${ad.duration ?? ""} · Budget: ${ad.dailyBudget ?? estimatedCost ?? "—"}`
                        : details;
                    })()
                  : details}
              </div>
            )}

            {estimatedCost && (
              <div className="flex items-center justify-between text-[12px]">
                <span className="text-muted-foreground">Estimated cost</span>
                <span className="font-medium text-foreground">{estimatedCost}</span>
              </div>
            )}
          </div>

          {/* Actions */}
          {isPending && (
            <div className="flex items-center gap-2 px-4 py-3 border-t border-card-border">
              {isEditing ? (
                <>
                  <button onClick={handleSaveEdit} disabled={updateMutation.isPending}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground text-[12.5px] font-medium rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
                    data-testid={`button-save-edit-${id}`}>
                    {updateMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}Save
                  </button>
                  <button onClick={() => { setIsEditing(false); setEditedDetails(details); }}
                    className="px-3 py-1.5 text-[12.5px] font-medium text-muted-foreground hover:text-foreground border border-border rounded-lg hover:bg-accent transition-colors"
                    data-testid={`button-cancel-edit-${id}`}>Cancel
                  </button>
                </>
              ) : isAds ? (
                /* Ad campaigns → open rich dialog */
                <button
                  onClick={() => setShowDialog(true)}
                  className="flex-1 flex items-center justify-center gap-2 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-[13px] font-semibold rounded-xl transition-colors"
                  data-testid={`button-review-${id}`}
                >
                  <ChevronRight size={15} />Review & Approve Campaign
                </button>
              ) : (
                <>
                  <button onClick={handleApprove} disabled={updateMutation.isPending}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white text-[12.5px] font-medium rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50"
                    data-testid={`button-approve-${id}`}>
                    {updateMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}Approve
                  </button>
                  <button onClick={handleReject} disabled={updateMutation.isPending}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-[12.5px] font-medium text-muted-foreground hover:text-foreground border border-border rounded-lg hover:bg-accent transition-colors disabled:opacity-50"
                    data-testid={`button-reject-${id}`}>
                    <X size={13} />Reject
                  </button>
                  <button onClick={() => setIsEditing(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-[12.5px] font-medium text-muted-foreground hover:text-foreground border border-border rounded-lg hover:bg-accent transition-colors ml-auto"
                    data-testid={`button-edit-${id}`}>
                    <Edit2 size={13} />Modify
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Rich Ad Campaign Dialog */}
      {showDialog && (
        <AdCampaignDialog
          id={id}
          title={title}
          platform={platform}
          riskLevel={riskLevel}
          estimatedCost={estimatedCost}
          details={details}
          onClose={() => setShowDialog(false)}
          onApprove={handleApprove}
          onReject={handleReject}
          onModify={() => { setShowDialog(false); setIsEditing(true); }}
          isLoading={updateMutation.isPending}
        />
      )}
    </>
  );
}

function PlatformIcon({ platform }: { platform: string }) {
  return (
    <div className="w-8 h-8 rounded-lg bg-muted/60 flex items-center justify-center flex-shrink-0 overflow-hidden">
      <BrandIcon platform={platform} size={20} />
    </div>
  );
}
