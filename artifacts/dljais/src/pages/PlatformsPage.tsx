import { useListPlatforms, useUpdatePlatform, getListPlatformsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { RefreshCw } from "lucide-react";

const CATEGORY_LABELS: Record<string, string> = {
  social: "Social Media",
  ads: "Advertising",
  ecommerce: "E-commerce",
  trading: "Trading",
  food: "Food Delivery",
  website: "Website",
};

const STATUS_CONFIG = {
  connected: { dot: "bg-emerald-500", label: "Connected", textColor: "text-emerald-600 dark:text-emerald-400" },
  limited: { dot: "bg-amber-400", label: "Limited Access", textColor: "text-amber-600 dark:text-amber-400" },
  disconnected: { dot: "bg-red-400", label: "Not Connected", textColor: "text-red-500 dark:text-red-400" },
};

export default function PlatformsPage() {
  const { data: platforms, isLoading } = useListPlatforms();
  const updatePlatform = useUpdatePlatform();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleToggle = (id: number, currentStatus: string) => {
    const newStatus = currentStatus === "connected" ? "disconnected" : "connected";
    updatePlatform.mutate(
      { id, data: { status: newStatus } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListPlatformsQueryKey() });
          toast({ title: `Platform ${newStatus === "connected" ? "connected" : "disconnected"}` });
        },
      }
    );
  };

  const grouped = platforms
    ? platforms.reduce((acc, p) => {
        const cat = p.category;
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(p);
        return acc;
      }, {} as Record<string, typeof platforms>)
    : {};

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="max-w-[700px] mx-auto w-full px-6 py-8">
        <div className="mb-6">
          <h1 className="text-[22px] font-semibold text-foreground tracking-tight">Connected Platforms</h1>
          <p className="text-[13.5px] text-muted-foreground mt-1">
            Manage the platforms DlJiS can act on your behalf.
          </p>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-16 rounded-xl shimmer" />
            ))}
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(grouped).map(([category, items]) => (
              <div key={category}>
                <h2 className="text-[11.5px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 px-1">
                  {CATEGORY_LABELS[category] ?? category}
                </h2>
                <div className="bg-card border border-card-border rounded-2xl overflow-hidden divide-y divide-border">
                  {items.map((platform) => {
                    const cfg = STATUS_CONFIG[platform.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.disconnected;
                    return (
                      <div
                        key={platform.id}
                        className="flex items-center gap-4 px-4 py-3.5"
                        data-testid={`platform-row-${platform.id}`}
                      >
                        <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center text-[15px] font-bold flex-shrink-0">
                          {platform.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13.5px] font-medium text-foreground">{platform.name}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", cfg.dot)} />
                            <span className={cn("text-[12px]", cfg.textColor)}>{cfg.label}</span>
                            {platform.accountName && (
                              <span className="text-[12px] text-muted-foreground">· {platform.accountName}</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {platform.lastSync && (
                            <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                              <RefreshCw size={10} />
                              {new Date(platform.lastSync).toLocaleDateString()}
                            </div>
                          )}
                          <button
                            onClick={() => handleToggle(platform.id, platform.status)}
                            className={cn(
                              "text-[12px] font-medium px-3 py-1.5 rounded-lg border transition-all",
                              platform.status === "connected"
                                ? "border-border text-muted-foreground hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30"
                                : "border-primary/30 text-primary bg-primary/5 hover:bg-primary/10"
                            )}
                            data-testid={`button-toggle-platform-${platform.id}`}
                          >
                            {platform.status === "connected" ? "Disconnect" : "Connect"}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
