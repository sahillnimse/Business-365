import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { PageHeader, TabBar } from "@/components/TabBar";
import { Empty } from "@/components/ui-bits";

const tabSchema = z.object({ tab: z.enum(["ledger", "payables", "receivables", "bank"]).optional() });

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
  const titles: Record<string, string> = {
    ledger: "General Ledger",
    payables: "Accounts Payable",
    receivables: "Accounts Receivable",
    bank: "Bank Accounts",
  };
  return (
    <div>
      <PageHeader title="Finance" subtitle="Placeholder views — wire up to back‑end endpoints as they ship." />
      <TabBar moduleId="finance" activeTab={tab} />
      <Empty>
        <div className="space-y-1">
          <div className="font-medium text-foreground">{titles[tab]}</div>
          <div>No API endpoint is currently exposed for this view. Add one to the FastAPI service and this page will populate.</div>
        </div>
      </Empty>
    </div>
  );
}
