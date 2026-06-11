import { ShieldCheck, BarChart3, Lock, Cloud } from "lucide-react";
import { MicrosoftSignInButton } from "./MicrosoftSignInButton";

export function SignInPage({
  onLogin,
  error,
  loading,
}: {
  onLogin: () => void;
  error?: string | null;
  loading?: boolean;
}) {
  return (
    <div className="flex min-h-screen bg-background">
      {/* Brand panel */}
      <div className="login-brand-panel relative hidden w-[44%] flex-col justify-between overflow-hidden p-10 lg:flex xl:p-14">
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm ring-1 ring-white/20">
              <ShieldCheck className="h-6 w-6 text-white" />
            </div>
            <div>
              <div className="text-lg font-bold tracking-tight text-white">Business 365</div>
              <div className="text-[11px] font-medium uppercase tracking-[0.2em] text-white/60">
                Dynamics Suite
              </div>
            </div>
          </div>
        </div>

        <div className="relative z-10 max-w-md space-y-8">
          <div>
            <h1 className="text-3xl font-bold leading-tight tracking-tight text-white xl:text-4xl">
              PO Validator workspace
            </h1>
            <p className="mt-4 text-base leading-relaxed text-white/75">
              Validate purchase orders against your item master, code mappings, and Business Central data — securely
              with your Microsoft work account.
            </p>
          </div>
          <ul className="space-y-4">
            {[
              { icon: Lock, text: "Enterprise SSO via Microsoft Entra ID" },
              { icon: BarChart3, text: "Real-time validation dashboards" },
              { icon: Cloud, text: "Connect to SharePoint & Business Central" },
            ].map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-sm text-white/80">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10 ring-1 ring-white/15">
                  <Icon className="h-4 w-4 text-white" />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative z-10 text-xs text-white/40">© Business 365 · Secured by Microsoft</p>
      </div>

      {/* Sign-in panel */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12">
        <div className="mb-8 flex items-center gap-3 lg:hidden">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <div className="text-base font-bold">Business 365</div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Dynamics Suite</div>
          </div>
        </div>

        <div className="w-full max-w-[420px]">
          <div className="rounded-2xl border border-border/80 bg-card p-8 shadow-xl shadow-black/5 dark:shadow-black/20">
            <div className="mb-6 text-center lg:text-left">
              <h2 className="text-2xl font-bold tracking-tight text-foreground">Sign in</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Use your <span className="font-medium text-foreground">Microsoft work or school account</span> to
                continue to the PO Validator.
              </p>
            </div>

            {typeof window !== "undefined" && !window.isSecureContext && (
              <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-700 dark:text-amber-300">
                Open at{" "}
                <a href="http://localhost:8080" className="font-medium underline">
                  localhost:8080
                </a>{" "}
                for Microsoft sign-in.
              </div>
            )}

            {error && (
              <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
                {error}
              </div>
            )}

            <MicrosoftSignInButton onClick={onLogin} disabled={loading} />

            <p className="mt-6 text-center text-xs leading-relaxed text-muted-foreground">
              By continuing, you agree to your organisation&apos;s access policies. Authentication is handled by
              Microsoft — we never see your password.
            </p>
          </div>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            Need help? Contact your IT administrator for Business 365 access.
          </p>
        </div>
      </div>
    </div>
  );
}
