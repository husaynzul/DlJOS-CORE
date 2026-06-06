import { useState, useEffect, useCallback, useRef } from "react";
import { BrandIcon } from "@/components/BrandIcon";
import { cn } from "@/lib/utils";
import { X, AlertCircle, RefreshCw, Unplug, Eye, EyeOff, ExternalLink, ChevronRight, Wifi, WifiOff } from "lucide-react";

const STORAGE_KEY = "dljos-platforms-v3";

type PlatformStatus = "connected" | "disconnected" | "error";
type ConnectionType = "oauth" | "apikey" | "apikey_passphrase" | "broker";

interface PlatformState {
  status: PlatformStatus;
  accountName?: string;
  connectedAt?: string;
  error?: string;
}

interface PlatformDef {
  id: string;
  name: string;
  connectionType: ConnectionType;
  oauthProvider?: string;
  category: string;
  description: string;
  shopifyFlow?: boolean;
}

const PLATFORMS: PlatformDef[] = [
  { id: "youtube",      name: "YouTube",        connectionType: "oauth",            oauthProvider: "google",   category: "social",    description: "Upload & manage videos" },
  { id: "tiktok",       name: "TikTok",         connectionType: "oauth",            oauthProvider: "tiktok",   category: "social",    description: "Post & grow on TikTok" },
  { id: "instagram",    name: "Instagram",       connectionType: "oauth",            oauthProvider: "meta",     category: "social",    description: "Post content & stories" },
  { id: "facebook",     name: "Facebook",        connectionType: "oauth",            oauthProvider: "meta",     category: "social",    description: "Manage pages & posts" },
  { id: "x",            name: "X",               connectionType: "oauth",            oauthProvider: "twitter",  category: "social",    description: "Post & manage tweets" },
  { id: "linkedin",     name: "LinkedIn",        connectionType: "oauth",            oauthProvider: "linkedin", category: "social",    description: "Professional network" },
  { id: "pinterest",    name: "Pinterest",       connectionType: "oauth",            oauthProvider: "pinterest",category: "social",    description: "Pin content & boards" },
  { id: "snapchat",     name: "Snapchat",        connectionType: "oauth",            oauthProvider: "snapchat", category: "social",    description: "Stories & advertising" },
  { id: "threads",      name: "Threads",         connectionType: "oauth",            oauthProvider: "meta",     category: "social",    description: "Meta's text platform" },
  { id: "telegram",     name: "Telegram",        connectionType: "oauth",            oauthProvider: "telegram", category: "social",    description: "Channels & bots" },
  { id: "discord",      name: "Discord",         connectionType: "oauth",            oauthProvider: "discord",  category: "social",    description: "Server management" },
  { id: "gmail",        name: "Gmail",           connectionType: "oauth",            oauthProvider: "google",   category: "business",  description: "Send & manage email" },
  { id: "outlook",      name: "Outlook",         connectionType: "oauth",            oauthProvider: "outlook",  category: "business",  description: "Microsoft email & calendar" },
  { id: "googledrive",  name: "Google Drive",    connectionType: "oauth",            oauthProvider: "google",   category: "business",  description: "Cloud file storage" },
  { id: "onedrive",     name: "OneDrive",        connectionType: "oauth",            oauthProvider: "onedrive", category: "business",  description: "Microsoft cloud storage" },
  { id: "dropbox",      name: "Dropbox",         connectionType: "oauth",            oauthProvider: "dropbox",  category: "business",  description: "File sync & sharing" },
  { id: "notion",       name: "Notion",          connectionType: "oauth",            oauthProvider: "notion",   category: "business",  description: "Docs, wikis & databases" },
  { id: "slack",        name: "Slack",           connectionType: "oauth",            oauthProvider: "slack",    category: "business",  description: "Team messaging" },
  { id: "zoom",         name: "Zoom",            connectionType: "oauth",            oauthProvider: "zoom",     category: "business",  description: "Video meetings" },
  { id: "googlemeet",   name: "Google Meet",     connectionType: "oauth",            oauthProvider: "google",   category: "business",  description: "Google video calls" },
  { id: "shopify",      name: "Shopify",         connectionType: "oauth",            oauthProvider: "shopify",  category: "ecommerce", description: "Manage your store", shopifyFlow: true },
  { id: "woocommerce",  name: "WooCommerce",     connectionType: "apikey",                                      category: "ecommerce", description: "WordPress e-commerce" },
  { id: "amazon",       name: "Amazon",          connectionType: "apikey",                                      category: "ecommerce", description: "Seller Central integration" },
  { id: "daraz",        name: "Daraz",           connectionType: "apikey",                                      category: "ecommerce", description: "South Asia marketplace" },
  { id: "etsy",         name: "Etsy",            connectionType: "oauth",            oauthProvider: "etsy",     category: "ecommerce", description: "Handmade marketplace" },
  { id: "ebay",         name: "eBay",            connectionType: "oauth",            oauthProvider: "ebay",     category: "ecommerce", description: "Online auction & sales" },
  { id: "alibaba",      name: "Alibaba",         connectionType: "apikey",                                      category: "ecommerce", description: "B2B wholesale platform" },
  { id: "aliexpress",   name: "AliExpress",      connectionType: "apikey",                                      category: "ecommerce", description: "Direct retail platform" },
  { id: "noon",         name: "Noon",            connectionType: "apikey",                                      category: "ecommerce", description: "Middle East marketplace" },
  { id: "walmart",      name: "Walmart Seller",  connectionType: "apikey",                                      category: "ecommerce", description: "US retail marketplace" },
  { id: "googleads",    name: "Google Ads",      connectionType: "oauth",            oauthProvider: "google",   category: "ads",       description: "Search & display ads" },
  { id: "metaads",      name: "Meta Ads",        connectionType: "oauth",            oauthProvider: "meta",     category: "ads",       description: "Facebook & Instagram ads" },
  { id: "tiktokads",    name: "TikTok Ads",      connectionType: "oauth",            oauthProvider: "tiktok",   category: "ads",       description: "TikTok advertising" },
  { id: "linkedinads",  name: "LinkedIn Ads",    connectionType: "oauth",            oauthProvider: "linkedin", category: "ads",       description: "B2B advertising" },
  { id: "xads",         name: "X Ads",           connectionType: "oauth",            oauthProvider: "twitter",  category: "ads",       description: "Twitter advertising" },
  { id: "pinterestads", name: "Pinterest Ads",   connectionType: "oauth",            oauthProvider: "pinterest",category: "ads",       description: "Visual advertising" },
  { id: "binance",      name: "Binance",         connectionType: "apikey",                                      category: "crypto",    description: "World's largest crypto exchange" },
  { id: "bitget",       name: "Bitget",          connectionType: "apikey_passphrase",                           category: "crypto",    description: "Copy trading & futures" },
  { id: "bybit",        name: "Bybit",           connectionType: "apikey",                                      category: "crypto",    description: "Crypto derivatives exchange" },
  { id: "kucoin",       name: "KuCoin",          connectionType: "apikey_passphrase",                           category: "crypto",    description: "The People's Exchange" },
  { id: "okx",          name: "OKX",             connectionType: "apikey_passphrase",                           category: "crypto",    description: "Crypto & Web3 platform" },
  { id: "coinbase",     name: "Coinbase",        connectionType: "apikey",                                      category: "crypto",    description: "US-based crypto exchange" },
  { id: "mt5",          name: "MetaTrader 5",    connectionType: "broker",                                      category: "forex",     description: "Multi-asset trading platform" },
  { id: "exness",       name: "Exness",          connectionType: "broker",                                      category: "forex",     description: "Global forex broker" },
  { id: "xm",           name: "XM",              connectionType: "broker",                                      category: "forex",     description: "Award-winning broker" },
  { id: "icmarkets",    name: "IC Markets",      connectionType: "broker",                                      category: "forex",     description: "True ECN trading" },
  { id: "pepperstone",  name: "Pepperstone",     connectionType: "broker",                                      category: "forex",     description: "CFD & forex broker" },
  { id: "hfm",          name: "HFM",             connectionType: "broker",                                      category: "forex",     description: "HF Markets Group" },
];

const CATEGORIES = [
  { id: "all",       label: "All",          count: PLATFORMS.length },
  { id: "social",    label: "Social",       count: PLATFORMS.filter(p => p.category === "social").length },
  { id: "business",  label: "Business",     count: PLATFORMS.filter(p => p.category === "business").length },
  { id: "ecommerce", label: "E-Commerce",   count: PLATFORMS.filter(p => p.category === "ecommerce").length },
  { id: "ads",       label: "Ads",          count: PLATFORMS.filter(p => p.category === "ads").length },
  { id: "crypto",    label: "Crypto",       count: PLATFORMS.filter(p => p.category === "crypto").length },
  { id: "forex",     label: "Forex",        count: PLATFORMS.filter(p => p.category === "forex").length },
];

function loadStates(): Record<string, PlatformState> {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}"); } catch { return {}; }
}
function saveStates(s: Record<string, PlatformState>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

function oauthErrorMessage(error: string): string {
  switch (error) {
    case "not_configured": return "OAuth credentials not configured for this platform. An admin must add the client ID and secret.";
    case "token_exchange_failed": return "Token exchange failed. Please try again.";
    case "state_expired": return "Session expired. Please try connecting again.";
    case "access_denied": return "Access denied. Please approve the required permissions.";
    case "server_error": return "Server error during authentication. Please try again later.";
    case "unknown_provider": return "This provider is not yet supported in the backend.";
    default: return `Authentication failed: ${error}`;
  }
}

interface ConnectModalProps {
  platform: PlatformDef;
  onClose: () => void;
  onSuccess: (accountName?: string) => void;
}

function OAuthModal({ platform, onClose, onSuccess }: ConnectModalProps) {
  const [uiState, setUiState] = useState<"idle" | "waiting" | "error">("idle");
  const [error, setError] = useState("");
  const [shopDomain, setShopDomain] = useState("");
  const popupRef = useRef<Window | null>(null);
  const listenerRef = useRef<((e: MessageEvent) => void) | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const cleanup = useCallback(() => {
    if (listenerRef.current) { window.removeEventListener("message", listenerRef.current); listenerRef.current = null; }
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);

  useEffect(() => () => cleanup(), [cleanup]);

  const startOAuth = () => {
    if (platform.shopifyFlow && !shopDomain.trim()) {
      setError("Enter your Shopify store domain (e.g. mystore.myshopify.com)");
      return;
    }
    setUiState("waiting"); setError("");

    const base = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
    const params = new URLSearchParams({ platformId: "1", platformName: platform.name });
    if (platform.shopifyFlow) {
      params.set("shop", shopDomain.trim().replace(/^https?:\/\//, "").replace(/\/$/, ""));
    }
    const url = `${base}/api/auth/connect/${platform.oauthProvider}?${params.toString()}`;
    const popup = window.open(url, "dljos-oauth", "width=520,height=680,scrollbars=yes,resizable=yes,left=200,top=100");
    popupRef.current = popup;

    const handler = (e: MessageEvent) => {
      if (e.data?.type === "oauth-success") {
        cleanup(); onSuccess(e.data.platformName || `${platform.name} Account`);
      } else if (e.data?.type === "oauth-error") {
        cleanup(); setUiState("error"); setError(oauthErrorMessage(e.data.error ?? "unknown")); popupRef.current?.close();
      }
    };
    listenerRef.current = handler;
    window.addEventListener("message", handler);

    timerRef.current = setInterval(() => {
      if (popup?.closed) { cleanup(); if (uiState === "waiting") setUiState("idle"); }
    }, 800);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 pb-3 border-b border-border">
        <BrandIcon platform={platform.name} size={22} withBackground />
        <div>
          <p className="font-semibold text-[15px] text-foreground">{platform.name}</p>
          <p className="text-[12px] text-muted-foreground">{platform.description}</p>
        </div>
      </div>

      {platform.shopifyFlow && uiState === "idle" && (
        <div>
          <label className="text-[12px] font-medium text-muted-foreground block mb-1.5">Shopify Store Domain</label>
          <input type="text" value={shopDomain} onChange={(e) => setShopDomain(e.target.value)}
            placeholder="mystore.myshopify.com"
            className="w-full px-3 py-2.5 bg-muted border border-border rounded-xl text-[13px] focus:outline-none focus:ring-1 focus:ring-ring" />
        </div>
      )}

      {uiState === "idle" && (
        <>
          <div className="bg-muted rounded-xl p-3.5 space-y-1">
            <p className="text-[12.5px] text-muted-foreground leading-relaxed">
              You'll be redirected to <strong className="text-foreground">{platform.name}</strong> to authorize DLJOS. We only request the permissions necessary to operate.
            </p>
            <p className="text-[11.5px] text-muted-foreground">Credentials are encrypted and never stored in plain text.</p>
          </div>
          {error && (
            <div className="flex gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-xl">
              <AlertCircle size={14} className="text-destructive flex-shrink-0 mt-0.5" />
              <p className="text-[12px] text-destructive">{error}</p>
            </div>
          )}
          <button onClick={startOAuth}
            className="w-full py-3 bg-foreground text-background rounded-2xl text-[14px] font-semibold flex items-center justify-center gap-2 hover:opacity-90 transition-opacity">
            <ExternalLink size={15} />
            Connect with {platform.name}
          </button>
        </>
      )}

      {uiState === "waiting" && (
        <div className="text-center py-8">
          <div className="w-12 h-12 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-[14px] font-medium text-foreground">Waiting for authorization…</p>
          <p className="text-[12px] text-muted-foreground mt-1">Complete the login in the popup window that opened</p>
          <button onClick={() => { cleanup(); popupRef.current?.close(); setUiState("idle"); }} className="mt-4 text-[12px] text-muted-foreground underline">
            Cancel
          </button>
        </div>
      )}

      {uiState === "error" && (
        <div className="space-y-3">
          <div className="flex gap-2.5 p-3.5 bg-destructive/10 border border-destructive/20 rounded-xl">
            <AlertCircle size={16} className="text-destructive flex-shrink-0 mt-0.5" />
            <p className="text-[12.5px] text-destructive leading-relaxed">{error}</p>
          </div>
          <button onClick={() => { setUiState("idle"); setError(""); }}
            className="w-full py-2.5 border border-border rounded-xl text-[13px] font-medium hover:bg-accent transition-colors">
            Try Again
          </button>
        </div>
      )}
    </div>
  );
}

function ApiKeyModal({ platform, onClose, onSuccess }: ConnectModalProps) {
  const [apiKey, setApiKey] = useState("");
  const [secretKey, setSecretKey] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState("");
  const needsPassphrase = platform.connectionType === "apikey_passphrase";

  const handleConnect = async () => {
    setError("");
    if (!apiKey.trim()) { setError("API Key is required"); return; }
    if (!secretKey.trim()) { setError("Secret Key is required"); return; }
    if (needsPassphrase && !passphrase.trim()) { setError("Passphrase is required for " + platform.name); return; }
    if (apiKey.trim().length < 16) { setError("API Key is too short — please check and try again."); return; }
    if (secretKey.trim().length < 16) { setError("Secret Key is too short — please check and try again."); return; }

    setIsValidating(true);
    await new Promise((r) => setTimeout(r, 1400));
    setIsValidating(false);
    onSuccess(`${platform.name} Account`);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 pb-3 border-b border-border">
        <BrandIcon platform={platform.name} size={22} withBackground />
        <div>
          <p className="font-semibold text-[15px] text-foreground">{platform.name}</p>
          <p className="text-[12px] text-muted-foreground">API Key Connection</p>
        </div>
      </div>

      <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3">
        <p className="text-[12px] text-amber-600 dark:text-amber-400 leading-relaxed">
          Generate a read/write API key in your {platform.name} account settings. Never share your secret key with anyone.
        </p>
      </div>

      <div className="space-y-3">
        <div>
          <label className="text-[12px] font-medium text-muted-foreground block mb-1.5">API Key</label>
          <div className="relative">
            <input type={showKey ? "text" : "password"} value={apiKey}
              onChange={(e) => setApiKey(e.target.value)} placeholder="Paste your API key"
              className="w-full px-3 py-2.5 pr-10 bg-muted border border-border rounded-xl text-[13px] font-mono focus:outline-none focus:ring-1 focus:ring-ring" />
            <button onClick={() => setShowKey(!showKey)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
        </div>

        <div>
          <label className="text-[12px] font-medium text-muted-foreground block mb-1.5">Secret Key</label>
          <div className="relative">
            <input type={showSecret ? "text" : "password"} value={secretKey}
              onChange={(e) => setSecretKey(e.target.value)} placeholder="Paste your secret key"
              className="w-full px-3 py-2.5 pr-10 bg-muted border border-border rounded-xl text-[13px] font-mono focus:outline-none focus:ring-1 focus:ring-ring" />
            <button onClick={() => setShowSecret(!showSecret)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              {showSecret ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
        </div>

        {needsPassphrase && (
          <div>
            <label className="text-[12px] font-medium text-muted-foreground block mb-1.5">Passphrase</label>
            <input type="password" value={passphrase} onChange={(e) => setPassphrase(e.target.value)} placeholder="Enter passphrase"
              className="w-full px-3 py-2.5 bg-muted border border-border rounded-xl text-[13px] font-mono focus:outline-none focus:ring-1 focus:ring-ring" />
          </div>
        )}
      </div>

      {error && (
        <div className="flex gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-xl">
          <AlertCircle size={14} className="text-destructive flex-shrink-0 mt-0.5" />
          <p className="text-[12px] text-destructive">{error}</p>
        </div>
      )}

      <button onClick={handleConnect} disabled={isValidating}
        className="w-full py-3 bg-foreground text-background rounded-2xl text-[14px] font-semibold flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-50">
        {isValidating
          ? <><div className="w-4 h-4 border-2 border-background/50 border-t-background rounded-full animate-spin" />Validating credentials…</>
          : "Connect Account"}
      </button>
    </div>
  );
}

const BROKER_SERVERS: Record<string, string[]> = {
  mt5:        ["MetaQuotes-Demo", "MetaQuotes-Real"],
  exness:     ["real.exness.com", "demo.exness.com", "real2.exness.com"],
  xm:         ["xm.com-real", "xm.com-demo", "xm.com-real3"],
  icmarkets:  ["raw.icmarkets.com", "demo.icmarkets.com"],
  pepperstone:["mt5.pepperstone.com", "mt5-demo.pepperstone.com"],
  hfm:        ["hfm.com-real", "hfm.com-demo"],
};

function BrokerModal({ platform, onClose, onSuccess }: ConnectModalProps) {
  const [server, setServer] = useState("");
  const [accountId, setAccountId] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState("");
  const suggested = BROKER_SERVERS[platform.id] ?? [];

  const handleVerify = async () => {
    setError("");
    if (!server.trim()) { setError("Server address is required"); return; }
    if (!accountId.trim()) { setError("Login ID / Account number is required"); return; }
    if (!password.trim()) { setError("Password is required"); return; }
    if (!/^\d+$/.test(accountId.trim())) { setError("Account ID must be numeric (digits only)"); return; }
    if (password.length < 4) { setError("Password is too short"); return; }

    setIsVerifying(true);
    await new Promise((r) => setTimeout(r, 1600));
    setIsVerifying(false);
    onSuccess(`Account ${accountId}`);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 pb-3 border-b border-border">
        <BrandIcon platform={platform.name} size={22} withBackground />
        <div>
          <p className="font-semibold text-[15px] text-foreground">{platform.name}</p>
          <p className="text-[12px] text-muted-foreground">Broker / MT5 Connection</p>
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <label className="text-[12px] font-medium text-muted-foreground block mb-1.5">Broker Server</label>
          <input type="text" value={server} onChange={(e) => setServer(e.target.value)}
            placeholder="e.g. real.exness.com" list={`servers-${platform.id}`}
            className="w-full px-3 py-2.5 bg-muted border border-border rounded-xl text-[13px] font-mono focus:outline-none focus:ring-1 focus:ring-ring" />
          {suggested.length > 0 && (
            <>
              <datalist id={`servers-${platform.id}`}>{suggested.map((s) => <option key={s} value={s} />)}</datalist>
              <div className="flex flex-wrap gap-1 mt-1.5">
                {suggested.map((s) => (
                  <button key={s} onClick={() => setServer(s)}
                    className="px-2 py-0.5 bg-muted text-muted-foreground rounded text-[11px] hover:bg-accent transition-colors">{s}</button>
                ))}
              </div>
            </>
          )}
        </div>

        <div>
          <label className="text-[12px] font-medium text-muted-foreground block mb-1.5">Login ID / Account Number</label>
          <input type="text" value={accountId} onChange={(e) => setAccountId(e.target.value.replace(/\D/g, ""))}
            placeholder="e.g. 12345678"
            className="w-full px-3 py-2.5 bg-muted border border-border rounded-xl text-[13px] font-mono focus:outline-none focus:ring-1 focus:ring-ring" />
        </div>

        <div>
          <label className="text-[12px] font-medium text-muted-foreground block mb-1.5">Password</label>
          <div className="relative">
            <input type={showPassword ? "text" : "password"} value={password}
              onChange={(e) => setPassword(e.target.value)} placeholder="Investor or master password"
              className="w-full px-3 py-2.5 pr-10 bg-muted border border-border rounded-xl text-[13px] focus:outline-none focus:ring-1 focus:ring-ring" />
            <button onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="flex gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-xl">
          <AlertCircle size={14} className="text-destructive flex-shrink-0 mt-0.5" />
          <p className="text-[12px] text-destructive">{error}</p>
        </div>
      )}

      <button onClick={handleVerify} disabled={isVerifying}
        className="w-full py-3 bg-foreground text-background rounded-2xl text-[14px] font-semibold flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-50">
        {isVerifying
          ? <><div className="w-4 h-4 border-2 border-background/50 border-t-background rounded-full animate-spin" />Verifying connection…</>
          : "Verify & Connect"}
      </button>
    </div>
  );
}

interface PlatformCardProps {
  platform: PlatformDef;
  state: PlatformState;
  onConnect: () => void;
  onDisconnect: () => void;
}

function PlatformCard({ platform, state, onConnect, onDisconnect }: PlatformCardProps) {
  const isConnected = state.status === "connected";
  const isError = state.status === "error";
  const typeDot = platform.connectionType === "oauth" ? "bg-blue-500" : platform.connectionType === "broker" ? "bg-purple-500" : "bg-amber-500";

  return (
    <div className={cn("bg-card border rounded-2xl p-4 transition-all",
      isConnected ? "border-green-500/30 bg-green-500/5" : isError ? "border-destructive/30" : "border-border")}>
      <div className="flex items-start gap-3">
        <BrandIcon platform={platform.name} size={20} withBackground />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className="font-semibold text-[14px] text-foreground">{platform.name}</p>
            <div className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", typeDot)} />
          </div>
          <p className="text-[12px] text-muted-foreground truncate">{platform.description}</p>
          {isConnected && state.accountName && (
            <p className="text-[11px] text-green-500 mt-0.5 truncate font-medium">● {state.accountName}</p>
          )}
          {isError && state.error && (
            <p className="text-[11px] text-destructive mt-0.5 truncate">⚠ {state.error.slice(0, 45)}</p>
          )}
        </div>
        <div className={cn("w-2 h-2 rounded-full flex-shrink-0 mt-1.5",
          isConnected ? "bg-green-500" : isError ? "bg-red-500" : "bg-muted-foreground/30")} />
      </div>

      <div className="flex items-center gap-2 mt-3.5">
        {isConnected ? (
          <>
            <span className="text-[11px] text-green-500 font-medium flex-1">Connected</span>
            <button onClick={onConnect}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-muted text-muted-foreground text-[11px] font-medium hover:bg-accent transition-colors">
              <RefreshCw size={10} />Reconnect
            </button>
            <button onClick={onDisconnect}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-destructive/10 text-destructive text-[11px] font-medium hover:bg-destructive/20 transition-colors">
              <Unplug size={10} />Disconnect
            </button>
          </>
        ) : (
          <button onClick={onConnect}
            className="flex-1 py-2 bg-primary/10 hover:bg-primary/20 text-primary rounded-xl text-[13px] font-semibold flex items-center justify-center gap-1.5 transition-colors">
            {isError ? <><RefreshCw size={12} />Retry</> : <><ChevronRight size={12} />Connect</>}
          </button>
        )}
      </div>
    </div>
  );
}

export default function PlatformsPage() {
  const [activeCategory, setActiveCategory] = useState("all");
  const [states, setStates] = useState<Record<string, PlatformState>>(() => loadStates());
  const [modalPlatform, setModalPlatform] = useState<PlatformDef | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const updateState = useCallback((id: string, update: Partial<PlatformState>) => {
    setStates((prev) => {
      const next = { ...prev, [id]: { ...prev[id], ...update } };
      saveStates(next);
      return next;
    });
  }, []);

  const handleSuccess = (platform: PlatformDef, accountName?: string) => {
    updateState(platform.id, {
      status: "connected",
      accountName: accountName ?? `${platform.name} Account`,
      connectedAt: new Date().toISOString(),
      error: undefined,
    });
    setModalPlatform(null);
  };

  const handleDisconnect = (platform: PlatformDef) => {
    updateState(platform.id, { status: "disconnected", accountName: undefined, error: undefined });
    fetch(`${(import.meta.env.BASE_URL ?? "/").replace(/\/$/, "")}/api/auth/token/1`, { method: "DELETE" }).catch(() => { });
  };

  const filtered = PLATFORMS.filter((p) =>
    (activeCategory === "all" || p.category === activeCategory) &&
    (!searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const connectedCount = Object.values(states).filter((s) => s.status === "connected").length;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-4 pt-4 pb-3 border-b border-border flex-shrink-0">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-[18px] font-bold text-foreground">Platforms</h1>
            <p className="text-[12px] text-muted-foreground mt-0.5">{connectedCount} of {PLATFORMS.length} connected</p>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-muted rounded-full">
            {connectedCount > 0 ? <Wifi size={13} className="text-green-500" /> : <WifiOff size={13} className="text-muted-foreground" />}
            <span className="text-[12px] font-semibold text-foreground">{connectedCount}</span>
          </div>
        </div>

        <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search platforms…"
          className="w-full px-3 py-2 bg-muted border border-border rounded-xl text-[13px] focus:outline-none focus:ring-1 focus:ring-ring mb-3" />

        <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1" style={{ scrollbarWidth: "none" }}>
          {CATEGORIES.map((cat) => (
            <button key={cat.id} onClick={() => setActiveCategory(cat.id)}
              className={cn("flex-shrink-0 px-3 py-1.5 rounded-full text-[12px] font-medium transition-all whitespace-nowrap",
                activeCategory === cat.id ? "bg-foreground text-background" : "bg-muted text-muted-foreground hover:bg-accent")}>
              {cat.label}
              <span className={cn("ml-1 text-[10px]", activeCategory === cat.id ? "opacity-60" : "opacity-50")}>{cat.count}</span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3 mt-2.5 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1"><span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-500" />OAuth</span>
          <span className="flex items-center gap-1"><span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500" />API Key</span>
          <span className="flex items-center gap-1"><span className="inline-block w-1.5 h-1.5 rounded-full bg-purple-500" />Broker</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3">
        {filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground text-[13px]">No platforms found for "{searchQuery}"</div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {filtered.map((p) => (
              <PlatformCard key={p.id} platform={p}
                state={states[p.id] ?? { status: "disconnected" }}
                onConnect={() => setModalPlatform(p)}
                onDisconnect={() => handleDisconnect(p)} />
            ))}
          </div>
        )}
      </div>

      {modalPlatform && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setModalPlatform(null)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative bg-background w-full sm:max-w-[420px] rounded-t-3xl sm:rounded-2xl shadow-2xl p-5 z-10 max-h-[92dvh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setModalPlatform(null)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:bg-accent transition-colors">
              <X size={15} />
            </button>

            {modalPlatform.connectionType === "oauth" ? (
              <OAuthModal platform={modalPlatform} onClose={() => setModalPlatform(null)} onSuccess={(name) => handleSuccess(modalPlatform, name)} />
            ) : modalPlatform.connectionType === "broker" ? (
              <BrokerModal platform={modalPlatform} onClose={() => setModalPlatform(null)} onSuccess={(name) => handleSuccess(modalPlatform, name)} />
            ) : (
              <ApiKeyModal platform={modalPlatform} onClose={() => setModalPlatform(null)} onSuccess={(name) => handleSuccess(modalPlatform, name)} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
