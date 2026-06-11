import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  LayoutDashboard,
  ShieldCheck,
  ShoppingCart,
  Package,
  Wallet,
  Settings,
  Activity,
  Sun,
  Moon,
  Search,
  Bell,
  HelpCircle,
  Grid3x3,
  PanelLeftClose,
  PanelLeftOpen,
  FileSpreadsheet,
} from "lucide-react";
import { useEffect, useState } from "react";
import { MODULES } from "@/lib/modules";
import { apiGet } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/lib/theme";
import { SignInPage } from "@/components/SignInPage";
import { UserAvatar } from "@/components/UserAvatar";
import { userDisplayName } from "@/lib/user";

const ICONS = {
  LayoutDashboard,
  ShieldCheck,
  ShoppingCart,
  Package,
  Wallet,
  Settings,
  FileSpreadsheet,
} as const;

const SIDEBAR_KEY = "b365_sidebar_collapsed";

function getSidebarCollapsed(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(SIDEBAR_KEY) === "true";
}

export function AppLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { theme, toggle } = useTheme();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const { user, isAuthenticated, isLoading, login } = useAuth();
  const [loginError, setLoginError] = useState<string | null>(null);

  useEffect(() => {
    setSidebarCollapsed(getSidebarCollapsed());
  }, []);

  const toggleSidebar = () => {
    setSidebarCollapsed((v) => {
      const next = !v;
      localStorage.setItem(SIDEBAR_KEY, String(next));
      return next;
    });
  };

  const handleLogin = async () => {
    setLoginError(null);
    setLoginLoading(true);
    try {
      await login();
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : "Sign-in failed. Please try again.");
    } finally {
      setLoginLoading(false);
    }
  };

  const health = useQuery({
    queryKey: ["health"],
    queryFn: () => apiGet<{ status?: string }>("/health"),
    refetchInterval: 30_000,
    retry: false,
  });

  const isActive = (p: string) => (p === "/" ? pathname === "/" : pathname.startsWith(p));
  const userName = userDisplayName(user);
  const currentLabel =
    MODULES.find((m) => isActive(m.path))?.label ?? (pathname === "/profile" ? "My Profile" : "Dashboard");

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-9 w-9 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading workspace…</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <SignInPage onLogin={handleLogin} error={loginError} loading={loginLoading} />;
  }

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* Sidebar */}
      <aside
        className={`sidebar-surface sticky top-0 flex h-screen shrink-0 flex-col border-r border-sidebar-border text-sidebar-foreground shadow-xl shadow-black/10 transition-[width] duration-300 ease-in-out ${
          sidebarCollapsed ? "w-[4.5rem]" : "w-64"
        }`}
      >
        {/* Brand */}
        <div className={`flex items-center border-b border-sidebar-border/60 py-4 ${sidebarCollapsed ? "justify-center px-2" : "gap-3 px-4"}`}>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sidebar-primary to-primary shadow-lg shadow-sidebar-primary/30">
            <Grid3x3 className="h-5 w-5 text-sidebar-primary-foreground" />
          </div>
          {!sidebarCollapsed && (
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold tracking-tight text-white">Business 365</div>
              <div className="text-[10px] font-medium uppercase tracking-[0.15em] text-sidebar-foreground/60">
                Dynamics Suite
              </div>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-1 overflow-y-auto overflow-x-hidden px-2 py-3">
          {!sidebarCollapsed && (
            <div className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-sidebar-foreground/45">
              Modules
            </div>
          )}
          {MODULES.map((m) => {
            const Icon = ICONS[m.icon as keyof typeof ICONS] ?? LayoutDashboard;
            const active = isActive(m.path);
            return (
              <Link
                key={m.id}
                to={m.path}
                title={sidebarCollapsed ? m.label : undefined}
                className={`group flex items-center rounded-lg text-sm font-medium transition-all duration-200 ${
                  sidebarCollapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2.5"
                } ${
                  active
                    ? "nav-active-indicator bg-sidebar-accent text-white shadow-sm"
                    : "text-sidebar-foreground/75 hover:bg-sidebar-accent/70 hover:text-white"
                }`}
              >
                <Icon
                  className={`h-4 w-4 shrink-0 ${active ? "text-sidebar-primary" : "opacity-70 group-hover:opacity-100"}`}
                />
                {!sidebarCollapsed && <span className="truncate">{m.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Footer controls */}
        <div className="space-y-1 border-t border-sidebar-border p-2">
          {!sidebarCollapsed && (
            <div className="mb-1 flex items-center gap-2.5 rounded-lg border border-sidebar-border/60 bg-sidebar-accent/40 px-3 py-2 text-xs">
              <span
                className={`relative flex h-2 w-2 shrink-0 ${
                  health.isSuccess ? "text-emerald-400" : health.isError ? "text-rose-400" : "text-amber-400"
                }`}
              >
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-40" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-current" />
              </span>
              <span className="text-sidebar-foreground/80">
                API {health.isSuccess ? "online" : health.isError ? "offline" : "…"}
              </span>
            </div>
          )}

          <SidebarFooterBtn
            collapsed={sidebarCollapsed}
            onClick={toggle}
            title={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
            label={theme === "dark" ? "Light mode" : "Dark mode"}
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </SidebarFooterBtn>

          <SidebarFooterBtn
            collapsed={sidebarCollapsed}
            onClick={toggleSidebar}
            title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            label={sidebarCollapsed ? "Expand" : "Collapse"}
          >
            {sidebarCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </SidebarFooterBtn>
        </div>
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border/80 bg-background/90 px-4 backdrop-blur-xl sm:gap-3 sm:px-5">
          {/* Breadcrumb — fixed: no gradient clip bug */}
          <nav className="flex min-w-0 items-center gap-2 text-sm" aria-label="Breadcrumb">
            <Link to="/" className="shrink-0 font-semibold text-foreground transition-colors hover:text-primary">
              Business 365
            </Link>
            <span className="shrink-0 text-muted-foreground/50">/</span>
            <span className="truncate font-medium text-muted-foreground">{currentLabel}</span>
          </nav>

          <div className="ml-2 hidden flex-1 max-w-md md:block">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                placeholder="Search modules, items, POs…"
                className="h-9 w-full rounded-lg border border-border/80 bg-muted/50 pl-9 pr-3 text-sm transition-colors placeholder:text-muted-foreground/70 focus:border-primary/40 focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>

          <div className="ml-auto flex items-center gap-0.5">
            <IconBtn title="Notifications">
              <Bell className="h-4 w-4" />
            </IconBtn>
            <IconBtn title="Help">
              <HelpCircle className="h-4 w-4" />
            </IconBtn>
            <IconBtn title="Settings">
              <Link to="/settings">
                <Settings className="h-4 w-4" />
              </Link>
            </IconBtn>

            <Link
              to="/profile"
              title="My profile"
              className="ml-2 flex items-center gap-2 rounded-lg border border-border/60 bg-card py-1 pl-1 pr-3 shadow-sm transition-colors hover:bg-accent"
            >
              <UserAvatar user={user} name={userName} size="sm" />
              <span className="hidden max-w-[160px] truncate text-xs font-semibold sm:block">{userName}</span>
            </Link>
          </div>
        </header>

        <main className="page-mesh flex-1 overflow-x-hidden p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function SidebarFooterBtn({
  children,
  onClick,
  title,
  label,
  collapsed,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
  label: string;
  collapsed: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`flex w-full items-center rounded-lg text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-white ${
        collapsed ? "justify-center py-2.5" : "gap-3 px-3 py-2.5 text-sm"
      }`}
    >
      {children}
      {!collapsed && <span>{label}</span>}
    </button>
  );
}

function IconBtn({
  children,
  title,
  onClick,
}: {
  children: React.ReactNode;
  title?: string;
  onClick?: () => void;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
    >
      {children}
    </button>
  );
}
