import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { apiGet } from "@/lib/api";
import { Spinner, ErrBox, Empty, KpiCard, TableWrap, THead, TR, TD } from "@/components/ui-bits";
import { PageHeader, TabBar } from "@/components/TabBar";
import { Search } from "lucide-react";

export default function InventoryPage() {
  const [searchParams] = useSearchParams();
  const tab = searchParams.get("tab") || "items";
  const q = useQuery({
    queryKey: ["items"],
    queryFn: () => apiGet("/items"),
    refetchInterval: 30_000,
  });

  return (
    <div>
      <PageHeader title="Inventory" subtitle="Catalog and stock visibility." />
      <TabBar moduleId="inventory" activeTab={tab} />
      {q.isLoading && <Spinner label="Loading items…" />}
      {q.error && <ErrBox error={q.error} />}
      {q.data && (
        <>
          {tab === "items" && <ItemsTab data={q.data} />}
          {tab === "stock" && <StockTab data={q.data} />}
          {tab === "warehouses" && <WarehousesTab data={q.data} />}
          {tab === "transfers" && <TransfersTab />}
        </>
      )}
    </div>
  );
}

function ItemsTab({ data }) {
  const [q, setQ] = useState("");
  const rows = useMemo(() => {
    const term = q.toLowerCase();
    if (!term) return data.items;
    return data.items.filter((it) =>
      Object.values(it).some((v) => String(v ?? "").toLowerCase().includes(term)),
    );
  }, [q, data.items]);
  if (data.items.length === 0) return <Empty>No items found.</Empty>;
  return (
    <div className="space-y-3">
      <div className="relative w-80">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Filter items…"
          className="w-full rounded-lg border border-border bg-card/40 py-2 pl-9 pr-3 text-sm focus:border-primary focus:outline-none"
        />
      </div>
      <TableWrap>
        <THead cols={["Code", "Description", "Category", "Status"]} />
        <tbody>
          {rows.map((it, i) => (
            <TR key={i}>
              <TD mono>{String(it["Item Code"] ?? "")}</TD>
              <TD>{String(it["Item Description"] ?? "")}</TD>
              <TD>{String(it.Category ?? "")}</TD>
              <TD>
                <StatusPill value={String(it.Status ?? "")} />
              </TD>
            </TR>
          ))}
        </tbody>
      </TableWrap>
      <div className="text-xs text-muted-foreground">{rows.length} of {data.items.length}</div>
    </div>
  );
}

function StatusPill({ value }) {
  const active = value.toLowerCase() === "active";
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${
        active
          ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
          : "border-amber-500/30 bg-amber-500/15 text-amber-700 dark:text-amber-300"
      }`}
    >
      {value || "—"}
    </span>
  );
}

function StockTab({ data }) {
  const hasStock = data.items.some((i) => "Qty On Hand" in i || "Stock" in i);
  if (!hasStock) {
    return <Empty>Stock data is not exposed by the current API. Wire a stock source to enrich this view.</Empty>;
  }
  return (
    <TableWrap>
      <THead cols={["Code", "Description", "Qty"]} />
      <tbody>
        {data.items.map((it, i) => (
          <TR key={i}>
            <TD mono>{String(it["Item Code"] ?? "")}</TD>
            <TD>{String(it["Item Description"] ?? "")}</TD>
            <TD>{String(it["Qty On Hand"] ?? it.Stock ?? "—")}</TD>
          </TR>
        ))}
      </tbody>
    </TableWrap>
  );
}

function WarehousesTab({ data }) {
  const cats = useMemo(() => {
    const map = new Map();
    for (const it of data.items) {
      const c = String(it.Category ?? "Uncategorized");
      map.set(c, (map.get(c) ?? 0) + 1);
    }
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [data.items]);
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {cats.map(([name, count]) => (
        <KpiCard key={name} label={name} value={count} hint="items in catalog" />
      ))}
    </div>
  );
}

function TransfersTab() {
  return <Empty>Transfers log will appear here once movement data is exposed by the back‑end.</Empty>;
}
