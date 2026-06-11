import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { z } from "zod";
import { apiGet } from "@/lib/api";
import { Spinner, ErrBox, Empty, KpiCard, TableWrap, THead, TR, TD } from "@/components/ui-bits";
import { PageHeader, TabBar } from "@/components/TabBar";
import { Search, Link2, AlertCircle } from "lucide-react";

const tabSchema = z.object({ tab: z.enum(["ledger", "payables", "receivables", "bank"]).optional() });

interface FinanceSummary {
  data_source?: string;
  live_bc_data?: boolean;
  bc_auth_mode?: string;
  microsoft_login?: boolean;
  azure_app_configured?: boolean;
  local_files_ready?: boolean;
  note?: string;
  currency?: string;
  ledger?: Array<{
    date?: string;
    po_number?: string;
    line_num?: string;
    account?: string;
    description?: string;
    debit?: number;
    credit?: number;
    vendor?: string;
  }>;
  payables?: Array<{ vendor: string; lines: number; total_amount: number }>;
  receivables?: unknown[];
  bank?: {
    total_payable?: number;
    vendor_count?: number;
    open_po_count?: number;
    open_po_lines?: number;
  };
}

export const Route = createFileRoute("/finance")({
  validateSearch: tabSchema,
  head: () => ({
    meta: [
      { title: "Finance — PO‑Validator" },
      { name: "description", content: "Ledger, payables, receivables and bank views." },
    ],
  }),
  component: FinancePage,
});

function FinancePage() {
  const { tab = "ledger" } = Route.useSearch();
  const q = useQuery({
    queryKey: ["finance-summary"],
    queryFn: () => apiGet<FinanceSummary>("/finance/summary"),
  });

  return (
    <div>
      <PageHeader
        title="Finance"
        subtitle="Purchasing-derived finance views from your configured data source."
      />
      <TabBar moduleId="finance" activeTab={tab} />
      {q.isLoading && <Spinner label="Loading finance data…" />}
      {q.error && <ErrBox error={q.error} />}
      {q.data && (
        <>
          <ConnectionBanner data={q.data} />
          {tab === "ledger" && <LedgerTab data={q.data} />}
          {tab === "payables" && <PayablesTab data={q.data} />}
          {tab === "receivables" && <ReceivablesTab data={q.data} />}
          {tab === "bank" && <BankTab data={q.data} />}
        </>
      )}
    </div>
  );
}

function ConnectionBanner({ data }: { data: FinanceSummary }) {
  const source = data.data_source ?? "unknown";
  const liveBc = data.live_bc_data;
  return (
    <div className="mb-6 flex gap-3 rounded-xl border border-border/60 bg-muted/30 px-4 py-3 text-sm">
      <Link2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
      <div className="space-y-1">
        <div className="font-medium text-foreground">
          Data source: <span className="capitalize text-primary">{source}</span>
          {liveBc ? " — live Business Central" : " — local / purchasing files"}
        </div>
        <p className="text-muted-foreground">
          {data.note ??
            "Microsoft sign-in verifies your identity. Finance figures below come from PO purchasing data until Business Central finance APIs are connected."}
        </p>
        {source === "local" && !data.azure_app_configured && (
          <p className="flex items-start gap-1.5 text-amber-700 dark:text-amber-300">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Set <code className="text-xs">DATA_SOURCE=bc</code> in backend <code className="text-xs">.env</code> and
            sign in with Microsoft (user_impersonation) for live Business Central data.
          </p>
        )}
        {source === "bc" && data.bc_auth_mode === "delegated" && (
          <p className="text-muted-foreground">
            Using your Microsoft sign-in token to call Business Central APIs.
          </p>
        )}
      </div>
    </div>
  );
}

function LedgerTab({ data }: { data: FinanceSummary }) {
  const [q, setQ] = useState("");
  const rows = useMemo(() => {
    const ledger = data.ledger ?? [];
    const term = q.toLowerCase();
    if (!term) return ledger;
    return ledger.filter((r) =>
      [r.po_number, r.description, r.vendor, r.account].some((v) =>
        String(v ?? "").toLowerCase().includes(term),
      ),
    );
  }, [q, data.ledger]);

  if (!data.ledger?.length) return <Empty>No ledger entries — PO data may be missing.</Empty>;

  return (
    <div className="space-y-4">
      <div className="relative w-80">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Filter ledger…"
          className="w-full rounded-lg border border-border bg-card/40 py-2 pl-9 pr-3 text-sm focus:border-primary focus:outline-none"
        />
      </div>
      <TableWrap>
        <THead cols={["Date", "PO", "Line", "Account", "Description", "Debit", "Credit"]} />
        <tbody>
          {rows.map((r, i) => (
            <TR key={i}>
              <TD>{r.date}</TD>
              <TD mono>{r.po_number}</TD>
              <TD>{r.line_num}</TD>
              <TD>{r.account}</TD>
              <TD>{r.description}</TD>
              <TD mono>{fmt(r.debit)}</TD>
              <TD mono>{fmt(r.credit)}</TD>
            </TR>
          ))}
        </tbody>
      </TableWrap>
    </div>
  );
}

function PayablesTab({ data }: { data: FinanceSummary }) {
  const payables = data.payables ?? [];
  if (!payables.length) return <Empty>No payables — no vendor PO lines found.</Empty>;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard label="Total payable" value={fmt(data.bank?.total_payable, data.currency)} tone="warn" />
        <KpiCard label="Vendors" value={payables.length} />
        <KpiCard label="PO lines" value={data.bank?.open_po_lines ?? 0} tone="info" />
      </div>
      <TableWrap>
        <THead cols={["Vendor", "Lines", `Amount (${data.currency ?? "USD"})`]} />
        <tbody>
          {payables.map((p) => (
            <TR key={p.vendor}>
              <TD>{p.vendor}</TD>
              <TD>{p.lines}</TD>
              <TD mono>{fmt(p.total_amount)}</TD>
            </TR>
          ))}
        </tbody>
      </TableWrap>
    </div>
  );
}

function ReceivablesTab({ data }: { data: FinanceSummary }) {
  const hasReceivables = (data.receivables?.length ?? 0) > 0;
  if (hasReceivables) {
    return <Empty>Receivables API not yet rendered — data present on server.</Empty>;
  }
  return (
    <Empty>
      <div className="mx-auto max-w-md space-y-2">
        <div className="font-medium text-foreground">Accounts receivable not connected</div>
        <p>
          Receivables require Business Central sales / customer ledger APIs. Current data source is{" "}
          <strong>{data.data_source}</strong> (purchasing PO files only).
        </p>
        <p className="text-xs">
          Configure <code>DATA_SOURCE=bc</code>, <code>BC_COMPANY_NAME</code>, and Azure app permissions for{" "}
          <code>Financials.ReadWrite.All</code> to load live AR data.
        </p>
      </div>
    </Empty>
  );
}

function BankTab({ data }: { data: FinanceSummary }) {
  const bank = data.bank;
  if (!bank) return <Empty>No bank summary available.</Empty>;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <KpiCard label="Total payables" value={fmt(bank.total_payable, data.currency)} tone="warn" />
      <KpiCard label="Active vendors" value={bank.vendor_count ?? 0} />
      <KpiCard label="Open POs" value={bank.open_po_count ?? 0} tone="info" />
      <KpiCard label="PO lines" value={bank.open_po_lines ?? 0} />
    </div>
  );
}

function fmt(n?: number, currency = "USD") {
  if (n == null) return "—";
  return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(n);
}
