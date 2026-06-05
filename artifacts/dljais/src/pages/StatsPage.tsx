import { useGetStatsSummary } from "@workspace/api-client-react";
import { useEffect, useState } from "react";
import { Zap, CheckCircle2, Clock, Plug, TrendingUp } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: number | string;
  icon: React.ElementType;
  color?: string;
}

function StatCard({ label, value, icon: Icon, color = "text-primary" }: StatCardProps) {
  return (
    <div className="bg-card border border-card-border rounded-2xl px-5 py-4" data-testid={`stat-card-${label.toLowerCase().replace(/\s/g, "-")}`}>
      <div className="flex items-center justify-between mb-3">
        <p className="text-[12.5px] font-medium text-muted-foreground">{label}</p>
        <div className={cn("w-8 h-8 rounded-lg bg-muted flex items-center justify-center", color)}>
          <Icon size={15} />
        </div>
      </div>
      <p className="text-[28px] font-semibold text-foreground leading-none">{value}</p>
    </div>
  );
}

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-500",
  approved: "bg-emerald-500",
  rejected: "bg-red-400",
  executing: "bg-blue-500",
  completed: "bg-emerald-600",
  failed: "bg-red-600",
};

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function formatChartDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

interface ChartPoint { date: string; count: number }

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-popover border border-border rounded-xl px-3 py-2 shadow-lg">
        <p className="text-[11.5px] text-muted-foreground mb-0.5">{formatChartDate(label)}</p>
        <p className="text-[13px] font-semibold text-foreground">{payload[0].value} actions</p>
      </div>
    );
  }
  return null;
};

export default function StatsPage() {
  const { data: stats, isLoading } = useGetStatsSummary();
  const [chartData, setChartData] = useState<ChartPoint[]>([]);
  const [chartLoading, setChartLoading] = useState(true);

  useEffect(() => {
    fetch("/api/stats/chart")
      .then((r) => r.json())
      .then((d) => { setChartData(d); setChartLoading(false); })
      .catch(() => setChartLoading(false));
  }, []);

  if (isLoading) {
    return (
      <div className="flex flex-col h-full overflow-y-auto">
        <div className="max-w-[700px] mx-auto w-full px-6 py-8">
          <div className="mb-6">
            <div className="h-7 w-48 rounded-lg shimmer mb-2" />
            <div className="h-4 w-72 rounded-lg shimmer" />
          </div>
          <div className="grid grid-cols-2 gap-3 mb-6">
            {[...Array(4)].map((_, i) => <div key={i} className="h-24 rounded-2xl shimmer" />)}
          </div>
        </div>
      </div>
    );
  }

  if (!stats) return null;

  const visibleData = chartData.filter((_, i) => i % 2 === 0 || i === chartData.length - 1);

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="max-w-[700px] mx-auto w-full px-6 py-8">
        <div className="mb-6">
          <h1 className="text-[22px] font-semibold text-foreground tracking-tight">Analytics</h1>
          <p className="text-[13.5px] text-muted-foreground mt-1">Overview of your DlJOS activity.</p>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-3 mb-8">
          <StatCard label="Total Actions" value={stats.totalActions} icon={Zap} color="text-primary" />
          <StatCard label="Pending Approval" value={stats.pendingActions} icon={Clock} color="text-amber-500" />
          <StatCard label="Completed" value={stats.completedActions} icon={CheckCircle2} color="text-emerald-500" />
          <StatCard label="Connected Platforms" value={stats.connectedPlatforms} icon={Plug} color="text-blue-500" />
        </div>

        {/* Chart: action history */}
        <div className="bg-card border border-card-border rounded-2xl p-5 mb-4">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={15} className="text-primary" />
            <p className="text-[13.5px] font-semibold text-foreground">Action History</p>
            <span className="ml-auto text-[11.5px] text-muted-foreground">Last 30 days</span>
          </div>
          {chartLoading ? (
            <div className="h-[180px] rounded-xl shimmer" />
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={chartData} margin={{ top: 4, right: 0, left: -28, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tickFormatter={formatChartDate}
                  tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                  axisLine={false}
                  tickLine={false}
                  interval={6}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: "hsl(var(--accent))", radius: 4 }} />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} maxBarSize={24} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* This week */}
        <div className="bg-card border border-card-border rounded-2xl p-5 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp size={15} className="text-primary" />
            <p className="text-[13.5px] font-semibold text-foreground">This week</p>
          </div>
          <p className="text-[32px] font-semibold text-foreground leading-none">{stats.actionsThisWeek}</p>
          <p className="text-[12.5px] text-muted-foreground mt-1">actions executed in the last 7 days</p>
        </div>

        {/* Recent activity */}
        {stats.recentActivity && stats.recentActivity.length > 0 && (
          <div className="bg-card border border-card-border rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border">
              <p className="text-[13.5px] font-semibold text-foreground">Recent Activity</p>
            </div>
            <div className="divide-y divide-border">
              {stats.recentActivity.map((action) => (
                <div
                  key={action.id}
                  className="flex items-center gap-3 px-5 py-3.5"
                  data-testid={`activity-row-${action.id}`}
                >
                  <div className={cn("w-2 h-2 rounded-full flex-shrink-0", STATUS_COLORS[action.status] ?? "bg-muted")} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-foreground truncate">{action.title}</p>
                    <p className="text-[11.5px] text-muted-foreground">{action.platform}</p>
                  </div>
                  <p className="text-[11.5px] text-muted-foreground flex-shrink-0">{formatDate(action.createdAt)}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
