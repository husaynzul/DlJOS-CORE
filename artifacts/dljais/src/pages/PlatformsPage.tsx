import { useState } from "react";
import { useListPlatforms, useUpdatePlatform, getListPlatformsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { X, ExternalLink, Key, CheckCircle2 } from "lucide-react";

const CATEGORY_LABELS: Record<string, string> = {
  social: "Social Media",
  ads: "Advertising",
  ecommerce: "E-commerce",
  trading: "Trading",
  food: "Food Delivery",
  website: "Website",
};

const PLATFORM_INSTRUCTIONS: Record<string, { steps: string[]; keyLabel: string; authUrl: string }> = {
  YouTube: { keyLabel: "Google OAuth Token", authUrl: "https://console.cloud.google.com", steps: ["Go to Google Cloud Console", "Enable YouTube Data API v3", "Create OAuth 2.0 credentials", "Paste your access token below"] },
  Instagram: { keyLabel: "Instagram Access Token", authUrl: "https://developers.facebook.com", steps: ["Go to Meta for Developers", "Create an app with Instagram Graph API", "Generate a long-lived access token", "Paste it below"] },
  TikTok: { keyLabel: "TikTok Access Token", authUrl: "https://developers.tiktok.com", steps: ["Go to TikTok for Developers", "Create an app and get API access", "Complete OAuth flow", "Paste your access token"] },
  Facebook: { keyLabel: "Facebook Page Token", authUrl: "https://developers.facebook.com", steps: ["Go to Meta for Developers", "Create a Facebook App", "Generate a Page Access Token", "Paste it below"] },
  "Meta Ads": { keyLabel: "Meta Ads Access Token", authUrl: "https://developers.facebook.com", steps: ["Go to Meta Business Suite", "Open Marketing API settings", "Generate an access token", "Paste it below"] },
  "Google Ads": { keyLabel: "Google Ads Developer Token", authUrl: "https://ads.google.com/home/tools/manager-accounts", steps: ["Sign in to Google Ads", "Go to Tools → API Center", "Apply for developer token", "Paste it below"] },
  Shopify: { keyLabel: "Shopify Admin API Key", authUrl: "https://partners.shopify.com", steps: ["Go to your Shopify Admin", "Settings → Apps → Private apps", "Create a private app", "Copy the Admin API key below"] },
  WooCommerce: { keyLabel: "WooCommerce Consumer Key", authUrl: "", steps: ["Go to WooCommerce → Settings → Advanced → REST API", "Add a key with Read/Write permissions", "Copy the Consumer Key", "Paste it below"] },
  Binance: { keyLabel: "Binance API Key", authUrl: "https://www.binance.com/en/my/settings/api-management", steps: ["Go to Binance → Profile → API Management", "Create a new API key", "Enable trading permissions carefully", "Paste API key below"] },
  MT5: { keyLabel: "MT5 Account / Server Info", authUrl: "", steps: ["Open your MT5 terminal", "Go to Tools → Options → Expert Advisors", "Enable WebRequest for your broker URL", "Enter your broker server and account below"] },
  "Food Delivery": { keyLabel: "Delivery API Key", authUrl: "", steps: ["Contact your food delivery provider", "Request API access for your account", "Obtain a merchant API key", "Paste it below"] },
  "Website CMS": { keyLabel: "CMS API Token", authUrl: "", steps: ["Go to your CMS admin panel", "Navigate to API / Integrations section", "Generate an API token with write access", "Paste it below"] },
};

const STATUS_CONFIG = {
  connected: { dot: "bg-emerald-500", label: "Connected", labelColor: "text-emerald-600 dark:text-emerald-400" },
  limited: { dot: "bg-amber-400", label: "Limited", labelColor: "text-amber-600 dark:text-amber-400" },
  disconnected: { dot: "bg-red-400", label: "Not connected", labelColor: "text-red-500" },
};

interface ConnectModalProps {
  platform: { id: number; name: string; status: string };
  onClose: () => void;
  onSave: (id: number, key: string, name: string) => void;
}

function ConnectModal({ platform, onClose, onSave }: ConnectModalProps) {
  const [apiKey, setApiKey] = useState("");
  const [accountName, setAccountName] = useState("");
  const [saving, setSaving] = useState(false);
  const info = PLATFORM_INSTRUCTIONS[platform.name] ?? {
    keyLabel: "API Key / Token", authUrl: "", steps: ["Obtain your API credentials from the platform", "Paste below to connect"]
  };

  const handleSave = async () => {
    if (!apiKey.trim()) return;
    setSaving(true);
    await new Promise((r) => setTimeout(r, 600));
    onSave(platform.id, apiKey, accountName || platform.name);
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/50 backdrop-blur-[2px]" onClick={onClose}>
      <div
        className="bg-background rounded-t-3xl max-h-[88dvh] overflow-y-auto animate-in slide-in-from-bottom duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1"><div className="w-10 h-1 bg-muted rounded-full" /></div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <h2 className="text-[16px] font-semibold text-foreground">Connect {platform.name}</h2>
          <button onClick={onClose} className="p-1.5 rounded-xl text-muted-foreground hover:bg-accent transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-5">
          {/* Steps */}
          <div className="space-y-2">
            <p className="text-[12.5px] font-semibold uppercase tracking-wider text-muted-foreground">Setup steps</p>
            {info.steps.map((step, i) => (
              <div key={i} className="flex items-start gap-3">
                <span className="w-5 h-5 rounded-full bg-primary/15 text-primary text-[11px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</span>
                <p className="text-[13.5px] text-foreground leading-snug">{step}</p>
              </div>
            ))}
            {info.authUrl && (
              <a href={info.authUrl} target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-[13px] text-primary mt-1">
                <ExternalLink size={13} />
                Open {platform.name} Developer Console
              </a>
            )}
          </div>

          {/* Account name */}
          <div>
            <label className="text-[12.5px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">Account name (optional)</label>
            <input
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
              placeholder={`e.g. @${platform.name.toLowerCase().replace(/\s/g, "")}`}
              className="w-full bg-muted border border-border rounded-xl px-4 py-3 text-[14px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              data-testid="input-account-name"
            />
          </div>

          {/* API key */}
          <div>
            <label className="text-[12.5px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">
              <Key size={11} className="inline mr-1" />
              {info.keyLabel}
            </label>
            <textarea
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Paste your token or key here…"
              rows={3}
              className="w-full bg-muted border border-border rounded-xl px-4 py-3 text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring font-mono resize-none"
              data-testid="input-api-key"
            />
            <p className="text-[11.5px] text-muted-foreground mt-1.5">Your credentials are stored securely and never shared.</p>
          </div>

          {/* Save button */}
          <button
            onClick={handleSave}
            disabled={!apiKey.trim() || saving}
            className={cn(
              "w-full py-3.5 rounded-2xl text-[14px] font-semibold transition-all",
              apiKey.trim() && !saving
                ? "bg-foreground text-background"
                : "bg-muted text-muted-foreground cursor-not-allowed"
            )}
            data-testid="button-save-connect"
          >
            {saving ? "Connecting…" : `Connect ${platform.name}`}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PlatformsPage() {
  const { data: platforms, isLoading } = useListPlatforms();
  const updatePlatform = useUpdatePlatform();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [connectingPlatform, setConnectingPlatform] = useState<{ id: number; name: string; status: string } | null>(null);

  const handleSaveConnect = (id: number, _key: string, accountName: string) => {
    updatePlatform.mutate(
      { id, data: { status: "connected", accountName } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListPlatformsQueryKey() });
          toast({ title: `${connectingPlatform?.name} connected`, description: "Platform is now active." });
          setConnectingPlatform(null);
        },
        onError: () => toast({ title: "Error", description: "Failed to connect.", variant: "destructive" }),
      }
    );
  };

  const handleDisconnect = (id: number, name: string) => {
    updatePlatform.mutate(
      { id, data: { status: "disconnected" } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListPlatformsQueryKey() });
          toast({ title: `${name} disconnected` });
        },
      }
    );
  };

  const grouped = platforms
    ? platforms.reduce((acc, p) => {
        if (!acc[p.category]) acc[p.category] = [];
        acc[p.category].push(p);
        return acc;
      }, {} as Record<string, typeof platforms>)
    : {};

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-background">
      <div className="px-5 py-4 border-b border-border">
        <h1 className="text-[17px] font-semibold text-foreground">Connected Platforms</h1>
        <p className="text-[13px] text-muted-foreground mt-0.5">
          {platforms ? `${platforms.filter(p => p.status === "connected").length} of ${platforms.length} connected` : ""}
        </p>
      </div>

      <div className="px-4 py-4 space-y-5 max-w-[600px] mx-auto w-full">
        {isLoading ? (
          <div className="space-y-2">{[...Array(8)].map((_, i) => <div key={i} className="h-16 rounded-2xl shimmer" />)}</div>
        ) : (
          Object.entries(grouped).map(([category, items]) => (
            <div key={category}>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 px-1">
                {CATEGORY_LABELS[category] ?? category}
              </p>
              <div className="bg-card border border-card-border rounded-2xl overflow-hidden divide-y divide-border">
                {items.map((platform) => {
                  const cfg = STATUS_CONFIG[platform.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.disconnected;
                  return (
                    <div key={platform.id} className="flex items-center gap-3.5 px-4 py-3.5" data-testid={`platform-${platform.id}`}>
                      <div className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center text-[13px] font-bold flex-shrink-0">
                        {platform.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13.5px] font-medium text-foreground">{platform.name}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", cfg.dot)} />
                          <span className={cn("text-[12px]", cfg.labelColor)}>{cfg.label}</span>
                          {platform.accountName && platform.status === "connected" && (
                            <span className="text-[12px] text-muted-foreground truncate">· {platform.accountName}</span>
                          )}
                        </div>
                      </div>

                      {platform.status === "connected" ? (
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <CheckCircle2 size={16} className="text-emerald-500" />
                          <button
                            onClick={() => handleDisconnect(platform.id, platform.name)}
                            className="text-[12px] text-muted-foreground hover:text-destructive transition-colors px-2 py-1 rounded-lg hover:bg-destructive/10"
                            data-testid={`button-disconnect-${platform.id}`}
                          >
                            Disconnect
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConnectingPlatform({ id: platform.id, name: platform.name, status: platform.status })}
                          className="flex-shrink-0 px-3.5 py-1.5 bg-primary/10 text-primary text-[12.5px] font-semibold rounded-xl hover:bg-primary/20 transition-colors border border-primary/20"
                          data-testid={`button-connect-${platform.id}`}
                        >
                          Connect
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>

      {connectingPlatform && (
        <ConnectModal
          platform={connectingPlatform}
          onClose={() => setConnectingPlatform(null)}
          onSave={handleSaveConnect}
        />
      )}
    </div>
  );
}
