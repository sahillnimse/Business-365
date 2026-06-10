import { Link, useRouterState } from "@tanstack/react-router";
import { MODULES } from "@/lib/modules";

export function TabBar({ moduleId, activeTab }: { moduleId: string; activeTab: string }) {
  const mod = MODULES.find((m) => m.id === moduleId);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  if (!mod || mod.tabs.length === 0) return null;
  return (
    <div className="mb-6 flex flex-wrap gap-1 rounded-xl border border-border/60 bg-card/40 p-1 backdrop-blur-xl">
      {mod.tabs.map((t) => {
        const active = activeTab === t.id;
        return (
          <Link
            key={t.id}
            to={pathname}
            search={{ tab: t.id }}
            className={`rounded-lg px-4 py-1.5 text-sm transition-all ${
              active
                ? "bg-primary/15 font-medium text-primary shadow-sm"
                : "text-muted-foreground hover:bg-accent/40 hover:text-foreground"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  );
}
