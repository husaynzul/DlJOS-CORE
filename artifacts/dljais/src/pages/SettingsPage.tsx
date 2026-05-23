import { useState } from "react";
import { Link } from "wouter";
import {
  ChevronRight, User, CreditCard, Sliders, Shield,
  Type, Globe, Vibrate, Info, Moon, Sun, Plug, Zap, Brain,
} from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";
import { cn } from "@/lib/utils";

const MODELS = [
  { id: "claude-opus-4-7", label: "Claude Opus 4.7", desc: "Most capable" },
  { id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6", desc: "Recommended" },
  { id: "claude-haiku-4-5", label: "Claude Haiku 4.5", desc: "Fastest" },
];

const LANGUAGES = ["English", "Urdu", "Arabic", "Hindi", "Spanish", "French"];

interface RowProps {
  icon: React.ElementType;
  label: string;
  value?: string;
  onClick?: () => void;
  chevron?: boolean;
  children?: React.ReactNode;
}

function SettingRow({ icon: Icon, label, value, onClick, chevron = true, children }: RowProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3.5 px-5 py-3.5 hover:bg-accent/50 transition-colors text-left",
        !onClick && "cursor-default"
      )}
    >
      <Icon size={18} className="text-muted-foreground flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-[14px] text-foreground">{label}</p>
        {value && <p className="text-[12.5px] text-muted-foreground mt-0.5">{value}</p>}
      </div>
      {children}
      {chevron && onClick && <ChevronRight size={15} className="text-muted-foreground flex-shrink-0" />}
    </button>
  );
}

function SettingToggle({ icon: Icon, label, value, onToggle }: { icon: React.ElementType; label: string; value: boolean; onToggle: () => void }) {
  return (
    <div className="w-full flex items-center gap-3.5 px-5 py-3.5">
      <Icon size={18} className="text-muted-foreground flex-shrink-0" />
      <p className="flex-1 text-[14px] text-foreground">{label}</p>
      <button
        onClick={onToggle}
        className={cn(
          "w-11 h-6 rounded-full transition-colors relative flex-shrink-0",
          value ? "bg-blue-500" : "bg-muted"
        )}
        data-testid={`toggle-${label.toLowerCase().replace(/\s/g, "-")}`}
      >
        <span className={cn(
          "absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform",
          value ? "translate-x-5" : "translate-x-0.5"
        )} />
      </button>
    </div>
  );
}

function Section({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("bg-card border border-card-border rounded-2xl overflow-hidden divide-y divide-border", className)}>
      {children}
    </div>
  );
}

export default function SettingsPage() {
  const { theme, toggleTheme } = useTheme();
  const [haptic, setHaptic] = useState(true);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [modelPickerOpen, setModelPickerOpen] = useState(false);
  const [langPickerOpen, setLangPickerOpen] = useState(false);
  const [selectedModel, setSelectedModel] = useState(MODELS[1]);
  const [selectedLang, setSelectedLang] = useState("English");

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <h1 className="text-[17px] font-semibold text-foreground">Settings</h1>
        <Info size={20} className="text-muted-foreground" />
      </div>

      <div className="px-4 py-4 space-y-4 max-w-[600px] mx-auto w-full">

        {/* Profile card */}
        <Section>
          <div className="flex items-center gap-4 px-5 py-4">
            <div className="w-10 h-10 rounded-full bg-foreground flex items-center justify-center text-[15px] font-bold text-background flex-shrink-0">H</div>
            <div className="flex-1">
              <p className="text-[14px] font-medium text-foreground">HusaynZul</p>
              <p className="text-[12.5px] text-muted-foreground">husaynzul@gmail.com</p>
            </div>
            <span className="text-[11px] font-semibold px-2 py-0.5 bg-foreground text-background rounded-full">Free</span>
          </div>
        </Section>

        {/* AI Model */}
        <Section>
          <div className="px-5 py-3 border-b border-border bg-muted/30">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">AI Brain</p>
          </div>
          <button
            onClick={() => setModelPickerOpen((v) => !v)}
            className="w-full flex items-center gap-3.5 px-5 py-3.5 hover:bg-accent/50 transition-colors text-left"
            data-testid="button-model-settings"
          >
            <Brain size={18} className="text-muted-foreground flex-shrink-0" />
            <div className="flex-1">
              <p className="text-[14px] text-foreground">Default model</p>
              <p className="text-[12.5px] text-muted-foreground">{selectedModel.label}</p>
            </div>
            <ChevronRight size={15} className={cn("text-muted-foreground transition-transform", modelPickerOpen && "rotate-90")} />
          </button>

          {modelPickerOpen && (
            <div className="divide-y divide-border border-t border-border">
              {MODELS.map((m) => (
                <button key={m.id}
                  onClick={() => { setSelectedModel(m); setModelPickerOpen(false); }}
                  className="w-full flex items-center gap-3 px-5 py-3 hover:bg-accent/50 transition-colors text-left"
                  data-testid={`model-setting-${m.id}`}
                >
                  <div className="flex-1">
                    <p className={cn("text-[13.5px] font-medium", selectedModel.id === m.id ? "text-primary" : "text-foreground")}>{m.label}</p>
                    <p className="text-[12px] text-muted-foreground">{m.desc}</p>
                  </div>
                  {selectedModel.id === m.id && (
                    <span className="w-4 h-4 rounded-full border-2 border-primary flex items-center justify-center">
                      <span className="w-2 h-2 bg-primary rounded-full" />
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </Section>

        {/* Connections */}
        <Section>
          <div className="px-5 py-3 border-b border-border bg-muted/30">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Connections</p>
          </div>
          <Link href="/platforms">
            <SettingRow icon={Plug} label="Connected Platforms" value="4 of 12 connected" />
          </Link>
          <Link href="/actions">
            <SettingRow icon={Zap} label="Action History" value="View all actions" />
          </Link>
        </Section>

        {/* Capabilities */}
        <Section>
          <div className="px-5 py-3 border-b border-border bg-muted/30">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Capabilities</p>
          </div>
          <SettingRow icon={Sliders} label="Capabilities" value="3 enabled" />
          <SettingRow icon={Shield} label="Permissions" value="Manage access" />
        </Section>

        {/* Account */}
        <Section>
          <div className="px-5 py-3 border-b border-border bg-muted/30">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Account</p>
          </div>
          <SettingRow icon={User} label="Profile" value="Edit your details" />
          <SettingRow icon={CreditCard} label="Billing" value="Free plan" />
        </Section>

        {/* Preferences */}
        <Section>
          <div className="px-5 py-3 border-b border-border bg-muted/30">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Preferences</p>
          </div>

          {/* Theme */}
          <SettingToggle
            icon={theme === "light" ? Moon : Sun}
            label={theme === "light" ? "Dark mode" : "Light mode"}
            value={theme === "dark"}
            onToggle={toggleTheme}
          />

          {/* Font style */}
          <SettingRow icon={Type} label="Font style" value="Default" />

          {/* Speech language */}
          <button
            onClick={() => setLangPickerOpen((v) => !v)}
            className="w-full flex items-center gap-3.5 px-5 py-3.5 hover:bg-accent/50 transition-colors text-left"
          >
            <Globe size={18} className="text-muted-foreground flex-shrink-0" />
            <div className="flex-1">
              <p className="text-[14px] text-foreground">Speech language</p>
              <p className="text-[12.5px] text-muted-foreground">{selectedLang}</p>
            </div>
            <ChevronRight size={15} className={cn("text-muted-foreground transition-transform", langPickerOpen && "rotate-90")} />
          </button>

          {langPickerOpen && (
            <div className="divide-y divide-border border-t border-border">
              {LANGUAGES.map((lang) => (
                <button key={lang}
                  onClick={() => { setSelectedLang(lang); setLangPickerOpen(false); }}
                  className="w-full flex items-center justify-between px-5 py-2.5 hover:bg-accent/50 transition-colors"
                  data-testid={`lang-${lang.toLowerCase()}`}
                >
                  <span className={cn("text-[13.5px]", lang === selectedLang ? "text-primary font-medium" : "text-foreground")}>{lang}</span>
                  {lang === selectedLang && <span className="w-2 h-2 bg-primary rounded-full" />}
                </button>
              ))}
            </div>
          )}

          {/* Voice */}
          <SettingToggle icon={Vibrate} label="Voice input" value={voiceEnabled} onToggle={() => setVoiceEnabled((v) => !v)} />

          {/* Haptic */}
          <SettingToggle icon={Vibrate} label="Haptic feedback" value={haptic} onToggle={() => setHaptic((v) => !v)} />
        </Section>

        <p className="text-center text-[12px] text-muted-foreground pb-6">DlJiS v1.0 · AI Action OS</p>
      </div>
    </div>
  );
}
