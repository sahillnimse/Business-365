import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import { apiGet } from "@/lib/api";
import { Spinner, ErrBox, Empty, KpiCard, TableWrap, THead, TR, TD, StatusBadge } from "@/components/ui-bits";
import { PageHeader, TabBar } from "@/components/TabBar";
import { Play, Download, Search } from "lucide-react";

const HISTORY_KEY = "po_validation_history";

function loadHistory() {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]");
  } catch {
    return [];
  }
}

export default function ValidationPage() {
  const [searchParams] = useSearchParams();
  const tab = searchParams.get("tab") || "run";
  return (
    <div>
      <PageHeader
        title="Validation"
        subtitle="Reject duplicate or already-present item codes, and pass new item codes forward."
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
  const [statusFilter, setStatusFilter] = useState("ALL");
  const lastHistorySignature = useRef("");

  const { data, isLoading, error, isFetching } = useQuery({
    queryKey: ["validate", trigger],
    queryFn: async () => {
      const res = await apiGet("/validate");
      try {
        const signature = `${res.total}:${res.pass}:${res.rejected ?? res.block_unknown}:${res.duplicate ?? 0}:${res.missing_code ?? 0}`;
        if (signature === lastHistorySignature.current) return res;
        lastHistorySignature.current = signature;
        const hist = loadHistory();
        hist.unshift({
          id: crypto.randomUUID(),
          ranAt: new Date().toISOString(),
          total: res.total,
          pass: res.pass,
          rejected: res.rejected ?? res.block_unknown,
          duplicate: res.duplicate ?? 0,
          missing_code: res.missing_code ?? 0,
        });
        localStorage.setItem(HISTORY_KEY, JSON.stringify(hist.slice(0, 50)));
      } catch {
        /* ignore local history failures */
      }
      return res;
    },
    refetchInterval: 10_000,
  });

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = filter.toLowerCase();
    return data.results.filter((r) => {
      if (statusFilter !== "ALL" && r.status.toUpperCase().replaceAll("-", "_") !== statusFilter) return false;
      if (!q) return true;
      return (
        r.po_number.toLowerCase().includes(q) ||
        r.original_code.toLowerCase().includes(q) ||
        r.mapped_code.toLowerCase().includes(q) ||
        r.message.toLowerCase().includes(q) ||
        (r.notification_message ?? "").toLowerCase().includes(q)
      );
    });
  }, [data, filter, statusFilter]);

  function exportCsv() {
    if (!data) return;
    const header = ["PO", "Line", "Item Code", "Result", "Status", "Message", "Notification", "Timestamp", "Validated By"];
    const rows = filtered.map((r) => [
      r.po_number,
      r.line_num,
      r.original_code,
      r.mapped_code,
      r.status,
      r.message.replace(/"/g, '""'),
      (r.notification_message ?? "").replace(/"/g, '""'),
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
          {isFetching ? "Running..." : "Run validation"}
        </button>
        <button
          onClick={exportCsv}
          disabled={!data}
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-card/50 px-4 py-2 text-sm font-medium transition-all hover:bg-accent disabled:opacity-50"
        >
          <Download className="h-4 w-4" /> Export CSV
        </button>
      </div>

      {isLoading && <Spinner label="Validating item codes..." />}
      {error && <ErrBox error={error} />}
      {data && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <KpiCard label="Total" value={data.total} />
            <KpiCard label="Pass" value={data.pass} tone="pass" />
            <KpiCard label="Rejected" value={data.rejected ?? data.block_unknown} tone="block" />
            <KpiCard label="Duplicate/existing" value={data.duplicate ?? 0} tone="warn" />
            <KpiCard label="Missing code" value={data.missing_code ?? 0} tone="info" />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Filter PO, code, message..."
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
              <option value="REJECT_EXISTS">REJECT-EXISTS</option>
              <option value="REJECT_DUPLICATE">REJECT-DUPLICATE</option>
              <option value="REJECT_MISSING_CODE">REJECT-MISSING-CODE</option>
            </select>
            <span className="text-xs text-muted-foreground">{filtered.length} rows</span>
          </div>

          {filtered.length === 0 ? (
            <Empty>No rows match your filters.</Empty>
          ) : (
            <TableWrap>
              <THead cols={["PO", "Line", "Item code", "Result", "Status", "Notification", "Validated"]} />
              <tbody>
                {filtered.map((r, i) => (
                  <TR key={`${r.po_number}-${r.line_num}-${i}`}>
                    <TD mono>{r.po_number}</TD>
                    <TD>{r.line_num}</TD>
                    <TD mono>{r.original_code}</TD>
                    <TD>{r.message}</TD>
                    <TD>
                      <StatusBadge status={r.status} />
                    </TD>
                    <TD>{r.notification_message ?? "-"}</TD>
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
  const [history, setHistory] = useState(loadHistory());
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
        <THead cols={["When", "Total", "Pass", "Rejected", "Duplicate/existing", "Missing code"]} />
        <tbody>
          {history.map((h) => (
            <TR key={h.id}>
              <TD>{new Date(h.ranAt).toLocaleString()}</TD>
              <TD>{h.total}</TD>
              <TD>
                <span className="text-emerald-700 dark:text-emerald-300">{h.pass}</span>
              </TD>
              <TD>
                <span className="text-rose-700 dark:text-rose-300">{h.rejected}</span>
              </TD>
              <TD>
                <span className="text-amber-700 dark:text-amber-300">{h.duplicate}</span>
              </TD>
              <TD>
                <span className="text-sky-700 dark:text-sky-300">{h.missing_code}</span>
              </TD>
            </TR>
          ))}
        </tbody>
      </TableWrap>
    </div>
  );
}

function SettingsTab() {
  const [notifyTeams, setNotifyTeams] = useState(true);
  const [notifyOutlook, setNotifyOutlook] = useState(true);
  return (
    <div className="max-w-xl space-y-4 rounded-2xl border border-border/60 bg-card/40 p-6 backdrop-blur-xl">
      <Toggle
        label="Prepare Teams notification"
        hint="Validation results include pass/reject messages ready for Teams delivery."
        value={notifyTeams}
        onChange={setNotifyTeams}
      />
      <Toggle
        label="Prepare Outlook notification"
        hint="Validation results include the same pass/reject message for mail delivery."
        value={notifyOutlook}
        onChange={setNotifyOutlook}
      />
      <p className="text-xs text-muted-foreground">
        The current build prepares notification text in validation results. Actual Teams and Outlook sending can be
        connected through Microsoft Graph or Power Automate.
      </p>
    </div>
  );
}

function Toggle({ label, hint, value, onChange }) {
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
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-background transition-transform ${
            value ? "translate-x-5" : "translate-x-0.5"
          }`}
        />
      </button>
    </label>
  );
}
