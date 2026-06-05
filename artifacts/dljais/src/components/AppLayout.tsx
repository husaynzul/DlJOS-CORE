import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
import { MessageSquare, Zap, BarChart2, Plug, Plus, Settings, Menu, X } from "lucide-react";
import { useListConversations, useGetPendingActionCount } from "@workspace/api-client-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/", label: "New chat", icon: Plus },
  { href: "/history", label: "Chats", icon: MessageSquare },
  { href: "/actions", label: "Actions", icon: Zap },
  { href: "/platforms", label: "Platforms", icon: Plug },
  { href: "/stats", label: "Analytics", icon: BarChart2 },
];

const PLATFORM_DOTS = [
  { label: "Social",     status: "connected" },
  { label: "Ads",        status: "limited" },
  { label: "Trading",    status: "disconnected" },
  { label: "E-commerce", status: "connected" },
];

function Dot({ status }: { status: string }) {
  return <span className={cn("inline-block w-2 h-2 rounded-full flex-shrink-0",
    status === "connected" && "bg-emerald-500",
    status === "limited"   && "bg-amber-400",
    status === "disconnected" && "bg-red-400")} />;
}

export function DlJOSLogo({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <img
      src="/dljos-logo.jpg"
      alt="DlJOS"
      width={size}
      height={size}
      className={cn("object-contain rounded-lg dark:invert", className)}
      style={{ imageRendering: "crisp-edges" }}
    />
  );
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [location] = useLocation();
  const { data: conversations } = useListConversations();
  const { data: pendingCount } = useGetPendingActionCount();
  const drawerRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setDrawerOpen(false); }, [location]);

  useEffect(() => {
    if (!drawerOpen) return;
    const fn = (e: MouseEvent) => {
      if (drawerRef.current && !drawerRef.current.contains(e.target as Node)) setDrawerOpen(false);
    };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, [drawerOpen]);

  return (
    <div className="flex flex-col h-[100dvh] w-full bg-background overflow-hidden">

      {/* ── Top bar ── */}
      <header className="flex items-center h-14 px-3 flex-shrink-0 border-b border-border bg-background z-20 relative">
        {/* Left: hamburger */}
        <button onClick={() => setDrawerOpen(true)}
          className="p-2 text-muted-foreground hover:text-foreground rounded-lg hover:bg-accent transition-colors flex-shrink-0"
          data-testid="button-menu">
          <Menu size={20} />
        </button>

        {/* Center: logo + name — clicking opens Settings */}
        <Link href="/settings" className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2">
          <DlJOSLogo size={28} />
          <span className="font-semibold text-[16px] tracking-tight text-foreground">DlJOS</span>
        </Link>

        {/* Right: empty spacer so center stays centered */}
        <div className="ml-auto w-9 flex-shrink-0" />
      </header>

      {/* ── Slide-out drawer ── */}
      {drawerOpen && (
        <div className="fixed inset-0 z-40 flex">
          <div className="absolute inset-0 bg-black/45 backdrop-blur-[2px]" onClick={() => setDrawerOpen(false)} />
          <div ref={drawerRef}
            className="relative w-[280px] h-full bg-sidebar flex flex-col shadow-2xl z-50 animate-in slide-in-from-left duration-200">

            {/* Drawer header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-sidebar-border">
              <div className="flex items-center gap-2.5">
                <DlJOSLogo size={30} />
                <span className="font-semibold text-[17px] text-foreground tracking-tight">DlJOS</span>
              </div>
              <button onClick={() => setDrawerOpen(false)} className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-accent transition-colors">
                <X size={18} />
              </button>
            </div>

            {/* Nav */}
            <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">
              {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
                const isNew = href === "/";
                const isActive = !isNew && (location === href || location.startsWith(href + "/"));
                return (
                  <Link key={href} href={href}>
                    <div className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-xl text-[14px] font-medium transition-colors cursor-pointer",
                      isNew    ? "text-primary hover:bg-accent"
                      : isActive ? "bg-accent text-foreground"
                      :            "text-muted-foreground hover:text-foreground hover:bg-accent"
                    )} data-testid={`nav-${label.toLowerCase().replace(" ","-")}`}>
                      <Icon size={17} className="flex-shrink-0" />
                      <span className="flex-1">{label}</span>
                      {href === "/actions" && (pendingCount?.count ?? 0) > 0 && (
                        <span className="bg-primary text-primary-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                          {pendingCount!.count}
                        </span>
                      )}
                    </div>
                  </Link>
                );
              })}

              {/* Recent conversations */}
              {(conversations?.length ?? 0) > 0 && (
                <div className="mt-4">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-3 mb-1.5">Recents</p>
                  {conversations!.slice(0, 8).map((c) => (
                    <Link key={c.id} href={`/chat/${c.id}`}>
                      <div className={cn(
                        "flex items-center gap-2 px-3 py-2 rounded-xl text-[13px] text-muted-foreground hover:text-foreground hover:bg-accent transition-colors cursor-pointer",
                        location === `/chat/${c.id}` && "bg-accent text-foreground"
                      )}>
                        <MessageSquare size={13} className="flex-shrink-0 opacity-50" />
                        <span className="truncate">{c.title}</span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}

            </nav>

            {/* Bottom: user row → Settings */}
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

      {/* ── Page content ── */}
      <main className="flex-1 overflow-hidden flex flex-col min-h-0">
        {children}
      </main>
    </div>
  );
}
