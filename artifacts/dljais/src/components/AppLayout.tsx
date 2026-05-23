import { useState } from "react";
import { Link, useLocation } from "wouter";
import {
  MessageSquare,
  History,
  Zap,
  BarChart2,
  Plug,
  Plus,
  Sun,
  Moon,
  Settings,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useListConversations, useGetPendingActionCount } from "@workspace/api-client-react";
import { useTheme } from "@/components/ThemeProvider";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
}

const navItems: NavItem[] = [
  { href: "/", label: "New Chat", icon: Plus },
  { href: "/history", label: "History", icon: History },
  { href: "/actions", label: "Actions", icon: Zap },
  { href: "/platforms", label: "Platforms", icon: Plug },
  { href: "/stats", label: "Analytics", icon: BarChart2 },
];

const PLATFORM_DOTS = [
  { label: "Social", color: "connected" },
  { label: "Ads", color: "limited" },
  { label: "Trading", color: "disconnected" },
  { label: "E-commerce", color: "connected" },
];

function StatusDot({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-block w-2 h-2 rounded-full flex-shrink-0",
        status === "connected" && "bg-emerald-500",
        status === "limited" && "bg-amber-400",
        status === "disconnected" && "bg-red-400"
      )}
    />
  );
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [location] = useLocation();
  const { theme, toggleTheme } = useTheme();
  const { data: conversations } = useListConversations();
  const { data: pendingCount } = useGetPendingActionCount();

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      {/* Sidebar */}
      <aside
        className={cn(
          "flex flex-col bg-sidebar border-r border-sidebar-border transition-all duration-300 flex-shrink-0",
          collapsed ? "w-14" : "w-64"
        )}
      >
        {/* Logo */}
        <div className="flex items-center justify-between px-4 py-5 border-b border-sidebar-border">
          {!collapsed && (
            <Link href="/" className="flex items-center gap-2.5 group">
              <DljaLogo />
              <span className="font-semibold text-[15px] text-foreground tracking-tight">DLJAIS</span>
            </Link>
          )}
          {collapsed && (
            <Link href="/" className="mx-auto">
              <DljaLogo />
            </Link>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className={cn(
              "p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors",
              collapsed && "mx-auto mt-0"
            )}
            data-testid="button-toggle-sidebar"
          >
            {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
            return (
              <Link key={item.href} href={item.href}>
                <div
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-lg text-[13.5px] font-medium transition-colors cursor-pointer relative",
                    isActive
                      ? "bg-accent text-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent",
                    collapsed && "justify-center px-2"
                  )}
                  data-testid={`nav-${item.label.toLowerCase().replace(" ", "-")}`}
                >
                  <Icon size={16} className="flex-shrink-0" />
                  {!collapsed && <span>{item.label}</span>}
                  {!collapsed && item.href === "/actions" && (pendingCount?.count ?? 0) > 0 && (
                    <span className="ml-auto bg-primary text-primary-foreground text-[10px] font-semibold px-1.5 py-0.5 rounded-full">
                      {pendingCount!.count}
                    </span>
                  )}
                </div>
              </Link>
            );
          })}

          {/* Recent conversations */}
          {!collapsed && conversations && conversations.length > 0 && (
            <div className="mt-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-3 mb-1.5">
                Recents
              </p>
              {conversations.slice(0, 6).map((conv) => (
                <Link key={conv.id} href={`/chat/${conv.id}`}>
                  <div
                    className={cn(
                      "flex items-center gap-2 px-3 py-1.5 rounded-lg text-[13px] text-muted-foreground hover:text-foreground hover:bg-accent transition-colors cursor-pointer",
                      location === `/chat/${conv.id}` && "bg-accent text-foreground"
                    )}
                    data-testid={`link-conversation-${conv.id}`}
                  >
                    <MessageSquare size={13} className="flex-shrink-0 opacity-60" />
                    <span className="truncate">{conv.title}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}

          {/* Platform status */}
          {!collapsed && (
            <div className="mt-4 px-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Platforms
              </p>
              <div className="space-y-1.5">
                {PLATFORM_DOTS.map((p) => (
                  <div key={p.label} className="flex items-center gap-2">
                    <StatusDot status={p.color} />
                    <span className="text-[12px] text-muted-foreground">{p.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </nav>

        {/* Bottom controls */}
        <div className={cn("px-2 py-3 border-t border-sidebar-border space-y-0.5", collapsed && "px-1")}>
          <button
            onClick={toggleTheme}
            className={cn(
              "flex items-center gap-3 px-3 py-2 w-full rounded-lg text-[13.5px] text-muted-foreground hover:text-foreground hover:bg-accent transition-colors",
              collapsed && "justify-center px-2"
            )}
            data-testid="button-toggle-theme"
          >
            {theme === "light" ? <Moon size={16} /> : <Sun size={16} />}
            {!collapsed && <span>{theme === "light" ? "Dark mode" : "Light mode"}</span>}
          </button>
          <div
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-lg text-[13.5px] text-muted-foreground hover:text-foreground hover:bg-accent transition-colors cursor-pointer",
              collapsed && "justify-center px-2"
            )}
            data-testid="nav-settings"
          >
            <Settings size={16} />
            {!collapsed && <span>Settings</span>}
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-hidden flex flex-col">
        {children}
      </main>
    </div>
  );
}

function DljaLogo() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" className="flex-shrink-0">
      <path
        d="M12 2L13.8 8.2L20 10L13.8 11.8L12 18L10.2 11.8L4 10L10.2 8.2L12 2Z"
        fill="hsl(14, 65%, 58%)"
      />
      <path
        d="M19 15L19.9 17.1L22 18L19.9 18.9L19 21L18.1 18.9L16 18L18.1 17.1L19 15Z"
        fill="hsl(14, 65%, 58%)"
        opacity="0.6"
      />
      <path
        d="M5 2L5.7 3.8L7.5 4.5L5.7 5.2L5 7L4.3 5.2L2.5 4.5L4.3 3.8L5 2Z"
        fill="hsl(14, 65%, 58%)"
        opacity="0.4"
      />
    </svg>
  );
}
