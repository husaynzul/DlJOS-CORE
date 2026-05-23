import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
import {
  MessageSquare, Zap, BarChart2, Plug, Plus, Settings, Menu, X,
} from "lucide-react";
import { useListConversations, useGetPendingActionCount } from "@workspace/api-client-react";
import { cn } from "@/lib/utils";

interface NavItem { href: string; label: string; icon: React.ElementType }

const navItems: NavItem[] = [
  { href: "/", label: "New chat", icon: Plus },
  { href: "/history", label: "Chats", icon: MessageSquare },
  { href: "/actions", label: "Actions", icon: Zap },
  { href: "/platforms", label: "Platforms", icon: Plug },
  { href: "/stats", label: "Analytics", icon: BarChart2 },
];

const PLATFORM_DOTS = [
  { label: "Social", status: "connected" },
  { label: "Ads", status: "limited" },
  { label: "Trading", status: "disconnected" },
  { label: "E-commerce", status: "connected" },
];

function StatusDot({ status }: { status: string }) {
  return <span className={cn("inline-block w-2 h-2 rounded-full flex-shrink-0",
    status === "connected" && "bg-emerald-500",
    status === "limited" && "bg-amber-400",
    status === "disconnected" && "bg-red-400")} />;
}

function AppLogo({ size = 28, spin = false }: { size?: number; spin?: boolean }) {
  return (
    <img
      src="/dljais-logo.jpg"
      alt="DlJiS"
      width={size}
      height={size}
      className={cn("rounded-full object-contain", spin && "animate-spin-slow")}
      style={{ filter: "drop-shadow(0 0 6px rgba(205,110,75,0.35))" }}
    />
  );
}

export { AppLogo };

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [location] = useLocation();
  const { data: conversations } = useListConversations();
  const { data: pendingCount } = useGetPendingActionCount();
  const drawerRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setDrawerOpen(false); }, [location]);

  useEffect(() => {
    if (!drawerOpen) return;
    const handler = (e: MouseEvent) => {
      if (drawerRef.current && !drawerRef.current.contains(e.target as Node)) setDrawerOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [drawerOpen]);

  return (
    <div className="flex flex-col h-[100dvh] w-full bg-background overflow-hidden">

      {/* Top bar */}
      <header className="flex items-center justify-between px-4 h-14 flex-shrink-0 border-b border-border bg-background z-20">
        <button
          onClick={() => setDrawerOpen(true)}
          className="p-2 -ml-2 text-muted-foreground hover:text-foreground rounded-lg hover:bg-accent transition-colors"
          data-testid="button-menu"
        >
          <Menu size={20} />
        </button>

        <Link href="/" className="flex items-center gap-2">
          <AppLogo size={28} />
          <span className="font-semibold text-[16px] tracking-tight text-foreground">DlJiS</span>
        </Link>

        <Link href="/settings">
          <button className="p-2 -mr-2 rounded-lg hover:bg-accent transition-colors" data-testid="button-settings-top">
            <AppLogo size={26} />
          </button>
        </Link>
      </header>

      {/* Slide-out drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-40 flex">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={() => setDrawerOpen(false)} />
          <div
            ref={drawerRef}
            className="relative w-72 h-full bg-sidebar flex flex-col shadow-2xl z-50 animate-in slide-in-from-left duration-200"
          >
            {/* Drawer header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-sidebar-border">
              <div className="flex items-center gap-2.5">
                <AppLogo size={30} />
                <span className="font-semibold text-[17px] text-foreground tracking-tight">DlJiS</span>
              </div>
              <button onClick={() => setDrawerOpen(false)} className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-accent transition-colors">
                <X size={18} />
              </button>
            </div>

            {/* Nav */}
            <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isNewChat = item.href === "/";
                const isActive = !isNewChat && (location === item.href || location.startsWith(item.href + "/"));
                return (
                  <Link key={item.href} href={item.href}>
                    <div className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-xl text-[14px] font-medium transition-colors cursor-pointer",
                      isNewChat ? "text-primary hover:bg-accent"
                        : isActive ? "bg-accent text-foreground"
                        : "text-muted-foreground hover:text-foreground hover:bg-accent"
                    )} data-testid={`nav-${item.label.toLowerCase().replace(" ", "-")}`}>
                      <Icon size={17} className="flex-shrink-0" />
                      <span>{item.label}</span>
                      {item.href === "/actions" && (pendingCount?.count ?? 0) > 0 && (
                        <span className="ml-auto bg-primary text-primary-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-full">{pendingCount!.count}</span>
                      )}
                    </div>
                  </Link>
                );
              })}

              {/* Recents */}
              {conversations && conversations.length > 0 && (
                <div className="mt-4">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-3 mb-1.5">Recents</p>
                  {conversations.slice(0, 8).map((conv) => (
                    <Link key={conv.id} href={`/chat/${conv.id}`}>
                      <div className={cn(
                        "flex items-center gap-2 px-3 py-2 rounded-xl text-[13px] text-muted-foreground hover:text-foreground hover:bg-accent transition-colors cursor-pointer",
                        location === `/chat/${conv.id}` && "bg-accent text-foreground"
                      )} data-testid={`link-conv-${conv.id}`}>
                        <MessageSquare size={13} className="flex-shrink-0 opacity-50" />
                        <span className="truncate">{conv.title}</span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}

              {/* Platform dots */}
              <div className="mt-4 px-3">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Platforms</p>
                <div className="space-y-1.5">
                  {PLATFORM_DOTS.map((p) => (
                    <div key={p.label} className="flex items-center gap-2">
                      <StatusDot status={p.status} />
                      <span className="text-[12.5px] text-muted-foreground">{p.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </nav>

            {/* Bottom user row */}
            <div className="px-3 py-3 border-t border-sidebar-border">
              <Link href="/settings">
                <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13.5px] text-muted-foreground hover:text-foreground hover:bg-accent transition-colors cursor-pointer">
                  <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center text-[12px] font-bold text-primary-foreground flex-shrink-0">H</div>
                  <span className="flex-1 truncate">HusaynZul</span>
                  <Settings size={14} />
                </div>
              </Link>
            </div>
          </div>
        </div>
      )}

      <main className="flex-1 overflow-hidden flex flex-col min-h-0">
        {children}
      </main>
    </div>
  );
}
