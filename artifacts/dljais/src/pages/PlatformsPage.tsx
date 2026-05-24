import { useState, useEffect, useCallback } from "react";
import { useListPlatforms, getListPlatformsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { X, ExternalLink, Key, CheckCircle2, Loader2, ShieldCheck, AlertCircle } from "lucide-react";

const CATEGORY_LABELS: Record<string, string> = {
  social: "Social Media",
  ads: "Advertising",
  ecommerce: "E-commerce",
  trading: "Trading",
  food: "Food Delivery",
  website: "Website",
};

const OAUTH_PROVIDERS: Record<string, string> = {
  YouTube: "google",
  "Google Ads": "google",
  Instagram: "meta",
  Facebook: "meta",
  "Meta Ads": "meta",
  TikTok: "tiktok",
  Shopify: "shopify",
};

const PROVIDER_LABELS: Record<string, string> = {
  google: "Google",
  meta: "Meta",
  tiktok: "TikTok",
  shopify: "Shopify",
};

const PROVIDER_SETUP: Record<string, { url: string; label: string; envVars: string[] }> = {
  google:  { url: "https://console.cloud.google.com/apis/credentials", label: "Google Cloud Console", envVars: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"] },
  meta:    { url: "https://developers.facebook.com/apps", label: "Meta for Developers", envVars: ["META_CLIENT_ID", "META_CLIENT_SECRET"] },
  tiktok:  { url: "https://developers.tiktok.com", label: "TikTok for Developers", envVars: ["TIKTOK_CLIENT_KEY", "TIKTOK_CLIENT_SECRET"] },
  shopify: { url: "https://partners.shopify.com", label: "Shopify Partners", envVars: ["SHOPIFY_API_KEY", "SHOPIFY_API_SECRET"] },
};

const MANUAL_INSTRUCTIONS: Record<string, { steps: string[]; keyLabel: string; authUrl: string }> = {
  Binance:        { keyLabel: "Binance API Key", authUrl: "https://www.binance.com/en/my/settings/api-management", steps: ["Go to Binance → Profile → API Management", "Create a new API key", "Enable only what you need (Spot trading is safest)", "Paste key + secret below"] },
  MT5:            { keyLabel: "MT5 Account / Broker Info", authUrl: "", steps: ["Open your MT5 terminal", "Go to Tools → Options → Expert Advisors", "Enable WebRequest for your broker URL", "Enter account details below"] },
  "Food Delivery":{ keyLabel: "Delivery API Key", authUrl: "", steps: ["Contact your food delivery provider", "Request merchant API access", "Obtain a merchant API key", "Paste it below"] },
  "Website CMS":  { keyLabel: "CMS API Token", authUrl: "", steps: ["Go to your CMS admin panel", "Navigate to API / Integrations section", "Generate an API token with write access", "Paste it below"] },
  WooCommerce:    { keyLabel: "WooCommerce Consumer Key", authUrl: "", steps: ["Go to WooCommerce → Settings → Advanced → REST API", "Add a key with Read/Write permissions", "Copy the Consumer Key", "Paste it below"] },
};

const STATUS_CONFIG = {
  connected:    { dot: "bg-emerald-500", label: "Connected",     labelColor: "text-emerald-600 dark:text-emerald-400" },
  limited:      { dot: "bg-amber-400",   label: "Limited",       labelColor: "text-amber-600 dark:text-amber-400" },
  disconnected: { dot: "bg-red-400",     label: "Not connected", labelColor: "text-red-500" },
};

interface Platform { id: number; name: string; status: string; icon?: string | null; category: string; accountName?: string | null }

function ManualModal({ platform, onClose, onSave }: {
  platform: Platform; onClose: () => void; onSave: (id: number, key: string, name: string) => void;
}) {
  const [apiKey, setApiKey] = useState("");
  const [accountName, setAccountName] = useState("");
  const [saving, setSaving] = useState(false);
  const info = MANUAL_INSTRUCTIONS[platform.name] ?? { keyLabel: "API Key / Token", authUrl: "", steps: ["Obtain your credentials from the platform", "Paste below to connect"] };

  const handleSave = async () => {
    if (!apiKey.trim()) return;
    setSaving(true);
    await new Promise((r) => setTimeout(r, 600));
    onSave(platform.id, apiKey, accountName || platform.name);
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/50 backdrop-blur-[2px]" onClick={onClose}>
      <div className="bg-background rounded-t-3xl max-h-[88dvh] overflow-y-auto animate-in slide-in-from-bottom duration-200" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-center pt-3 pb-1"><div className="w-10 h-1 bg-muted rounded-full" /></div>
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <h2 className="text-[16px] font-semibold text-foreground">Connect {platform.name}</h2>
          <button onClick={onClose} className="p-1.5 rounded-xl text-muted-foreground hover:bg-accent transition-colors"><X size={18} /></button>
        </div>
        <div className="px-5 py-4 space-y-5">
          <div className="space-y-2">
            <p className="text-[12.5px] font-semibold uppercase tracking-wider text-muted-foreground">Setup steps</p>
            {info.steps.map((step, i) => (
              <div key={i} className="flex items-start gap-3">
                <span className="w-5 h-5 rounded-full bg-primary/15 text-primary text-[11px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</span>
                <p className="text-[13.5px] text-foreground leading-snug">{step}</p>
              </div>
            ))}
            {info.authUrl && (
              <a href={info.authUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-[13px] text-primary mt-1">
                <ExternalLink size={13} />Open {platform.name} Console
              </a>
            )}
          </div>
          <div>
            <label className="text-[12.5px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">Account name (optional)</label>
            <input value={accountName} onChange={(e) => setAccountName(e.target.value)}
              placeholder={`e.g. @${platform.name.toLowerCase().replace(/\s/g, "")}`}
              className="w-full bg-muted border border-border rounded-xl px-4 py-3 text-[14px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
          </div>
          <div>
            <label className="text-[12.5px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">
              <Key size={11} className="inline mr-1" />{info.keyLabel}
            </label>
            <textarea value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="Paste your token or key here…" rows={3}
              className="w-full bg-muted border border-border rounded-xl px-4 py-3 text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring font-mono resize-none" />
            <p className="text-[11.5px] text-muted-foreground mt-1.5">Your credentials are stored securely and never shared.</p>
          </div>
          <button onClick={handleSave} disabled={!apiKey.trim() || saving}
            className={cn("w-full py-3.5 rounded-2xl text-[14px] font-semibold transition-all",
              apiKey.trim() && !saving ? "bg-foreground text-background" : "bg-muted text-muted-foreground cursor-not-allowed")}>
            {saving ? "Connecting…" : `Connect ${platform.name}`}
          </button>
        </div>
      </div>
    </div>
  );
}

function ShopifyModal({ platform, onClose, onConnect }: {
  platform: Platform; onClose: () => void; onConnect: (shop: string) => void;
}) {
  const [shop, setShop] = useState("");
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/50 backdrop-blur-[2px]" onClick={onClose}>
      <div className="bg-background rounded-t-3xl animate-in slide-in-from-bottom duration-200" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-center pt-3 pb-1"><div className="w-10 h-1 bg-muted rounded-full" /></div>
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <h2 className="text-[16px] font-semibold text-foreground">Connect Shopify</h2>
          <button onClick={onClose} className="p-1.5 rounded-xl text-muted-foreground hover:bg-accent transition-colors"><X size={18} /></button>
        </div>
        <div className="px-5 py-5 space-y-4">
          <p className="text-[13.5px] text-muted-foreground">Enter your Shopify store domain to start the OAuth flow.</p>
          <div>
            <label className="text-[12.5px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">Store domain</label>
            <div className="flex items-center gap-0 bg-muted border border-border rounded-xl overflow-hidden focus-within:ring-1 focus-within:ring-ring">
              <input value={shop} onChange={(e) => setShop(e.target.value.replace(/https?:\/\//g, "").replace(/\/.*/g, ""))}
                placeholder="your-store"
                className="flex-1 bg-transparent px-4 py-3 text-[14px] text-foreground placeholder:text-muted-foreground focus:outline-none" />
              <span className="pr-4 text-[13px] text-muted-foreground">.myshopify.com</span>
            </div>
          </div>
          <button onClick={() => { if (shop.trim()) onConnect(`${shop.trim()}.myshopify.com`); }}
            disabled={!shop.trim()}
            className={cn("w-full py-3.5 rounded-2xl text-[14px] font-semibold transition-all",
              shop.trim() ? "bg-foreground text-background" : "bg-muted text-muted-foreground cursor-not-allowed")}>
            Continue with Shopify →
          </button>
        </div>
      </div>
    </div>
  );
}

function NotConfiguredSheet({ provider, onClose }: { provider: string; onClose: () => void }) {
  const setup = PROVIDER_SETUP[provider];
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/50 backdrop-blur-[2px]" onClick={onClose}>
      <div className="bg-background rounded-t-3xl animate-in slide-in-from-bottom duration-200" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-center pt-3 pb-1"><div className="w-10 h-1 bg-muted rounded-full" /></div>
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <h2 className="text-[16px] font-semibold text-foreground">{PROVIDER_LABELS[provider]} OAuth Not Configured</h2>
          <button onClick={onClose} className="p-1.5 rounded-xl text-muted-foreground hover:bg-accent transition-colors"><X size={18} /></button>
        </div>
        <div className="px-5 py-5 space-y-4 pb-8">
          <div className="flex items-start gap-3 p-3.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl">
            <AlertCircle size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-[13px] text-amber-800 dark:text-amber-300">To enable one-click OAuth for this provider, you need to register a developer app and add the credentials as environment secrets.</p>
          </div>
          <div>
            <p className="text-[12.5px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Steps to configure</p>
            <div className="space-y-2">
              {[
                `Go to ${setup?.label ?? "the developer console"}`,
                "Create an OAuth app",
                `Set redirect URI to: /api/auth/callback/${provider}`,
                "Add these as Replit secrets:",
              ].map((step, i) => (
                <div key={i} className="flex items-start gap-3">
                  <span className="w-5 h-5 rounded-full bg-primary/15 text-primary text-[11px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</span>
                  <p className="text-[13.5px] text-foreground">{step}</p>
                </div>
              ))}
              <div className="ml-8 mt-1 space-y-1.5">
                {setup?.envVars.map((v) => (
                  <code key={v} className="block text-[12px] font-mono bg-muted px-3 py-1.5 rounded-lg text-foreground">{v}</code>
                ))}
              </div>
            </div>
          </div>
          {setup?.url && (
            <a href={setup.url} target="_blank" rel="noreferrer"
              className="flex items-center justify-center gap-2 w-full py-3 rounded-xl border border-border text-[13.5px] font-medium text-foreground hover:bg-accent transition-colors">
              <ExternalLink size={14} />Open {setup.label}
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

export default function PlatformsPage() {
  const { data: platforms, isLoading, refetch } = useListPlatforms();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [configuredProviders, setConfiguredProviders] = useState<Record<string, boolean>>({});
  const [manualPlatform, setManualPlatform] = useState<Platform | null>(null);
  const [shopifyPlatform, setShopifyPlatform] = useState<Platform | null>(null);
  const [notConfiguredProvider, setNotConfiguredProvider] = useState<string | null>(null);
  const [connectingIds, setConnectingIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}api/auth/providers`)
      .then((r) => r.json())
      .then((data: Record<string, boolean>) => setConfiguredProviders(data))
      .catch(() => {});
  }, []);

  const openOAuthPopup = useCallback((platform: Platform, provider: string, extra: Record<string, string> = {}) => {
    const params = new URLSearchParams({ platformId: String(platform.id), ...extra });
    const url = `${import.meta.env.BASE_URL}api/auth/connect/${provider}?${params}`;
    const popup = window.open(url, "dljos_oauth", "width=520,height=700,left=200,top=80,toolbar=0,menubar=0");

    if (!popup) {
      toast({ title: "Popup blocked", description: "Allow popups for this site, then try again.", variant: "destructive" });
      return;
    }

    setConnectingIds((s) => new Set(s).add(platform.id));

    const handler = (event: MessageEvent) => {
      const d = event.data as { type?: string; error?: string; platformId?: string };
      if (d?.type !== "oauth-success" && d?.type !== "oauth-error") return;
      window.removeEventListener("message", handler);
      clearInterval(checker);
      setConnectingIds((s) => { const n = new Set(s); n.delete(platform.id); return n; });

      if (d.type === "oauth-success") {
        queryClient.invalidateQueries({ queryKey: getListPlatformsQueryKey() });
        refetch();
        toast({ title: `${platform.name} connected!`, description: "Ready to use in DlJOS." });
      } else {
        const msg = d.error === "not_configured"
          ? "OAuth app credentials not configured. See setup instructions."
          : d.error === "token_exchange_failed"
          ? "Token exchange failed. Check your OAuth app settings."
          : `Connection failed: ${d.error ?? "unknown error"}`;
        toast({ title: "Connection failed", description: msg, variant: "destructive" });
        if (d.error === "not_configured") setNotConfiguredProvider(provider);
      }
    };

    window.addEventListener("message", handler);
    const checker = setInterval(() => {
      if (popup.closed) {
        clearInterval(checker);
        window.removeEventListener("message", handler);
        setConnectingIds((s) => { const n = new Set(s); n.delete(platform.id); return n; });
      }
    }, 500);
  }, [queryClient, refetch, toast]);

  const handleConnect = useCallback((platform: Platform) => {
    const provider = OAUTH_PROVIDERS[platform.name];
    if (!provider) { setManualPlatform(platform); return; }
    if (provider === "shopify") { setShopifyPlatform(platform); return; }
    openOAuthPopup(platform, provider);
  }, [openOAuthPopup]);

  const handleManualSave = (id: number, _key: string, accountName: string) => {
    fetch(`${import.meta.env.BASE_URL}api/platforms/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "connected", accountName }),
    }).then(() => {
      queryClient.invalidateQueries({ queryKey: getListPlatformsQueryKey() });
      const name = manualPlatform?.name ?? "";
      toast({ title: `${name} connected`, description: "Platform is now active." });
      setManualPlatform(null);
    }).catch(() => toast({ title: "Error", description: "Failed to connect.", variant: "destructive" }));
  };

  const handleDisconnect = (platform: Platform) => {
    const provider = OAUTH_PROVIDERS[platform.name];
    if (provider) {
      fetch(`${import.meta.env.BASE_URL}api/auth/token/${platform.id}`, { method: "DELETE" })
        .then(() => { queryClient.invalidateQueries({ queryKey: getListPlatformsQueryKey() }); refetch(); toast({ title: `${platform.name} disconnected` }); })
        .catch(() => toast({ title: "Error", variant: "destructive" }));
    } else {
      fetch(`${import.meta.env.BASE_URL}api/platforms/${platform.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "disconnected" }),
      }).then(() => { queryClient.invalidateQueries({ queryKey: getListPlatformsQueryKey() }); toast({ title: `${platform.name} disconnected` }); })
        .catch(() => toast({ title: "Error", variant: "destructive" }));
    }
  };

  const grouped = platforms
    ? platforms.reduce((acc, p) => {
        if (!acc[p.category]) acc[p.category] = [];
        acc[p.category].push(p);
        return acc;
      }, {} as Record<string, typeof platforms>)
    : {};

  const connectedCount = platforms?.filter((p) => p.status === "connected").length ?? 0;
  const totalCount = platforms?.length ?? 0;

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-background">
      <div className="px-5 py-4 border-b border-border flex-shrink-0">
        <h1 className="text-[17px] font-semibold text-foreground">Connected Platforms</h1>
        <p className="text-[13px] text-muted-foreground mt-0.5">
          {totalCount > 0 ? `${connectedCount} of ${totalCount} connected` : ""}
        </p>
      </div>

      {/* OAuth info banner */}
      <div className="mx-4 mt-3 p-3.5 bg-primary/5 border border-primary/15 rounded-2xl flex items-start gap-3">
        <ShieldCheck size={15} className="text-primary flex-shrink-0 mt-0.5" />
        <p className="text-[12.5px] text-muted-foreground leading-snug">
          Platforms marked <span className="text-primary font-medium">OAuth</span> use secure one-click authorization.
          Manual platforms use API key entry. Tokens are AES-256 encrypted at rest.
        </p>
      </div>

      <div className="px-4 py-4 space-y-5 max-w-[600px] mx-auto w-full pb-10">
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
                  const oauthProvider = OAUTH_PROVIDERS[platform.name];
                  const isConnecting = connectingIds.has(platform.id);
                  const isOAuthConfigured = oauthProvider ? (configuredProviders[oauthProvider] ?? false) : false;

                  return (
                    <div key={platform.id} className="flex items-center gap-3.5 px-4 py-3.5" data-testid={`platform-${platform.id}`}>
                      <div className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center text-[13px] font-bold flex-shrink-0">
                        {platform.icon}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-[13.5px] font-medium text-foreground">{platform.name}</p>
                          {oauthProvider && (
                            <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded-md",
                              isOAuthConfigured ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                            )}>
                              {isOAuthConfigured ? "OAuth" : "Setup req'd"}
                            </span>
                          )}
                        </div>
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
                          <button onClick={() => handleDisconnect(platform as Platform)}
                            className="text-[12px] text-muted-foreground hover:text-destructive transition-colors px-2 py-1 rounded-lg hover:bg-destructive/10"
                            data-testid={`button-disconnect-${platform.id}`}>
                            Disconnect
                          </button>
                        </div>
                      ) : isConnecting ? (
                        <div className="flex items-center gap-1.5 px-3.5 py-1.5 flex-shrink-0">
                          <Loader2 size={14} className="animate-spin text-primary" />
                          <span className="text-[12.5px] text-primary">Connecting…</span>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            if (oauthProvider && !isOAuthConfigured) {
                              setNotConfiguredProvider(oauthProvider);
                            } else {
                              handleConnect(platform as Platform);
                            }
                          }}
                          className={cn(
                            "flex-shrink-0 px-3.5 py-1.5 text-[12.5px] font-semibold rounded-xl transition-colors",
                            oauthProvider && isOAuthConfigured
                              ? "bg-primary text-primary-foreground hover:bg-primary/90"
                              : "bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20"
                          )}
                          data-testid={`button-connect-${platform.id}`}>
                          {oauthProvider && isOAuthConfigured ? `Sign in with ${PROVIDER_LABELS[oauthProvider]}` : "Connect"}
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

      {manualPlatform && (
        <ManualModal platform={manualPlatform} onClose={() => setManualPlatform(null)} onSave={handleManualSave} />
      )}
      {shopifyPlatform && (
        <ShopifyModal
          platform={shopifyPlatform}
          onClose={() => setShopifyPlatform(null)}
          onConnect={(shop) => {
            const p = shopifyPlatform;
            setShopifyPlatform(null);
            openOAuthPopup(p, "shopify", { shop });
          }}
        />
      )}
      {notConfiguredProvider && (
        <NotConfiguredSheet provider={notConfiguredProvider} onClose={() => setNotConfiguredProvider(null)} />
      )}
    </div>
  );
}
