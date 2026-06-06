import { useEffect, useState } from "react";
import {
  Zap, CheckCircle2, Clock, Plug, TrendingUp, MessageSquare,
  Bot, Activity, BarChart2,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell,
} from "recharts";
import { cn } from "@/lib/utils";
import { BrandIcon } from "@/components/BrandIcon";

// ─── Local data helpers ───────────────────────────────────────────────────────

const PLATFORM_GROUPS = [
  {
    id: "social", label: "Social Media",
    platforms: [
      { id: "instagram", name: "Instagram" }, { id: "tiktok", name: "TikTok" },
      { id: "youtube", name: "YouTube" }, { id: "facebook", name: "Facebook" },
      { id: "whatsapp", name: "WhatsApp" }, { id: "x", name: "X (Twitter)" },
    ],
  },
  {
    id: "google", label: "Google System",
    platforms: [{ id: "gmail", name: "Gmail" }, { id: "gdrive", name: "Google Drive" }],
  },
  {
    id: "ads", label: "Ads System",
    platforms: [
      { id: "meta-ads", name: "Meta Ads" }, { id: "google-ads", name: "Google Ads" },
      { id: "tiktok-ads", name: "TikTok Ads" },
    ],
  },
];
const ALL_PLATFORMS = PLATFORM_GROUPS.flatMap((g) => g.platforms);

function getPlatformStates(): Record<string, { status: string; accountName?: string }> {
  try { return JSON.parse(localStorage.getItem("dljois-platform-states") ?? "{}"); } catch { return {}; }
}

function getConnectedPlatforms() {
  const states = getPlatformStates();
  return ALL_PLATFORMS.filter((p) => states[p.id]?.status === "connected").map((p) => ({
    ...p,
    accountName: states[p.id]?.accountName,
  }));
}

// Simulated local activity log (stored in localStorage)
const ACTIVITY_KEY = "dljois-activity-log";
type ActivityEntry = { id: string; title: string; platform: string; type: string; ts: number };

function getActivity(): ActivityEntry[] {
  try { return JSON.parse(localStorage.getItem(ACTIVITY_KEY) ?? "[]"); } catch { return []; }
}

// Simulate daily action history for the last 7 days from local data
function buildChartData() {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const label = d.toLocaleDateString([], { weekday: "short" });
    // Vary the simulated count slightly per day
    const base = Math.floor(Math.random() * 4);
    return { label, count: i === 6 ? base + 1 : base };
  });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({ label, value, icon: Icon, color = "text-primary", sub }: {
  label: string; value: number | string; icon: React.ElementType; color?: string; sub?: string;
}) {
  return (
    <div className="bg-card border border-card-border rounded-2xl px-5 py-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[12.5px] font-medium text-muted-foreground">{label}</p>
        <div className={cn("w-8 h-8 rounded-lg bg-muted flex items-center justify-center", color)}>
          <Icon size={15} />
        </div>
      </div>
      <p className="text-[28px] font-semibold text-foreground leading-none">{value}</p>
      {sub && <p className="text-[11.5px] text-muted-foreground mt-1">{sub}</p>}
    </div>
  );
}

const AGENT_LIST = [
  { name: "Content Agent",    desc: "Captions, scripts, ideas",   color: "bg-violet-500", active: true },
  { name: "Marketing Agent",  desc: "Ad strategy, campaigns",      color: "bg-blue-500",   active: true },
  { name: "Growth Agent",     desc: "Analytics, optimization",      color: "bg-emerald-500",active: false },
  { name: "Automation Agent", desc: "Workflows, scheduling",        color: "bg-amber-500",  active: false },
];

const BAR_COLORS = ["#6366f1", "#8b5cf6", "#a78bfa", "#818cf8", "#c084fc", "#a855f7", "#7c3aed"];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload?.length) {
    return (
      <div className="bg-popover border border-border rounded-xl px-3 py-2 shadow-lg">
        <p className="text-[11.5px] text-muted-foreground mb-0.5">{label}</p>
        <p className="text-[13px] font-semibold text-foreground">{payload[0].value} actions</p>
      </div>
    );
  }
  return null;
};

// ─── Main page ────────────────────────────────────────────────────────────────

export default function StatsPage() {
  const [connected, setConnected] = useState(getConnectedPlatforms);
  const [activity] = useState(getActivity);
  const [chartData] = useState(buildChartData);
  const [now] = useState(() => new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));

  // Refresh platform data when user comes back to this page
  useEffect(() => { setConnected(getConnectedPlatforms()); }, []);

  const totalPlatforms = ALL_PLATFORMS.length;
  const connectedCount = connected.length;
  const totalMessages = activity.length;
  const totalActions = activity.filter((a) => a.type === "action").length;

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-background">
      <div className="max-w-[680px] mx-auto w-full px-5 py-6 space-y-5 pb-12">

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-[20px] font-bold text-foreground tracking-tight">Analytics</h1>
            <p className="text-[12.5px] text-muted-foreground mt-0.5">DlJOS system overview · Updated {now}</p>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[11.5px] text-emerald-600 dark:text-emerald-400 font-semibold">Live</span>
          </div>
        </div>

        {/* Key metrics */}
        <div className="grid grid-cols-2 gap-3">
          <StatCard label="Connected Platforms" value={`${connectedCount}/${totalPlatforms}`} icon={Plug}          color="text-blue-500"    sub="platforms active" />
          <StatCard label="AI Agents"           value={AGENT_LIST.length}                      icon={Bot}           color="text-violet-500"  sub="running in background" />
          <StatCard label="Chat Sessions"       value={totalMessages || "—"}                   icon={MessageSquare} color="text-primary"     sub="local history" />
          <StatCard label="Actions Generated"   value={totalActions || "—"}                    icon={Zap}           color="text-amber-500"   sub="pending or executed" />
        </div>

        {/* Action history chart */}
        <div className="bg-card border border-card-border rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <BarChart2 size={14} className="text-primary" />
            <p className="text-[13.5px] font-semibold text-foreground">Activity · Last 7 days</p>
            <span className="ml-auto text-[11px] text-muted-foreground bg-muted px-2 py-0.5 rounded-lg">
              {chartData.reduce((s, d) => s + d.count, 0)} total
            </span>
          </div>
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={chartData} margin={{ top: 4, right: 0, left: -28, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 3" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: "hsl(var(--accent))", radius: 4 }} />
              <Bar dataKey="count" radius={[5, 5, 0, 0]} maxBarSize={32}>
                {chartData.map((_, i) => <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Connected platforms */}
        <div className="bg-card border border-card-border rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              <Plug size={13} className="text-muted-foreground" />
              <p className="text-[13px] font-semibold text-foreground">Connected Platforms</p>
            </div>
            <a href="/platforms" className="text-[12px] text-primary hover:opacity-75 transition-opacity">Manage →</a>
          </div>

          {connectedCount === 0 ? (
            <div className="px-4 py-8 text-center">
              <p className="text-[13px] text-muted-foreground">No platforms connected yet.</p>
              <a href="/platforms" className="inline-block mt-2 text-[12.5px] text-primary underline">Connect your first platform →</a>
            </div>
          ) : (
            <div className="px-4 py-3 flex flex-wrap gap-2.5">
              {connected.map((p) => (
                <div key={p.id} className="flex items-center gap-2 px-3 py-2 bg-muted/50 rounded-xl border border-border">
                  <BrandIcon platform={p.name} size={16} />
                  <div>
                    <p className="text-[12px] font-medium text-foreground leading-tight">{p.name}</p>
                    {p.accountName && p.accountName !== p.name && (
                      <p className="text-[10.5px] text-muted-foreground leading-tight">{p.accountName}</p>
                    )}
                  </div>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Platform coverage */}
        <div className="bg-card border border-card-border rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Activity size={13} className="text-muted-foreground" />
            <p className="text-[13px] font-semibold text-foreground">Platform Coverage</p>
          </div>
          <div className="space-y-2.5">
            {PLATFORM_GROUPS.map((group) => {
              const states = getPlatformStates();
              const total = group.platforms.length;
              const cnt = group.platforms.filter((p) => states[p.id]?.status === "connected").length;
              const pct = Math.round((cnt / total) * 100);
              return (
                <div key={group.id}>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-[12px] text-muted-foreground">{group.label}</p>
                    <p className="text-[12px] font-semibold text-foreground">{cnt}/{total}</p>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* AI Agents */}
        <div className="bg-card border border-card-border rounded-2xl overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
            <Bot size={13} className="text-muted-foreground" />
            <p className="text-[13px] font-semibold text-foreground">AI Agents</p>
            <span className="ml-auto text-[11px] text-muted-foreground">{AGENT_LIST.filter((a) => a.active).length} active</span>
          </div>
          <div className="divide-y divide-border">
            {AGENT_LIST.map((agent) => (
              <div key={agent.name} className="flex items-center gap-3 px-4 py-3">
                <div className={cn("w-2 h-2 rounded-full flex-shrink-0", agent.active ? agent.color : "bg-zinc-400")} />
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-foreground">{agent.name}</p>
                  <p className="text-[11.5px] text-muted-foreground">{agent.desc}</p>
                </div>
                <span className={cn("text-[11px] font-semibold px-2 py-0.5 rounded-full",
                  agent.active ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400" : "bg-muted text-muted-foreground")}>
                  {agent.active ? "Active" : "Standby"}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* DlJOS identity */}
        <div className="bg-card border border-card-border rounded-2xl px-4 py-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-foreground/5 flex items-center justify-center flex-shrink-0">
            <TrendingUp size={18} className="text-primary" />
          </div>
          <div>
            <p className="text-[13px] font-semibold text-foreground">DlJOS AI Operating System</p>
            <p className="text-[11.5px] text-muted-foreground mt-0.5">
              Multi-agent AI execution layer · {connectedCount} platform{connectedCount !== 1 ? "s" : ""} connected
            </p>
          </div>
          <span className="ml-auto text-[11px] font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-lg">v2.0</span>
        </div>
      </div>
    </div>
  );
}
