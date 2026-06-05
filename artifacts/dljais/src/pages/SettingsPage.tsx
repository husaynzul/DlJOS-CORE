import { useState } from "react";
import { Link } from "wouter";
import {
  ChevronRight, User, CreditCard, Sliders, Shield, Type, Globe, Vibrate,
  Moon, Sun, Plug, Zap, Brain, Key, CheckCircle2, AlertCircle, Eye, EyeOff, Star,
} from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";
import { DlJOSLogo } from "@/components/AppLayout";
import { cn } from "@/lib/utils";

const PLANS = [
  { id: "free",    label: "Free",    price: "$0/mo",  features: ["50 messages/day", "GPT-4o mini", "5 platforms"] },
  { id: "creator", label: "Creator", price: "$12/mo", features: ["1,000 messages/day", "All models", "12 platforms", "Priority"] },
  { id: "pro",     label: "Pro",     price: "$29/mo", features: ["Unlimited", "All models", "All platforms", "API access", "Custom workflows"] },
];

const API_PROVIDERS = [
  { id: "openai",    name: "OpenAI",          models: "GPT-4o, GPT-4o mini",   color: "text-emerald-500", envKey: "OPENAI_API_KEY",    url: "platform.openai.com/api-keys" },
  { id: "google",    name: "Google Gemini",   models: "Gemini Flash, Pro",     color: "text-blue-500",    envKey: "GOOGLE_AI_API_KEY", url: "aistudio.google.com/app/apikey" },
  { id: "anthropic", name: "Anthropic Claude",models: "Sonnet, Haiku",          color: "text-orange-400",  envKey: "ANTHROPIC_API_KEY", url: "console.anthropic.com" },
];

const LANGUAGES = ["English", "Urdu", "Arabic", "Hindi", "Spanish", "French"];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 px-1">{title}</p>
      <div className="bg-card border border-card-border rounded-2xl overflow-hidden divide-y divide-border">
        {children}
      </div>
    </div>
  );
}

function Row({ icon: Icon, label, value, onClick, chevron = true, children }: {
  icon: React.ElementType; label: string; value?: string; onClick?: () => void; chevron?: boolean; children?: React.ReactNode;
}) {
  return (
    <button onClick={onClick}
      className={cn("w-full flex items-center gap-3.5 px-5 py-3.5 hover:bg-accent/50 transition-colors text-left", !onClick && "cursor-default")}>
      <Icon size={17} className="text-muted-foreground flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-[14px] text-foreground">{label}</p>
        {value && <p className="text-[12px] text-muted-foreground mt-0.5">{value}</p>}
      </div>
      {children}
      {chevron && onClick && <ChevronRight size={15} className="text-muted-foreground flex-shrink-0" />}
    </button>
  );
}

function Toggle({ icon: Icon, label, value, onToggle }: {
  icon: React.ElementType; label: string; value: boolean; onToggle: () => void;
}) {
  return (
    <div className="flex items-center gap-3.5 px-5 py-3.5">
      <Icon size={17} className="text-muted-foreground flex-shrink-0" />
      <p className="flex-1 text-[14px] text-foreground">{label}</p>
      <button
        onClick={onToggle}
        className={cn("relative w-[44px] h-[26px] rounded-full transition-colors duration-200 overflow-hidden flex-shrink-0",
          value ? "bg-blue-500" : "bg-muted-foreground/30"
        )}
        data-testid={`toggle-${label.toLowerCase().replace(/\s/g,"-")}`}
      >
        <span className={cn(
          "absolute top-[3px] w-5 h-5 bg-white rounded-full shadow-md transition-transform duration-200",
          value ? "translate-x-[21px]" : "translate-x-[3px]"
        )} />
      </button>
    </div>
  );
}

function ApiKeyRow({ p }: { p: typeof API_PROVIDERS[number] }) {
  const [open, setOpen] = useState(false);
  const [val, setVal] = useState("");
  const [show, setShow] = useState(false);
  const [saved, setSaved] = useState(false);

  const save = () => {
    if (!val.trim()) return;
    setSaved(true); setVal(""); setOpen(false);
    setTimeout(() => setSaved(false), 4000);
  };

  return (
    <div>
      <button onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3.5 px-5 py-3.5 hover:bg-accent/50 transition-colors text-left">
        <Key size={16} className="text-muted-foreground flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className={cn("text-[14px] font-medium", p.color)}>{p.name}</p>
          <p className="text-[12px] text-muted-foreground">{p.models}</p>
        </div>
        {saved
          ? <CheckCircle2 size={16} className="text-emerald-500 flex-shrink-0" />
          : <AlertCircle size={15} className="text-amber-400 flex-shrink-0" />}
      </button>
      {open && (
        <div className="px-5 py-3.5 bg-muted/30 space-y-3 border-t border-border">
          <p className="text-[12px] text-muted-foreground">Get your key from <span className="text-foreground font-medium">{p.url}</span></p>
          <div className="relative">
            <input type={show ? "text" : "password"} value={val} onChange={(e) => setVal(e.target.value)}
              placeholder="sk-… or AI…"
              className="w-full bg-background border border-border rounded-xl px-4 py-2.5 pr-10 text-[13px] font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              data-testid={`input-key-${p.id}`} />
            <button onClick={() => setShow((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              {show ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
          <div className="flex gap-2">
            <button onClick={save} disabled={!val.trim()}
              className={cn("flex-1 py-2 rounded-xl text-[13px] font-semibold transition-all",
                val.trim() ? "bg-foreground text-background" : "bg-muted text-muted-foreground cursor-not-allowed")}
              data-testid={`button-save-key-${p.id}`}>
              Save & Use
            </button>
            <button onClick={() => setOpen(false)} className="px-4 py-2 rounded-xl text-[13px] text-muted-foreground border border-border hover:bg-accent transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SettingsPage() {
  const { theme, toggleTheme } = useTheme();
  const [haptic, setHaptic] = useState(true);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [currentPlan] = useState("free");
  const [modelOpen, setModelOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const [selectedModel, setSelectedModel] = useState("Claude Sonnet 4.6");
  const [selectedLang, setSelectedLang] = useState("English");
  const [aiMode, setAiMode] = useState<"platform"|"byok">("platform");

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-background">

      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-shrink-0">
        <h1 className="text-[17px] font-semibold text-foreground">Settings</h1>
        <DlJOSLogo size={28} />
      </div>

      <div className="px-4 py-4 space-y-5 max-w-[600px] mx-auto w-full pb-10">

        {/* Profile */}
        <div className="bg-card border border-card-border rounded-2xl px-5 py-4 flex items-center gap-4">
          <DlJOSLogo size={44} className="rounded-xl flex-shrink-0" />
          <div className="flex-1">
            <p className="text-[14px] font-semibold text-foreground">HusaynZul</p>
            <p className="text-[12px] text-muted-foreground">husaynzul@gmail.com</p>
          </div>
          <span className="text-[11px] font-bold px-2.5 py-1 bg-foreground text-background rounded-full uppercase tracking-wide">Free</span>
        </div>

        {/* Subscription */}
        <Section title="Subscription">
          <div className="px-4 py-4 space-y-2.5">
            {PLANS.map((plan) => (
              <div key={plan.id}
                className={cn("p-3.5 rounded-xl border transition-all cursor-pointer",
                  currentPlan === plan.id ? "border-primary bg-primary/5" : "border-border hover:border-foreground/30"
                )}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {plan.id === "pro" && <Star size={13} className="text-amber-400" />}
                    <span className={cn("text-[14px] font-semibold", currentPlan === plan.id ? "text-primary" : "text-foreground")}>{plan.label}</span>
                  </div>
                  <span className="text-[13px] font-medium text-foreground">{plan.price}</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {plan.features.map((f) => (
                    <span key={f} className="text-[11px] text-muted-foreground bg-muted px-2 py-0.5 rounded-lg">{f}</span>
                  ))}
                </div>
              </div>
            ))}
            <button className="w-full py-3 rounded-xl bg-foreground text-background text-[13.5px] font-semibold mt-1">
              Upgrade to Creator →
            </button>
          </div>
        </Section>

        {/* AI Provider Mode */}
        <Section title="AI Provider">
          <div className="px-4 py-4 space-y-3">
            <p className="text-[12.5px] text-muted-foreground">Choose how DlJOS accesses AI models.</p>
            <div className="p-1 bg-muted rounded-xl flex gap-1">
              {[
                { id: "platform", label: "DlJOS AI", sub: "Powered by DlJOS" },
                { id: "byok",     label: "My API Key", sub: "BYOK · $2/mo fee" },
              ].map((m) => (
                <button key={m.id} onClick={() => setAiMode(m.id as "platform"|"byok")}
                  className={cn("flex-1 py-2.5 rounded-lg text-[13px] font-medium transition-all text-center",
                    aiMode === m.id ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
                  )} data-testid={`mode-${m.id}`}>
                  <span className="block">{m.label}</span>
                  <span className="block text-[10.5px] opacity-60 mt-0.5">{m.sub}</span>
                </button>
              ))}
            </div>
          </div>
        </Section>

        {/* API Keys — only shown when My API Key mode is selected */}
        {aiMode === "byok" && (
          <Section title="API Keys">
            {API_PROVIDERS.map((p) => <ApiKeyRow key={p.id} p={p} />)}
          </Section>
        )}

        {/* AI Model */}
        <Section title="AI Brain">
          <button onClick={() => setModelOpen((v) => !v)}
            className="w-full flex items-center gap-3.5 px-5 py-3.5 hover:bg-accent/50 transition-colors text-left">
            <Brain size={17} className="text-muted-foreground flex-shrink-0" />
            <div className="flex-1">
              <p className="text-[14px] text-foreground">Default model</p>
              <p className="text-[12px] text-muted-foreground">{selectedModel}</p>
            </div>
            <ChevronRight size={15} className={cn("text-muted-foreground transition-transform", modelOpen && "rotate-90")} />
          </button>
          {modelOpen && ["GPT-4o", "GPT-4o mini", "Gemini Flash", "Gemini Pro", "Claude Sonnet 4.6", "Claude Haiku 4.5"].map((m) => (
            <button key={m} onClick={() => { setSelectedModel(m); setModelOpen(false); }}
              className="w-full flex items-center justify-between px-5 py-2.5 hover:bg-accent/50 transition-colors border-t border-border">
              <span className={cn("text-[13.5px]", m === selectedModel ? "text-primary font-medium" : "text-foreground")}>{m}</span>
              {m === selectedModel && <span className="w-2 h-2 bg-primary rounded-full" />}
            </button>
          ))}
        </Section>

        {/* Connections */}
        <Section title="Connections">
          <Link href="/platforms"><Row icon={Plug} label="Connected Platforms" value="Manage your 12 platforms" /></Link>
          <Link href="/actions"><Row icon={Zap} label="Action History" value="View all past actions" /></Link>
        </Section>

        {/* Account */}
        <Section title="Account">
          <Row icon={User} label="Profile" value="Edit name and email" />
          <Row icon={CreditCard} label="Billing" value="Free plan · Upgrade available" />
          <Row icon={Sliders} label="Capabilities" value="3 enabled" />
          <Row icon={Shield} label="Permissions" value="Manage access" />
        </Section>

        {/* Preferences */}
        <Section title="Preferences">
          <Toggle icon={theme === "light" ? Moon : Sun} label={theme === "light" ? "Dark mode" : "Light mode"} value={theme === "dark"} onToggle={toggleTheme} />
          <Row icon={Type} label="Font style" value="Default" onClick={() => {}} />
          <button onClick={() => setLangOpen((v) => !v)}
            className="w-full flex items-center gap-3.5 px-5 py-3.5 hover:bg-accent/50 transition-colors text-left">
            <Globe size={17} className="text-muted-foreground flex-shrink-0" />
            <div className="flex-1">
              <p className="text-[14px] text-foreground">Speech language</p>
              <p className="text-[12px] text-muted-foreground">{selectedLang}</p>
            </div>
            <ChevronRight size={15} className={cn("text-muted-foreground transition-transform", langOpen && "rotate-90")} />
          </button>
          {langOpen && LANGUAGES.map((l) => (
            <button key={l} onClick={() => { setSelectedLang(l); setLangOpen(false); }}
              className="w-full flex items-center justify-between px-5 py-2.5 hover:bg-accent/50 transition-colors border-t border-border">
              <span className={cn("text-[13.5px]", l === selectedLang ? "text-primary font-medium" : "text-foreground")}>{l}</span>
              {l === selectedLang && <span className="w-2 h-2 bg-primary rounded-full" />}
            </button>
          ))}
          <Toggle icon={Vibrate} label="Voice input" value={voiceEnabled} onToggle={() => setVoiceEnabled((v) => !v)} />
          <Toggle icon={Vibrate} label="Haptic feedback" value={haptic} onToggle={() => setHaptic((v) => !v)} />
        </Section>

        <p className="text-center text-[12px] text-muted-foreground">DlJOS v1.0 · AI Action OS</p>
      </div>
    </div>
  );
}
