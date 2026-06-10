import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { apiGet, type DashboardResponse } from "@/lib/api";
import { Spinner, ErrBox, KpiCard } from "@/components/ui-bits";
import { PageHeader } from "@/components/TabBar";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — PO‑Validator" },
      { name: "description", content: "Aggregated view of items, validation, purchase orders and code mappings." },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => apiGet<DashboardResponse>("/dashboard"),
  });

  return (
    <div>
      <PageHeader title="Dashboard" subtitle="Live snapshot from the validator service." />
      {isLoading && <Spinner label="Loading dashboard…" />}
      {error && <ErrBox error={error} />}
      {data && (
        <div className="space-y-8">
          <section>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Item master
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <KpiCard label="Total items" value={data.items.total.toLocaleString()} tone="info" />
              <KpiCard label="Active" value={data.items.active.toLocaleString()} tone="pass" />
              <KpiCard label="Inactive" value={data.items.inactive.toLocaleString()} tone="warn" />
              <KpiCard label="Categories" value={data.items.categories.toLocaleString()} />
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Validation results
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <KpiCard label="Total" value={data.validation.total.toLocaleString()} />
              <KpiCard label="Pass" value={data.validation.pass.toLocaleString()} tone="pass" />
              <KpiCard label="Auto‑map" value={data.validation.auto_map.toLocaleString()} tone="info" />
              <KpiCard label="Block (inactive)" value={data.validation.block_inactive.toLocaleString()} tone="warn" />
              <KpiCard label="Block (unknown)" value={data.validation.block_unknown.toLocaleString()} tone="block" />
            </div>
          </section>

          <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-border/60 bg-card/40 p-5 backdrop-blur-xl">
              <h3 className="mb-4 text-sm font-semibold">Validation breakdown</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={[
                        { name: "Pass", value: data.validation.pass, fill: "oklch(0.7 0.17 162)" },
                        { name: "Auto‑map", value: data.validation.auto_map, fill: "oklch(0.72 0.16 250)" },
                        { name: "Block inactive", value: data.validation.block_inactive, fill: "oklch(0.78 0.18 70)" },
                        { name: "Block unknown", value: data.validation.block_unknown, fill: "oklch(0.66 0.22 22)" },
                      ]}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={60}
                      outerRadius={95}
                      paddingAngle={2}
                    >
                      {[0, 1, 2, 3].map((i) => (
                        <Cell key={i} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: "oklch(0.21 0.025 265)",
                        border: "1px solid oklch(1 0 0 / 0.15)",
                        borderRadius: "0.5rem",
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-2xl border border-border/60 bg-card/40 p-5 backdrop-blur-xl">
              <h3 className="mb-4 text-sm font-semibold">Purchase orders</h3>
              <div className="grid grid-cols-2 gap-4">
                <KpiCard label="Total lines" value={data.po.total_lines.toLocaleString()} />
                <KpiCard label="Total POs" value={data.po.total_pos.toLocaleString()} tone="info" />
                <KpiCard label="Code mappings" value={data.mappings.total.toLocaleString()} />
                <KpiCard
                  label="Pass rate"
                  value={
                    data.validation.total
                      ? `${Math.round((data.validation.pass / data.validation.total) * 100)}%`
                      : "—"
                  }
                  tone="pass"
                />
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-border/60 bg-card/40 p-5 backdrop-blur-xl">
            <h3 className="mb-4 text-sm font-semibold">Items by status</h3>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={[
                    { name: "Active", value: data.items.active },
                    { name: "Inactive", value: data.items.inactive },
                  ]}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 0.08)" />
                  <XAxis dataKey="name" stroke="oklch(0.7 0.02 260)" />
                  <YAxis stroke="oklch(0.7 0.02 260)" />
                  <Tooltip
                    contentStyle={{
                      background: "oklch(0.21 0.025 265)",
                      border: "1px solid oklch(1 0 0 / 0.15)",
                      borderRadius: "0.5rem",
                    }}
                  />
                  <Bar dataKey="value" fill="oklch(0.72 0.16 250)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
