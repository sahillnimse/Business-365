import { ReactNode } from "react";

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 text-muted-foreground">
      <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      <span className="text-sm">{label ?? "Loading…"}</span>
    </div>
  );
}

export function ErrBox({ error }: { error: unknown }) {
  const msg = error instanceof Error ? error.message : String(error);
  return (
    <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
      <div className="font-semibold">Something went wrong</div>
      <div className="mt-1 opacity-90">{msg}</div>
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-card/40 px-6 py-10 text-center text-sm text-muted-foreground">
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
  const tones: Record<string, string> = {
    default: "from-card/80 to-card/40",
    pass: "from-emerald-500/15 to-emerald-500/5",
    warn: "from-amber-500/15 to-amber-500/5",
    block: "from-rose-500/15 to-rose-500/5",
    info: "from-sky-500/15 to-sky-500/5",
  };
  return (
    <div
      className={`rounded-2xl border border-border/60 bg-gradient-to-br ${tones[tone]} p-5 shadow-sm backdrop-blur-xl`}
    >
      <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-2 text-3xl font-semibold tracking-tight">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

export function TableWrap({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border/60 bg-card/40 backdrop-blur-xl">
      <div className="max-h-[65vh] overflow-auto">
        <table className="w-full border-collapse text-sm">{children}</table>
      </div>
    </div>
  );
}

export function THead({ cols }: { cols: string[] }) {
  return (
    <thead className="sticky top-0 z-10 bg-card/90 backdrop-blur">
      <tr>
        {cols.map((c) => (
          <th
            key={c}
            className="border-b border-border/60 px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground"
          >
            {c}
          </th>
        ))}
      </tr>
    </thead>
  );
}

export function TR({ children }: { children: ReactNode }) {
  return <tr className="border-b border-border/30 transition-colors hover:bg-accent/30">{children}</tr>;
}

export function TD({ children, mono }: { children: ReactNode; mono?: boolean }) {
  return <td className={`px-3 py-2 ${mono ? "font-mono text-xs" : ""}`}>{children}</td>;
}

export function StatusBadge({ status }: { status: string }) {
  const s = status.toUpperCase().replace("-", "_");
  const styles: Record<string, string> = {
    PASS: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    AUTO_MAP: "bg-sky-500/15 text-sky-300 border-sky-500/30",
    BLOCK_INACTIVE: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    BLOCK_UNKNOWN: "bg-rose-500/15 text-rose-300 border-rose-500/30",
  };
  const cls = styles[s] ?? "bg-muted text-muted-foreground border-border";
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${cls}`}>
      {status}
    </span>
  );
}
