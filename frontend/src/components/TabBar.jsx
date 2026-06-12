import { Link, useLocation } from "react-router-dom";
import { MODULES } from "@/lib/modules";

export function TabBar({ moduleId, activeTab }) {
  const mod = MODULES.find((m) => m.id === moduleId);
  const pathname = useLocation().pathname;
  if (!mod || mod.tabs.length === 0) return null;
  return (
    <div className="mb-6 inline-flex flex-wrap gap-1 rounded-xl border border-border/60 bg-muted/40 p-1">
      {mod.tabs.map((t) => {
        const active = activeTab === t.id;
        return (
          <Link
            key={t.id}
            to={`${pathname}?tab=${t.id}`}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${
              active
                ? "bg-card text-primary shadow-sm ring-1 ring-border/60"
                : "text-muted-foreground hover:bg-card/60 hover:text-foreground"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{title}</h1>
        {subtitle && <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  );
}
