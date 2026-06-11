import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { z } from "zod";
import {
  AlertCircle,
  CheckCircle2,
  Database,
  FileSpreadsheet,
  Link2,
  UploadCloud,
} from "lucide-react";
import {
  apiGet,
  apiPostForm,
  type UploadedSheet,
  type UploadStatusResponse,
  type UploadWorkbookResponse,
} from "@/lib/api";
import { Empty, ErrBox, KpiCard, Spinner, TableWrap, TD, THead, TR } from "@/components/ui-bits";
import { PageHeader, TabBar } from "@/components/TabBar";

const tabSchema = z.object({ tab: z.enum(["upload", "sheets", "mapping"]).optional() });

export const Route = createFileRoute("/upload")({
  validateSearch: tabSchema,
  head: () => ({
    meta: [
      { title: "CSV Upload - PO-Validator" },
      { name: "description", content: "Upload Excel or CSV sheets for item code validation." },
    ],
  }),
  component: UploadPage,
});

const DATASET_LABELS: Record<string, string> = {
  item_master: "Item master",
  code_mapping: "Code mapping",
  po_file: "Document lines",
};

function UploadPage() {
  const { tab = "upload" } = Route.useSearch();
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<UploadWorkbookResponse | null>(null);

  const status = useQuery({
    queryKey: ["upload-status"],
    queryFn: () => apiGet<UploadStatusResponse>("/uploads/status"),
    refetchInterval: 10_000,
  });

  const latest = useQuery({
    queryKey: ["upload-latest"],
    queryFn: () => apiGet<UploadWorkbookResponse>("/uploads/latest"),
  });

  const upload = useMutation({
    mutationFn: async (selected: File) => {
      const form = new FormData();
      form.append("file", selected);
      return apiPostForm<UploadWorkbookResponse>("/uploads/workbook", form);
    },
    onSuccess: async (data) => {
      setResult(data);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["upload-status"] }),
        queryClient.invalidateQueries({ queryKey: ["upload-latest"] }),
        queryClient.invalidateQueries({ queryKey: ["items"] }),
        queryClient.invalidateQueries({ queryKey: ["po-lines"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
        queryClient.invalidateQueries({ queryKey: ["validation"] }),
      ]);
    },
  });

  const currentResult = result ?? (latest.data?.sheet_count ? latest.data : null);
  const sheets = currentResult?.sheets ?? [];
  const mapped = currentResult?.mapped ?? [];

  return (
    <div>
      <PageHeader
        title="CSV Upload"
        subtitle="Upload Excel or CSV files, map sheets into validation data, and preview the imported tables."
      />
      <TabBar moduleId="upload" activeTab={tab} />

      {tab === "upload" && (
        <div className="space-y-5">
          <div className="theme-surface-raised rounded-2xl border border-border/80 p-5 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <UploadCloud className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-semibold">Upload workbook</h3>
                  <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                    Excel workbooks can contain more than three sheets. Recognized sheets update the data used by
                    Inventory, Purchasing, Finance, and Validation.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                  className="max-w-sm rounded-lg border border-border bg-card px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-primary-foreground"
                />
                <button
                  type="button"
                  disabled={!file || upload.isPending}
                  onClick={() => file && upload.mutate(file)}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-all hover:opacity-90 disabled:opacity-50"
                >
                  <UploadCloud className="h-4 w-4" />
                  {upload.isPending ? "Uploading..." : "Upload"}
                </button>
              </div>
            </div>
            {upload.error && <div className="mt-4"><ErrBox error={upload.error} /></div>}
          </div>

          {currentResult && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <KpiCard label="File" value={currentResult.filename} hint="last uploaded" />
              <KpiCard label="Sheets found" value={currentResult.sheet_count.toLocaleString()} tone="info" />
              <KpiCard label="Mapped tables" value={currentResult.mapped_count.toLocaleString()} tone="pass" />
            </div>
          )}

          <MappingStatus status={status.data} loading={status.isLoading} error={status.error} />
        </div>
      )}

      {tab === "sheets" && <SheetsTab sheets={sheets} />}
      {tab === "mapping" && <MappingTab mapped={mapped} status={status.data} />}
    </div>
  );
}

function MappingStatus({
  status,
  loading,
  error,
}: {
  status?: UploadStatusResponse;
  loading: boolean;
  error: unknown;
}) {
  if (loading) return <Spinner label="Checking current uploaded data..." />;
  if (error) return <ErrBox error={error} />;
  if (!status) return null;

  return (
    <div className="space-y-4">
      {status.last_trigger && (
        <div className="theme-surface-raised rounded-2xl border border-border/80 p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold">Latest Teams trigger</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                PO {status.last_trigger.po_number || "-"} received from {status.last_trigger.source || "teams"}
              </p>
            </div>
            <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              {status.last_trigger.lines ?? 0} lines
            </span>
          </div>
        </div>
      )}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {status.datasets.map((dataset) => (
          <div key={dataset.dataset} className="theme-surface-raised rounded-2xl border border-border/80 p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold">{dataset.label}</h3>
                <p className="mt-1 text-xs text-muted-foreground">{dataset.filename}</p>
              </div>
              {dataset.exists ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              ) : (
                <AlertCircle className="h-5 w-5 text-amber-600" />
              )}
            </div>
            <div className="mt-4 text-2xl font-semibold">{dataset.rows.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">rows available for modules</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function SheetsTab({ sheets }: { sheets: UploadedSheet[] }) {
  const [active, setActive] = useState(0);
  const sheet = sheets[active];
  const columns = useMemo(() => sheet?.columns.slice(0, 8) ?? [], [sheet]);

  if (sheets.length === 0) {
    return <Empty>Upload an Excel or CSV file first to preview workbook sheets.</Empty>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {sheets.map((s, index) => (
          <button
            key={`${s.name}-${index}`}
            type="button"
            onClick={() => setActive(index)}
            className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
              active === index ? "border-primary bg-primary/10 text-primary" : "border-border bg-card hover:bg-accent"
            }`}
          >
            <FileSpreadsheet className="h-4 w-4" />
            {s.name}
            {s.mapped_to && (
              <span className="rounded-md bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-300">
                {DATASET_LABELS[s.mapped_to] ?? s.mapped_to}
              </span>
            )}
          </button>
        ))}
      </div>

      {sheet && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Database className="h-4 w-4" />
              {sheet.row_count.toLocaleString()} rows
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Link2 className="h-4 w-4" />
              {sheet.mapped_to ? DATASET_LABELS[sheet.mapped_to] ?? sheet.mapped_to : "Not mapped"}
            </span>
          </div>
          <TableWrap>
            <THead cols={columns.length ? columns : ["No columns"]} />
            <tbody>
              {sheet.rows.map((row, index) => (
                <TR key={index}>
                  {columns.map((column) => (
                    <TD key={column}>{String(row[column] ?? "")}</TD>
                  ))}
                </TR>
              ))}
            </tbody>
          </TableWrap>
        </div>
      )}
    </div>
  );
}

function MappingTab({
  mapped,
  status,
}: {
  mapped: UploadWorkbookResponse["mapped"];
  status?: UploadStatusResponse;
}) {
  const rows = mapped.length
    ? mapped
    : status?.datasets.map((dataset) => ({
        dataset: dataset.dataset,
        label: dataset.label,
        filename: dataset.filename,
        rows: dataset.rows,
        columns: dataset.columns,
      })) ?? [];

  if (rows.length === 0) {
    return <Empty>No upload mappings available yet.</Empty>;
  }

  return (
    <TableWrap>
      <THead cols={["Module data", "File", "Rows", "Columns"]} />
      <tbody>
        {rows.map((row) => (
          <TR key={row.dataset}>
            <TD>{row.label}</TD>
            <TD mono>{row.filename}</TD>
            <TD>{row.rows.toLocaleString()}</TD>
            <TD>{row.columns.join(", ") || "-"}</TD>
          </TR>
        ))}
      </tbody>
    </TableWrap>
  );
}
