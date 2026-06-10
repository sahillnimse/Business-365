import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { z } from "zod";
import { apiGet, type ValidationResponse, type ValidationResultRow } from "@/lib/api";
import { Spinner, ErrBox, Empty, KpiCard, TableWrap, THead, TR, TD, StatusBadge } from "@/components/ui-bits";
import { PageHeader, TabBar } from "@/components/TabBar";
import { Play, Download, Search } from "lucide-react";

const tabSchema = z.object({ tab: z.enum(["run", "history", "settings"]).optional() });

export const Route = createFileRoute("/validation")({
  validateSearch: tabSchema,
  head: () => ({
    meta: [
      { title: "Validation — PO‑Validator" },
      { name: "description", content: "Run PO validation and review results, history, and settings." },
    ],
  }),
  component: ValidationPage,
});

interface HistoryRun {
  id: string;
  ranAt: string;
  total: number;
  pass: number;
  auto_map: number;
  block_inactive: number;
  block_unknown: number;
}
const HISTORY_KEY = "po_validation_history";
function loadHistory(): HistoryRun[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function ValidationPage() {
  const { tab = "run" } = Route.useSearch();
  return (
    <div>
      <PageHeader
        title="Validation"
        subtitle="Run the validator against current PO lines and inspect per‑row results."
      />
      <TabBar moduleId="validation" activeTab={tab} />
      {tab === "run" && <RunTab />}
      {tab === "history" && <HistoryTab />}
      {tab === "settings" && <SettingsTab />}
    </div>
  );
}

function RunTab() {
  const [trigger, setTrigger] = useState(0);
  const [filter, setFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  const { data, isLoading, error, isFetching } = useQuery({
    queryKey: ["validate", trigger],
    queryFn: async () => {
      const res = await apiGet<ValidationResponse>("/validate");
      // record history
      try {
        const hist = loadHistory();
        hist.unshift({
          id: crypto.randomUUID(),
          ranAt: new Date().toISOString(),
          total: res.total,
          pass: res.pass,
          auto_map: res.auto_map,
          block_inactive: res.block_inactive,
          block_unknown: res.block_unknown,
        });
        localStorage.setItem(HISTORY_KEY, JSON.stringify(hist.slice(0, 50)));
      } catch {
        /* ignore */
      }
      return res;
    },
  });

  const filtered = useMemo(() => {
    if (!data) return [] as ValidationResultRow[];
    const q = filter.toLowerCase();
    return data.results.filter((r) => {
      if (statusFilter !== "ALL" && r.status.toUpperCase().replace("-", "_") !== statusFilter) return false;
      if (!q) return true;
      return (
        r.po_number.toLowerCase().includes(q) ||
        r.original_code.toLowerCase().includes(q) ||
        r.mapped_code.toLowerCase().includes(q) ||
        r.message.toLowerCase().includes(q)
      );
    });
  }, [data, filter, statusFilter]);

  function exportCsv() {
    if (!data) return;
    const header = ["PO", "Line", "Original", "Mapped", "Status", "Message", "Timestamp", "Validated By"];
    const rows = filtered.map((r) => [
      r.po_number,
      r.line_num,
      r.original_code,
      r.mapped_code,
      r.status,
      r.message.replace(/"/g, '""'),
      r.timestamp,
      r.validated_by,
    ]);
    const csv = [header, ...rows].map((row) => row.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `validation-${new Date().toISOString()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={() => setTrigger((t) => t + 1)}
          disabled={isFetching}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-all hover:opacity-90 disabled:opacity-50"
        >
          <Play className="h-4 w-4" />
          {isFetching ? "Running…" : "Run validation"}
        </button>
        <button
          onClick={exportCsv}
          disabled={!data}
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-card/50 px-4 py-2 text-sm font-medium transition-all hover:bg-accent disabled:opacity-50"
        >
          <Download className="h-4 w-4" /> Export CSV
        </button>
      </div>

      {isLoading && <Spinner label="Validating PO lines…" />}
      {error && <ErrBox error={error} />}
      {data && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <KpiCard label="Total" value={data.total} />
            <KpiCard label="Pass" value={data.pass} tone="pass" />
            <KpiCard label="Auto‑map" value={data.auto_map} tone="info" />
            <KpiCard label="Block inactive" value={data.block_inactive} tone="warn" />
            <KpiCard label="Block unknown" value={data.block_unknown} tone="block" />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Filter PO, code, message…"
                className="w-72 rounded-lg border border-border bg-card/40 py-2 pl-9 pr-3 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg border border-border bg-card/40 px-3 py-2 text-sm focus:border-primary focus:outline-none"
            >
              <option value="ALL">All statuses</option>
              <option value="PASS">PASS</option>
              <option value="AUTO_MAP">AUTO‑MAP</option>
              <option value="BLOCK_INACTIVE">BLOCK‑INACTIVE</option>
              <option value="BLOCK_UNKNOWN">BLOCK‑UNKNOWN</option>
            </select>
            <span className="text-xs text-muted-foreground">{filtered.length} rows</span>
          </div>

          {filtered.length === 0 ? (
            <Empty>No rows match your filters.</Empty>
          ) : (
            <TableWrap>
              <THead cols={["PO", "Line", "Original", "Mapped", "Status", "Message", "Validated"]} />
              <tbody>
                {filtered.map((r, i) => (
                  <TR key={`${r.po_number}-${r.line_num}-${i}`}>
                    <TD mono>{r.po_number}</TD>
                    <TD>{r.line_num}</TD>
                    <TD mono>{r.original_code}</TD>
                    <TD mono>{r.mapped_code}</TD>
                    <TD>
                      <StatusBadge status={r.status} />
                    </TD>
                    <TD>{r.message}</TD>
                    <TD>
                      <span className="text-xs text-muted-foreground">{r.validated_by}</span>
                    </TD>
                  </TR>
                ))}
              </tbody>
            </TableWrap>
          )}
        </>
      )}
    </div>
  );
}

function HistoryTab() {
  const [history, setHistory] = useState<HistoryRun[]>(loadHistory());
  if (history.length === 0) return <Empty>No previous runs. Trigger a validation to start logging history.</Empty>;
  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button
          onClick={() => {
            localStorage.removeItem(HISTORY_KEY);
            setHistory([]);
          }}
          className="rounded-lg border border-border bg-card/50 px-3 py-1.5 text-xs hover:bg-accent"
        >
          Clear history
        </button>
      </div>
      <TableWrap>
        <THead cols={["When", "Total", "Pass", "Auto‑map", "Block inactive", "Block unknown"]} />
        <tbody>
          {history.map((h) => (
            <TR key={h.id}>
              <TD>{new Date(h.ranAt).toLocaleString()}</TD>
              <TD>{h.total}</TD>
              <TD>
                <span className="text-emerald-300">{h.pass}</span>
              </TD>
              <TD>
                <span className="text-sky-300">{h.auto_map}</span>
              </TD>
              <TD>
                <span className="text-amber-300">{h.block_inactive}</span>
              </TD>
              <TD>
                <span className="text-rose-300">{h.block_unknown}</span>
              </TD>
            </TR>
          ))}
        </tbody>
      </TableWrap>
    </div>
  );
}

function SettingsTab() {
  const [autoMap, setAutoMap] = useState(true);
  const [hideKnown, setHideKnown] = useState(false);
  return (
    <div className="max-w-xl space-y-4 rounded-2xl border border-border/60 bg-card/40 p-6 backdrop-blur-xl">
      <Toggle label="Enable auto‑mapping" hint="Apply code-mapping table to remap inactive codes." value={autoMap} onChange={setAutoMap} />
      <Toggle label="Hide PASS rows by default" hint="Focus on rows that need attention." value={hideKnown} onChange={setHideKnown} />
      <p className="text-xs text-muted-foreground">
        These preferences are stored locally and don't change server behavior.
      </p>
    </div>
  );
}

function Toggle({ label, hint, value, onChange }: { label: string; hint?: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4">
      <div>
        <div className="text-sm font-medium">{label}</div>
        {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
      </div>
      <button
        type="button"
        onClick={() => onChange(!value)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${value ? "bg-primary" : "bg-muted"}`}
      >
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${value ? "translate-x-5" : "translate-x-0.5"}`} />
      </button>
    </label>
  );
}
