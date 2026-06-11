import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import {
  Mail,
  Building2,
  Shield,
  Globe,
  Calendar,
  BadgeCheck,
  User,
  KeyRound,
  Fingerprint,
  BriefcaseBusiness,
  MapPin,
  Phone,
  LogOut,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { PageHeader } from "@/components/TabBar";
import { formatTokenTime, userDisplayName } from "@/lib/user";
import { MicrosoftLogo } from "@/components/MicrosoftSignInButton";
import { UserAvatar } from "@/components/UserAvatar";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "My Profile - Business 365" },
      { name: "description", content: "Account details from your Microsoft sign-in." },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { user, refreshProfile, logout } = useAuth();

  useEffect(() => {
    refreshProfile?.();
  }, [refreshProfile]);

  const name = userDisplayName(user);
  const primaryRole = user?.roles?.[0];
  const roleLabel = primaryRole || user?.job_title || "Microsoft user";

  return (
    <div>
      <PageHeader
        title="My Profile"
        subtitle="Details from your Microsoft Entra ID sign-in and Microsoft Graph profile."
        actions={
          <button
            type="button"
            onClick={() => logout()}
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-border/80 px-3 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        }
      />

      <div className="profile-hero overflow-hidden rounded-2xl border border-border/80 bg-card shadow-md">
        <div className="profile-hero-banner h-32" />
        <div className="-mt-14 flex flex-wrap items-end gap-5 px-6 pb-6">
          <UserAvatar user={user} name={name} size="xl" className="border-4 border-card shadow-lg" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-2xl font-bold tracking-tight">{name}</h2>
              <BadgeCheck className="h-5 w-5 text-primary" />
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-muted/50 px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                <MicrosoftLogo className="h-3.5 w-3.5" />
                Microsoft account
              </span>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
              {user?.email && (
                <span className="inline-flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5 shrink-0" />
                  {user.email}
                </span>
              )}
              {user?.tenant_id && (
                <span className="inline-flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5 shrink-0" />
                  Tenant {shortId(user.tenant_id)}
                </span>
              )}
              <span className="inline-flex items-center gap-1.5">
                <BriefcaseBusiness className="h-3.5 w-3.5 shrink-0" />
                {roleLabel}
              </span>
              {user?.department && (
                <span className="inline-flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5 shrink-0" />
                  {user.department}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Card title="Microsoft account">
          <Row icon={<User className="h-4 w-4" />} label="Display name" value={user?.name ?? "-"} />
          <Row icon={<Mail className="h-4 w-4" />} label="Email / UPN" value={user?.email ?? user?.username ?? "-"} />
          <Row icon={<User className="h-4 w-4" />} label="Given name" value={user?.given_name ?? "-"} />
          <Row icon={<User className="h-4 w-4" />} label="Family name" value={user?.family_name ?? "-"} />
          <Row icon={<BriefcaseBusiness className="h-4 w-4" />} label="Job title" value={user?.job_title ?? "-"} />
          <Row
            icon={<BadgeCheck className="h-4 w-4" />}
            label="Status"
            value={
              <span className="inline-flex rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                Authenticated
              </span>
            }
          />
        </Card>

        <Card title="Directory & identity">
          <Row icon={<Fingerprint className="h-4 w-4" />} label="Object ID" value={mono(user?.object_id)} />
          <Row icon={<KeyRound className="h-4 w-4" />} label="Subject" value={mono(user?.subject)} />
          <Row icon={<Building2 className="h-4 w-4" />} label="Tenant ID" value={mono(user?.tenant_id)} />
          <Row icon={<Globe className="h-4 w-4" />} label="Identity provider" value={user?.identity_provider ?? "Microsoft Entra ID"} />
          <Row icon={<Building2 className="h-4 w-4" />} label="Department" value={user?.department ?? "-"} />
          <Row icon={<MapPin className="h-4 w-4" />} label="Office" value={user?.office_location ?? "-"} />
          <Row
            icon={<Shield className="h-4 w-4" />}
            label="App roles"
            value={user?.roles?.length ? user.roles.join(", ") : "-"}
          />
        </Card>

        <Card title="Session">
          <Row icon={<Calendar className="h-4 w-4" />} label="Signed in at" value={formatTokenTime(user?.issued_at)} />
          <Row icon={<Calendar className="h-4 w-4" />} label="Token expires" value={formatTokenTime(user?.expires_at)} />
          <Row icon={<KeyRound className="h-4 w-4" />} label="Token version" value={user?.token_version ?? "-"} />
          <Row icon={<Shield className="h-4 w-4" />} label="Auth provider" value={user?.auth_provider ?? "microsoft"} />
          <Row icon={<Phone className="h-4 w-4" />} label="Mobile phone" value={user?.mobile_phone ?? "-"} />
          <Row icon={<Phone className="h-4 w-4" />} label="Business phone" value={user?.business_phones?.length ? user.business_phones.join(", ") : "-"} />
        </Card>
      </div>

      <div className="theme-surface-raised mt-6 rounded-2xl border border-border/80 p-5">
        <h3 className="mb-2 text-sm font-semibold">About this profile</h3>
        <p className="text-sm leading-relaxed text-muted-foreground">
          This information starts with your verified Microsoft ID token, then is enriched from Microsoft Graph
          using <code className="text-xs">User.Read</code> when your tenant grants that permission.
        </p>
      </div>
    </div>
  );
}

function shortId(id?: string) {
  if (!id) return "-";
  if (id.length <= 12) return id;
  return `${id.slice(0, 8)}...`;
}

function mono(v?: string) {
  if (!v) return "-";
  return <span className="font-mono text-xs break-all">{v}</span>;
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="theme-surface-raised rounded-2xl border border-border/80 p-5 shadow-sm">
      <h3 className="mb-4 text-sm font-semibold text-foreground">{title}</h3>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Row({ icon, label, value }: { icon?: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border/40 pb-3 text-sm last:border-0 last:pb-0">
      <span className="inline-flex shrink-0 items-center gap-2 text-muted-foreground">
        {icon}
        {label}
      </span>
      <span className="min-w-0 text-right font-medium text-foreground">{value}</span>
    </div>
  );
}
