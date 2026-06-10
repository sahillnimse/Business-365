import { createFileRoute } from "@tanstack/react-router";
import { Mail, Building2, Shield, Globe, Calendar, BadgeCheck, Phone, MapPin } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { PageHeader } from "@/components/TabBar";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "My Profile — Business 365" },
      { name: "description", content: "Account details and profile information." },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { user } = useAuth();

  const name = user?.name || "Demo User";
  const email = user?.email || "demo.user@business365.com";
  const role = user?.role || "Administrator";
  const company = user?.company || "CRONUS USA, Inc.";
  const initials = name
    .split(" ")
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div>
      <PageHeader title="My Profile" subtitle="Account details and preferences." />

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="h-28 bg-gradient-to-r from-primary via-primary/80 to-primary/60" />
        <div className="-mt-12 flex flex-wrap items-end gap-5 px-6 pb-6">
          <div className="flex h-24 w-24 items-center justify-center rounded-full border-4 border-card bg-primary text-3xl font-semibold text-primary-foreground shadow-lg">
            {initials}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-semibold tracking-tight">{name}</h2>
              <BadgeCheck className="h-5 w-5 text-primary" />
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" />{email}</span>
              <span className="inline-flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5" />{company}</span>
              <span className="inline-flex items-center gap-1.5"><Shield className="h-3.5 w-3.5" />{role}</span>
            </div>
          </div>
          <div className="flex gap-2">
            <button className="rounded-md border border-border bg-background px-3 py-1.5 text-sm hover:bg-accent">Edit profile</button>
            <button className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90">Manage account</button>
          </div>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Card title="Account">
          <Row icon={<Mail className="h-4 w-4" />} label="Email" value={email} />
          <Row icon={<Phone className="h-4 w-4" />} label="Phone" value="+1 (555) 010-2024" />
          <Row icon={<Shield className="h-4 w-4" />} label="Role" value={role} />
          <Row icon={<BadgeCheck className="h-4 w-4" />} label="Status" value={<span className="inline-flex rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">Active</span>} />
        </Card>

        <Card title="Organization">
          <Row icon={<Building2 className="h-4 w-4" />} label="Company" value={company} />
          <Row icon={<Globe className="h-4 w-4" />} label="Environment" value="Production" />
          <Row icon={<MapPin className="h-4 w-4" />} label="Region" value="United States (US)" />
          <Row icon={<Calendar className="h-4 w-4" />} label="Member since" value="Jan 14, 2024" />
        </Card>

        <Card title="Preferences">
          <Row label="Language" value="English (United States)" />
          <Row label="Time zone" value="(UTC-05:00) Eastern Time" />
          <Row label="Date format" value="MM/DD/YYYY" />
          <Row label="Currency" value="USD ($)" />
        </Card>
      </div>

      <div className="mt-6 rounded-2xl border border-border bg-card p-5 shadow-sm">
        <h3 className="mb-4 text-sm font-semibold">Recent activity</h3>
        <ul className="divide-y divide-border text-sm">
          {[
            { t: "Signed in from Chrome on Windows", w: "2 hours ago" },
            { t: "Ran PO validation batch (124 lines)", w: "Yesterday" },
            { t: "Updated connection settings", w: "3 days ago" },
            { t: "Granted access to Inventory module", w: "Last week" },
          ].map((a) => (
            <li key={a.t} className="flex items-center justify-between py-2.5">
              <span>{a.t}</span>
              <span className="text-xs text-muted-foreground">{a.w}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <h3 className="mb-4 text-sm font-semibold">{title}</h3>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Row({ icon, label, value }: { icon?: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 text-sm">
      <span className="inline-flex items-center gap-2 text-muted-foreground">
        {icon}
        {label}
      </span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}
