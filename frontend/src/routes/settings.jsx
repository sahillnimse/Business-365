import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { apiGet, setAuthToken, loadStoredToken } from "@/lib/api";
import { Spinner, ErrBox } from "@/components/ui-bits";
import { PageHeader, TabBar } from "@/components/TabBar";
import { Save, KeyRound, CloudLightning } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

export default function SettingsPage() {
  const [searchParams] = useSearchParams();
  const tab = searchParams.get("tab") || "connections";
  return (
    <div>
      <PageHeader title="Settings" subtitle="Configure how the validator reaches your data." />
      <TabBar moduleId="settings" activeTab={tab} />
      {tab === "connections" && <ConnectionsTab />}
      {tab === "azure" && <AzureTab />}
      {tab === "bc365" && <Bc365Tab />}
    </div>
  );
}

function ConnectionsTab() {
  const q = useQuery({ queryKey: ["health-full"], queryFn: () => apiGet("/health") });
  const [apiUrl, setApiUrl] = useState(
    import.meta.env.VITE_API_URL ?? "/api",
  );
  const [token, setToken] = useState("");
  useEffect(() => {
    setToken(loadStoredToken() ?? "");
  }, []);

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      <Card title="API base URL" subtitle="Set VITE_API_URL in your .env to override at build time.">
        <div className="space-y-3">
          <Field label="Current">
            <code className="block rounded-md bg-muted px-3 py-2 text-xs">{apiUrl}</code>
          </Field>
          <input
            value={apiUrl}
            onChange={(e) => setApiUrl(e.target.value)}
            disabled
            className="w-full rounded-lg border border-border bg-card/40 px-3 py-2 text-sm opacity-60"
          />
          <p className="text-xs text-muted-foreground">
            Read-only at runtime. Restart the dev server after editing <code>.env</code>.
          </p>
        </div>
      </Card>

      <Card title="Bearer token" subtitle="Stored in localStorage and sent on every request.">
        <div className="space-y-3">
          <div className="relative">
            <KeyRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Paste JWT (leave blank for dev stub)"
              className="w-full rounded-lg border border-border bg-card/40 py-2 pl-9 pr-3 text-sm focus:border-primary focus:outline-none"
            />
          </div>
          <button
            onClick={() => {
              setAuthToken(token || null);
              window.location.reload();
            }}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            <Save className="h-4 w-4" /> Save token
          </button>
        </div>
      </Card>

      <Card title="Service health" subtitle="Live response from /health">
        {q.isLoading && <Spinner />}
        {q.error && <ErrBox error={q.error} />}
        {q.data && (
          <pre className="overflow-auto rounded-md bg-muted p-3 text-xs">
            {JSON.stringify(q.data, null, 2)}
          </pre>
        )}
      </Card>

      <Card title="Active data source" subtitle="Reported by the back‑end config.">
        {q.data?.data_source ? (
          <div className="inline-flex items-center rounded-full border border-primary/30 bg-primary/15 px-3 py-1 text-sm font-medium text-primary">
            {String(q.data.data_source)}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Not reported by /health.</p>
        )}
      </Card>
    </div>
  );
}

function AzureTab() {
  return (
    <Card title="Azure AD" subtitle="Used for Microsoft JWT verification on the back‑end.">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Tenant ID">
          <input className="ipt" placeholder="00000000-0000-…" />
        </Field>
        <Field label="Client ID">
          <input className="ipt" placeholder="00000000-0000-…" />
        </Field>
        <Field label="Client Secret">
          <input type="password" className="ipt" placeholder="••••••••" />
        </Field>
        <Field label="Redirect URI">
          <input className="ipt" placeholder="https://…/auth/callback" />
        </Field>
      </div>
      <p className="mt-4 text-xs text-muted-foreground">
        These values must be set in the back‑end environment. This form is a placeholder for an admin workflow.
      </p>
      <style>{`.ipt{width:100%;border:1px solid var(--border);background:rgb(255 255 255 / 0.04);border-radius:0.5rem;padding:0.5rem 0.75rem;font-size:0.875rem}.ipt:focus{outline:none;border-color:var(--primary)}`}</style>
    </Card>
  );
}

function Bc365Tab() {
  const { connectBusinessCentral } = useAuth();
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState(null);

  const handleConnect = async () => {
    setConnecting(true);
    setError(null);
    try {
      await connectBusinessCentral();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connection failed");
    } finally {
      setConnecting(false);
    }
  };

  return (
    <Card title="Business Central" subtitle="Connection details for BC365 as a data source.">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Environment">
          <input className="ipt" placeholder="Production" disabled />
        </Field>
        <Field label="Company">
          <input className="ipt" placeholder="CRONUS USA, Inc." disabled />
        </Field>
        <Field label="Base URL">
          <input className="ipt" placeholder="https://api.businesscentral.dynamics.com/…" disabled />
        </Field>
        <Field label="API version">
          <input className="ipt" placeholder="v2.0" disabled />
        </Field>
      </div>

      <div className="mt-6 border-t border-border/60 pt-4">
        <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider mb-2">
          Delegated User Authentication
        </h4>
        <p className="text-xs text-muted-foreground mb-4">
          To read live data from Business Central, you must consent to the application acting on your behalf.
        </p>
        {error && (
          <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {error}
          </div>
        )}
        <button
          onClick={handleConnect}
          disabled={connecting}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          <CloudLightning className="h-4 w-4" />
          {connecting ? "Connecting..." : "Connect Business Central"}
        </button>
      </div>
      <style>{`.ipt{width:100%;border:1px solid var(--border);background:rgb(255 255 255 / 0.04);border-radius:0.5rem;padding:0.5rem 0.75rem;font-size:0.875rem}.ipt:focus{outline:none;border-color:var(--primary)}`}</style>
    </Card>
  );
}

function Card({ title, subtitle, children }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card/40 p-5 backdrop-blur-xl">
      <div className="mb-4">
        <h3 className="text-sm font-semibold">{title}</h3>
        {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
