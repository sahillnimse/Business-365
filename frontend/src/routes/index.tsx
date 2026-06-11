import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { apiGet, type DashboardResponse } from "@/lib/api";
import { Spinner, ErrBox, KpiCard, SectionCard } from "@/components/ui-bits";
import { PageHeader } from "@/components/TabBar";
import { useAuth } from "@/context/AuthContext";
import { userDisplayName } from "@/lib/user";
import { UserAvatar } from "@/components/UserAvatar";
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

const CHART_TOOLTIP = {
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: "0.5rem",
  color: "var(--foreground)",
};

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
  const { user } = useAuth();
  const { data, isLoading, error } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => apiGet<DashboardResponse>("/dashboard"),
    refetchInterval: 10_000,
  });

  const displayName = userDisplayName(user);
  const firstName = displayName.split(/\s+/)[0] ?? displayName;

  return (
    <div>
      <PageHeader title="Dashboard" subtitle="Live snapshot from the validator service." />

      {user && (
        <Link
          to="/profile"
          className="theme-surface-raised mb-8 flex items-center gap-4 rounded-2xl border border-border/80 p-5 transition-colors hover:bg-accent/30"
        >
          <UserAvatar user={user} name={displayName} size="lg" />
          <h2 className="text-lg font-semibold tracking-tight">Welcome back, {firstName}</h2>
        </Link>
      )}

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
            <SectionCard title="Validation breakdown">
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={[
                        { name: "Pass", value: data.validation.pass, fill: "var(--chart-1)" },
                        { name: "Auto‑map", value: data.validation.auto_map, fill: "var(--chart-2)" },
                        { name: "Block inactive", value: data.validation.block_inactive, fill: "var(--chart-3)" },
                        { name: "Block unknown", value: data.validation.block_unknown, fill: "var(--chart-4)" },
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
                    <Tooltip contentStyle={CHART_TOOLTIP} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </SectionCard>

            <SectionCard title="Purchase orders">
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
            </SectionCard>
          </section>

          <SectionCard title="Items by status">
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={[
                    { name: "Active", value: data.items.active },
                    { name: "Inactive", value: data.items.inactive },
                  ]}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="name" stroke="var(--muted-foreground)" />
                  <YAxis stroke="var(--muted-foreground)" />
                  <Tooltip contentStyle={CHART_TOOLTIP} />
                  <Bar dataKey="value" fill="var(--primary)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </SectionCard>
        </div>
      )}
    </div>
  );
}
