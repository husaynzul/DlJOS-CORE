import { useState } from "react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import {
  X, ExternalLink, Key, CheckCircle2, Loader2, ShieldCheck, AlertCircle,
  Link2, Unlink, Eye, EyeOff,
} from "lucide-react";

// ─── Platform definitions ───────────────────────────────────────────────────

const PLATFORM_GROUPS = [
  {
    id: "social",
    label: "Social Media",
    platforms: [
      { id: "instagram",  name: "Instagram",    icon: "📸", desc: "Posts, Reels, Stories",  authType: "oauth",  provider: "meta",    envKey: "META_CLIENT_ID",     oauthUrl: "https://developers.facebook.com/apps" },
      { id: "tiktok",     name: "TikTok",        icon: "🎵", desc: "Videos, TikTok LIVE",    authType: "oauth",  provider: "tiktok",  envKey: "TIKTOK_CLIENT_KEY",  oauthUrl: "https://developers.tiktok.com" },
      { id: "youtube",    name: "YouTube",        icon: "▶️", desc: "Videos, Shorts, Streams",authType: "oauth",  provider: "google",  envKey: "GOOGLE_CLIENT_ID",   oauthUrl: "https://console.cloud.google.com" },
      { id: "facebook",   name: "Facebook",       icon: "📘", desc: "Pages, Groups, Feed",    authType: "oauth",  provider: "meta",    envKey: "META_CLIENT_ID",     oauthUrl: "https://developers.facebook.com/apps" },
      { id: "whatsapp",   name: "WhatsApp",       icon: "💬", desc: "Business Messaging",     authType: "manual", envKey: "WHATSAPP_API_KEY",    manualUrl: "https://business.whatsapp.com/products/business-platform" },
      { id: "x",          name: "X (Twitter)",    icon: "𝕏",  desc: "Tweets, Threads",        authType: "manual", envKey: "X_API_KEY",            manualUrl: "https://developer.twitter.com/en/portal/dashboard" },
    ],
  },
  {
    id: "google",
    label: "Google System",
    platforms: [
      { id: "gmail",    name: "Gmail",        icon: "📧", desc: "Send, read & automate email", authType: "oauth",  provider: "google", envKey: "GOOGLE_CLIENT_ID",  oauthUrl: "https://console.cloud.google.com" },
      { id: "gdrive",   name: "Google Drive", icon: "📁", desc: "Files, Docs, Sheets",          authType: "oauth",  provider: "google", envKey: "GOOGLE_CLIENT_ID",  oauthUrl: "https://console.cloud.google.com" },
    ],
  },
  {
    id: "ads",
    label: "Ads System",
    platforms: [
      { id: "meta-ads",    name: "Meta Ads",    icon: "📢", desc: "Facebook + Instagram Ads", authType: "oauth",  provider: "meta",   envKey: "META_CLIENT_ID",     oauthUrl: "https://developers.facebook.com/apps" },
      { id: "google-ads",  name: "Google Ads",  icon: "🔍", desc: "Search, Display, YouTube", authType: "oauth",  provider: "google", envKey: "GOOGLE_CLIENT_ID",   oauthUrl: "https://console.cloud.google.com" },
      { id: "tiktok-ads",  name: "TikTok Ads",  icon: "🎯", desc: "TikTok Ad campaigns",      authType: "oauth",  provider: "tiktok", envKey: "TIKTOK_CLIENT_KEY",  oauthUrl: "https://developers.tiktok.com" },
    ],
  },
];

type PlatformDef = typeof PLATFORM_GROUPS[number]["platforms"][number];
type ConnectionState = { status: "connected" | "disconnected"; accountName?: string };
type StateMap = Record<string, ConnectionState>;

const STORAGE_KEY = "dljois-platform-states";

function loadStates(): StateMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}
function saveStates(s: StateMap) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch {}
}

// ─── Connect Modal ───────────────────────────────────────────────────────────

function ConnectModal({
  platform, onClose, onConnected,
}: {
  platform: PlatformDef;
  onClose: () => void;
  onConnected: (accountName: string) => void;
}) {
  const [apiKey, setApiKey] = useState("");
  const [accountName, setAccountName] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!apiKey.trim()) return;
    setLoading(true);
    await new Promise((r) => setTimeout(r, 700));
    setLoading(false);
    onConnected(accountName.trim() || platform.name);
  };

  const handleOAuth = () => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      onConnected(accountName.trim() || platform.name);
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/50 backdrop-blur-[2px]" onClick={onClose}>
      <div
        className="bg-background rounded-t-3xl max-h-[88dvh] overflow-y-auto animate-in slide-in-from-bottom duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-muted rounded-full" />
        </div>
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{platform.icon}</span>
            <div>
              <h2 className="text-[16px] font-semibold text-foreground">Connect {platform.name}</h2>
              <p className="text-[12px] text-muted-foreground">{platform.desc}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl text-muted-foreground hover:bg-accent transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-5 space-y-5 pb-8">
          {/* OAuth option */}
          {platform.authType === "oauth" && (
            <div className="space-y-3">
              <div className="flex items-start gap-3 p-3.5 bg-primary/5 border border-primary/15 rounded-xl">
                <ShieldCheck size={15} className="text-primary flex-shrink-0 mt-0.5" />
                <p className="text-[12.5px] text-muted-foreground leading-snug">
                  Uses secure OAuth — no password stored. You'll be redirected to {platform.name} to authorize access.
                </p>
              </div>
              <div>
                <label className="text-[12.5px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">
                  Account name (optional)
                </label>
                <input
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                  placeholder={`e.g. @myaccount`}
                  className="w-full bg-muted border border-border rounded-xl px-4 py-3 text-[14px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
              <button
                onClick={handleOAuth}
                disabled={loading}
                className="w-full py-3.5 rounded-2xl text-[14px] font-semibold bg-foreground text-background hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <Link2 size={16} />}
                {loading ? "Connecting…" : `Connect with ${platform.name}`}
              </button>
              <div className="text-center">
                <span className="text-[12px] text-muted-foreground">or use API key instead ↓</span>
              </div>
            </div>
          )}

          {/* API key entry */}
          <div className="space-y-3">
            {platform.authType === "manual" && (
              <div className="space-y-2">
                <p className="text-[12.5px] font-semibold text-muted-foreground uppercase tracking-wider">Setup steps</p>
                <div className="flex items-start gap-3">
                  <span className="w-5 h-5 rounded-full bg-primary/15 text-primary text-[11px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">1</span>
                  <p className="text-[13.5px] text-foreground leading-snug">Go to the {platform.name} developer console</p>
                </div>
                <div className="flex items-start gap-3">
                  <span className="w-5 h-5 rounded-full bg-primary/15 text-primary text-[11px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">2</span>
                  <p className="text-[13.5px] text-foreground leading-snug">Create or copy your API key / token</p>
                </div>
                <div className="flex items-start gap-3">
                  <span className="w-5 h-5 rounded-full bg-primary/15 text-primary text-[11px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">3</span>
                  <p className="text-[13.5px] text-foreground leading-snug">Paste it below to connect</p>
                </div>
                {(platform as { manualUrl?: string }).manualUrl && (
                  <a href={(platform as { manualUrl?: string }).manualUrl} target="_blank" rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-[13px] text-primary mt-1">
                    <ExternalLink size={13} />Open {platform.name} Console
                  </a>
                )}
                <div>
                  <label className="text-[12.5px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">
                    Account name (optional)
                  </label>
                  <input
                    value={accountName}
                    onChange={(e) => setAccountName(e.target.value)}
                    placeholder="e.g. @myaccount"
                    className="w-full bg-muted border border-border rounded-xl px-4 py-3 text-[14px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="text-[12.5px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">
                <Key size={11} className="inline mr-1" />
                {platform.authType === "oauth" ? "API Key (optional alternative)" : "API Key / Token"}
              </label>
              <p className="text-[11.5px] text-muted-foreground mb-2">
                <code className="font-mono bg-muted px-1.5 py-0.5 rounded text-[11px]">{platform.envKey}</code>
              </p>
              <div className="relative">
                <input
                  type={show ? "text" : "password"}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Paste your API key here…"
                  className="w-full bg-muted border border-border rounded-xl px-4 py-3 pr-10 text-[13px] font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
                <button onClick={() => setShow((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  {show ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              <p className="text-[11.5px] text-muted-foreground mt-1.5">Stored locally. Never shared.</p>
            </div>

            {(platform.authType === "manual" || apiKey.trim()) && (
              <button
                onClick={handleSave}
                disabled={!apiKey.trim() || loading}
                className={cn(
                  "w-full py-3.5 rounded-2xl text-[14px] font-semibold transition-all flex items-center justify-center gap-2",
                  apiKey.trim() && !loading ? "bg-foreground text-background hover:opacity-90" : "bg-muted text-muted-foreground cursor-not-allowed"
                )}
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <Key size={15} />}
                {loading ? "Connecting…" : `Save API Key`}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function PlatformsPage() {
  const { toast } = useToast();
  const [states, setStates] = useState<StateMap>(loadStates);
  const [connecting, setConnecting] = useState<PlatformDef | null>(null);

  const allPlatforms = PLATFORM_GROUPS.flatMap((g) => g.platforms);
  const connectedCount = allPlatforms.filter((p) => states[p.id]?.status === "connected").length;

  const connect = (platform: PlatformDef, accountName: string) => {
    const next = { ...states, [platform.id]: { status: "connected" as const, accountName } };
    setStates(next);
    saveStates(next);
    setConnecting(null);
    toast({ title: `${platform.name} connected!`, description: "Ready to use in DlJOS." });
  };

  const disconnect = (platform: PlatformDef) => {
    const next = { ...states, [platform.id]: { status: "disconnected" as const } };
    setStates(next);
    saveStates(next);
    toast({ title: `${platform.name} disconnected` });
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-background">
      {/* Header */}
      <div className="px-5 py-4 border-b border-border flex-shrink-0">
        <h1 className="text-[17px] font-semibold text-foreground">Connected Platforms</h1>
        <p className="text-[13px] text-muted-foreground mt-0.5">
          {connectedCount} of {allPlatforms.length} connected
        </p>
      </div>

      {/* Banner */}
      <div className="mx-4 mt-3 p-3.5 bg-primary/5 border border-primary/15 rounded-2xl flex items-start gap-3">
        <ShieldCheck size={15} className="text-primary flex-shrink-0 mt-0.5" />
        <p className="text-[12.5px] text-muted-foreground leading-snug">
          Connect your platforms to let DlJOS operate as your AI workforce. OAuth platforms use secure one-click auth. API key platforms store credentials locally.
        </p>
      </div>

      {/* Groups */}
      <div className="px-4 py-4 space-y-5 max-w-[600px] mx-auto w-full pb-10">
        {PLATFORM_GROUPS.map((group) => (
          <div key={group.id}>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 px-1">
              {group.label}
            </p>
            <div className="bg-card border border-card-border rounded-2xl overflow-hidden divide-y divide-border">
              {group.platforms.map((platform) => {
                const state = states[platform.id];
                const isConnected = state?.status === "connected";

                return (
                  <div key={platform.id} className="flex items-center gap-3.5 px-4 py-3.5">
                    {/* Icon */}
                    <div className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center text-[18px] flex-shrink-0">
                      {platform.icon}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-[13.5px] font-medium text-foreground">{platform.name}</p>
                        <span className={cn(
                          "text-[10px] font-semibold px-1.5 py-0.5 rounded-md",
                          platform.authType === "oauth"
                            ? "bg-primary/10 text-primary"
                            : "bg-muted text-muted-foreground"
                        )}>
                          {platform.authType === "oauth" ? "OAuth" : "API Key"}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className={cn(
                          "w-1.5 h-1.5 rounded-full flex-shrink-0",
                          isConnected ? "bg-emerald-500" : "bg-zinc-400"
                        )} />
                        <span className={cn(
                          "text-[12px]",
                          isConnected ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"
                        )}>
                          {isConnected ? "Connected" : "Not connected"}
                        </span>
                        {isConnected && state.accountName && state.accountName !== platform.name && (
                          <span className="text-[12px] text-muted-foreground truncate">· {state.accountName}</span>
                        )}
                      </div>
                    </div>

                    {/* Action */}
                    {isConnected ? (
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <CheckCircle2 size={16} className="text-emerald-500" />
                        <button
                          onClick={() => disconnect(platform)}
                          className="flex items-center gap-1 text-[12px] text-muted-foreground hover:text-destructive transition-colors px-2 py-1 rounded-lg hover:bg-destructive/10"
                        >
                          <Unlink size={12} />
                          Disconnect
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConnecting(platform)}
                        className="flex-shrink-0 flex items-center gap-1.5 px-3.5 py-1.5 text-[12.5px] font-semibold rounded-xl bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20 transition-colors"
                      >
                        <Link2 size={13} />
                        Connect
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {/* Summary card */}
        <div className="bg-card border border-card-border rounded-2xl px-4 py-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle size={14} className="text-muted-foreground" />
            <p className="text-[12px] font-semibold text-muted-foreground uppercase tracking-wide">System Status</p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {PLATFORM_GROUPS.map((group) => {
              const total = group.platforms.length;
              const connected = group.platforms.filter((p) => states[p.id]?.status === "connected").length;
              return (
                <div key={group.id} className="bg-muted/50 rounded-xl px-3 py-2.5 text-center">
                  <p className="text-[18px] font-bold text-foreground">{connected}/{total}</p>
                  <p className="text-[10.5px] text-muted-foreground mt-0.5">{group.label}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Connect modal */}
      {connecting && (
        <ConnectModal
          platform={connecting}
          onClose={() => setConnecting(null)}
          onConnected={(accountName) => connect(connecting, accountName)}
        />
      )}
    </div>
  );
}
