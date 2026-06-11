import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { z } from "zod";
import { apiGet, type PoLine } from "@/lib/api";
import { Spinner, ErrBox, Empty, KpiCard, TableWrap, THead, TR, TD } from "@/components/ui-bits";
import { PageHeader, TabBar } from "@/components/TabBar";
import { Search } from "lucide-react";

const tabSchema = z.object({ tab: z.enum(["po-lines", "vendors", "approvals", "reports"]).optional() });

export const Route = createFileRoute("/purchasing")({
  validateSearch: tabSchema,
  head: () => ({
    meta: [
      { title: "Purchasing — PO‑Validator" },
      { name: "description", content: "Browse PO lines, vendors, approvals and purchasing reports." },
    ],
  }),
  component: PurchasingPage,
});

interface PoResponse {
  total: number;
  po_numbers: string[];
  lines: PoLine[];
}

function PurchasingPage() {
  const { tab = "po-lines" } = Route.useSearch();
  const q = useQuery({
    queryKey: ["po-lines"],
    queryFn: () => apiGet<PoResponse>("/po-lines"),
    refetchInterval: 10_000,
  });

  return (
    <div>
      <PageHeader title="Purchasing" subtitle="Raw purchase orders and aggregated vendor views." />
      <TabBar moduleId="purchasing" activeTab={tab} />
      {q.isLoading && <Spinner label="Loading PO lines…" />}
      {q.error && <ErrBox error={q.error} />}
      {q.data && (
        <>
          {tab === "po-lines" && <PoLinesTab data={q.data} />}
          {tab === "vendors" && <VendorsTab data={q.data} />}
          {tab === "approvals" && <ApprovalsTab data={q.data} />}
          {tab === "reports" && <ReportsTab data={q.data} />}
        </>
      )}
    </div>
  );
}

function PoLinesTab({ data }: { data: PoResponse }) {
  const [q, setQ] = useState("");
  const rows = useMemo(() => {
    const term = q.toLowerCase();
    if (!term) return data.lines;
    return data.lines.filter((l) =>
      Object.values(l).some((v) => String(v ?? "").toLowerCase().includes(term)),
    );
  }, [q, data.lines]);

  if (data.lines.length === 0) return <Empty>No PO lines available.</Empty>;
  return (
    <div className="space-y-3">
      <div className="relative w-80">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Filter lines…"
          className="w-full rounded-lg border border-border bg-card/40 py-2 pl-9 pr-3 text-sm focus:border-primary focus:outline-none"
        />
      </div>
      <TableWrap>
        <THead cols={["PO", "Line", "Item", "Vendor", "Qty", "Unit Price"]} />
        <tbody>
          {rows.map((l, i) => (
            <TR key={i}>
              <TD mono>{String(l["PO Number"] ?? "")}</TD>
              <TD>{String(l["Line #"] ?? "")}</TD>
              <TD mono>{String(l["Item Code"] ?? "")}</TD>
              <TD>{String(l.Vendor ?? "")}</TD>
              <TD>{String(l.Qty ?? "")}</TD>
              <TD>
                {typeof l["Unit Price (USD)"] === "number"
                  ? `$${(l["Unit Price (USD)"] as number).toFixed(2)}`
                  : String(l["Unit Price (USD)"] ?? "")}
              </TD>
            </TR>
          ))}
        </tbody>
      </TableWrap>
      <div className="text-xs text-muted-foreground">{rows.length} of {data.lines.length} lines</div>
    </div>
  );
}

function VendorsTab({ data }: { data: PoResponse }) {
  const vendors = useMemo(() => {
    const map = new Map<string, { lines: number; pos: Set<string>; value: number }>();
    for (const l of data.lines) {
      const v = String(l.Vendor ?? "Unknown");
      const entry = map.get(v) ?? { lines: 0, pos: new Set(), value: 0 };
      entry.lines += 1;
      if (l["PO Number"]) entry.pos.add(String(l["PO Number"]));
      const qty = Number(l.Qty ?? 0);
      const price = Number(l["Unit Price (USD)"] ?? 0);
      entry.value += qty * price;
      map.set(v, entry);
    }
    return Array.from(map.entries())
      .map(([name, v]) => ({ name, lines: v.lines, pos: v.pos.size, value: v.value }))
      .sort((a, b) => b.value - a.value);
  }, [data.lines]);

  if (vendors.length === 0) return <Empty>No vendors found.</Empty>;
  return (
    <TableWrap>
      <THead cols={["Vendor", "PO count", "Lines", "Est. value"]} />
      <tbody>
        {vendors.map((v) => (
          <TR key={v.name}>
            <TD>{v.name}</TD>
            <TD>{v.pos}</TD>
            <TD>{v.lines}</TD>
            <TD>${v.value.toLocaleString(undefined, { maximumFractionDigits: 2 })}</TD>
          </TR>
        ))}
      </tbody>
    </TableWrap>
  );
}

function ApprovalsTab({ data }: { data: PoResponse }) {
  const grouped = useMemo(() => {
    const map = new Map<string, { lines: number; vendor: string; value: number }>();
    for (const l of data.lines) {
      const po = String(l["PO Number"] ?? "?");
      const entry = map.get(po) ?? { lines: 0, vendor: String(l.Vendor ?? ""), value: 0 };
      entry.lines += 1;
      entry.value += Number(l.Qty ?? 0) * Number(l["Unit Price (USD)"] ?? 0);
      map.set(po, entry);
    }
    return Array.from(map.entries()).map(([po, v]) => ({ po, ...v }));
  }, [data.lines]);

  return (
    <TableWrap>
      <THead cols={["PO", "Vendor", "Lines", "Value", "Status", "Action"]} />
      <tbody>
        {grouped.map((p) => (
          <TR key={p.po}>
            <TD mono>{p.po}</TD>
            <TD>{p.vendor}</TD>
            <TD>{p.lines}</TD>
            <TD>${p.value.toLocaleString(undefined, { maximumFractionDigits: 2 })}</TD>
            <TD>
              <span className="inline-flex items-center rounded-full border border-amber-500/30 bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-300">
                Pending
              </span>
            </TD>
            <TD>
              <button className="rounded-md border border-border bg-card/60 px-2.5 py-1 text-xs hover:bg-accent">
                Review
              </button>
            </TD>
          </TR>
        ))}
      </tbody>
    </TableWrap>
  );
}

function ReportsTab({ data }: { data: PoResponse }) {
  const totalLines = data.lines.length;
  const uniquePos = new Set(data.lines.map((l) => l["PO Number"])).size;
  const uniqueVendors = new Set(data.lines.map((l) => l.Vendor)).size;
  const totalValue = data.lines.reduce(
    (sum, l) => sum + Number(l.Qty ?? 0) * Number(l["Unit Price (USD)"] ?? 0),
    0,
  );
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <KpiCard label="Total lines" value={totalLines.toLocaleString()} />
      <KpiCard label="Unique POs" value={uniquePos.toLocaleString()} tone="info" />
      <KpiCard label="Unique vendors" value={uniqueVendors.toLocaleString()} />
      <KpiCard
        label="Estimated value"
        value={`$${totalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
        tone="pass"
      />
    </div>
  );
}
