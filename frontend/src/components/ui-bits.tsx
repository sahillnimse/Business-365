import { ReactNode } from "react";

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 text-muted-foreground">
      <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
      <span className="text-sm">{label ?? "Loading…"}</span>
    </div>
  );
}

export function ErrBox({ error }: { error: unknown }) {
  const msg = error instanceof Error ? error.message : String(error);
  return (
    <div className="rounded-xl border border-destructive/30 bg-destructive/8 px-4 py-3 text-sm text-destructive shadow-sm">
      <div className="font-semibold">Something went wrong</div>
      <div className="mt-1 opacity-90">{msg}</div>
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-border/80 bg-muted/30 px-6 py-12 text-center text-sm text-muted-foreground">
      {children}
    </div>
  );
}

export function KpiCard({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: "default" | "pass" | "warn" | "block" | "info";
}) {
  const tones: Record<string, { bg: string; accent: string }> = {
    default: { bg: "from-card to-muted/40", accent: "bg-primary/60" },
    pass: { bg: "from-emerald-500/10 to-card", accent: "bg-emerald-500" },
    warn: { bg: "from-amber-500/10 to-card", accent: "bg-amber-500" },
    block: { bg: "from-rose-500/10 to-card", accent: "bg-rose-500" },
    info: { bg: "from-primary/10 to-card", accent: "bg-primary" },
  };
  const t = tones[tone] ?? tones.default;
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br p-5 shadow-sm transition-shadow hover:shadow-md">
      <div className={`absolute left-0 top-0 h-full w-1 ${t.accent} opacity-80`} />
      <div className={`absolute inset-0 bg-gradient-to-br ${t.bg} opacity-80`} />
      <div className="relative">
        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="mt-2 text-3xl font-bold tracking-tight text-foreground">{value}</div>
        {hint && <div className="mt-1.5 text-xs text-muted-foreground">{hint}</div>}
      </div>
    </div>
  );
}

export function TableWrap({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border/60 glass-panel">
      <div className="max-h-[65vh] overflow-auto">
        <table className="w-full border-collapse text-sm">{children}</table>
      </div>
    </div>
  );
}

export function THead({ cols }: { cols: string[] }) {
  return (
    <thead className="sticky top-0 z-10 bg-muted/80 backdrop-blur-sm">
      <tr>
        {cols.map((c) => (
          <th
            key={c}
            className="border-b border-border/60 px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
          >
            {c}
          </th>
        ))}
      </tr>
    </thead>
  );
}

export function TR({ children }: { children: ReactNode }) {
  return (
    <tr className="border-b border-border/40 transition-colors even:bg-muted/20 hover:bg-accent/40">
      {children}
    </tr>
  );
}

export function TD({ children, mono }: { children: ReactNode; mono?: boolean }) {
  return <td className={`px-4 py-2.5 ${mono ? "font-mono text-xs text-muted-foreground" : ""}`}>{children}</td>;
}

export function StatusBadge({ status }: { status: string }) {
  const s = status.toUpperCase().replaceAll("-", "_");
  const styles: Record<string, string> = {
    PASS: "bg-emerald-500/12 text-emerald-700 border-emerald-500/25 dark:text-emerald-300",
    AUTO_MAP: "bg-sky-500/12 text-sky-700 border-sky-500/25 dark:text-sky-300",
    BLOCK_INACTIVE: "bg-amber-500/12 text-amber-700 border-amber-500/25 dark:text-amber-300",
    BLOCK_UNKNOWN: "bg-rose-500/12 text-rose-700 border-rose-500/25 dark:text-rose-300",
    REJECT_EXISTS: "bg-rose-500/12 text-rose-700 border-rose-500/25 dark:text-rose-300",
    REJECT_DUPLICATE: "bg-amber-500/12 text-amber-700 border-amber-500/25 dark:text-amber-300",
    REJECT_MISSING_CODE: "bg-sky-500/12 text-sky-700 border-sky-500/25 dark:text-sky-300",
  };
  const cls = styles[s] ?? "bg-muted text-muted-foreground border-border";
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold tracking-wide ${cls}`}>
      {status}
    </span>
  );
}

export function SectionCard({ title, children, className = "" }: { title?: string; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-border/60 glass-panel p-6 ${className}`}>
      {title && <h3 className="mb-4 text-sm font-semibold text-foreground">{title}</h3>}
      {children}
    </section>
  );
}
