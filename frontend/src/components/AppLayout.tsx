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
  ChevronDown,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { MODULES } from "@/lib/modules";
import { apiGet, loadStoredToken, type MeResponse } from "@/lib/api";
import { useTheme } from "@/lib/theme";

const ICONS = {
  LayoutDashboard,
  ShieldCheck,
  ShoppingCart,
  Package,
  Wallet,
  Settings,
} as const;

export function AppLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [tokenLoaded, setTokenLoaded] = useState(false);
  const { theme, toggle } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadStoredToken();
    setTokenLoaded(true);
  }, []);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const me = useQuery({
    queryKey: ["me"],
    queryFn: () => apiGet<MeResponse>("/auth/me"),
    enabled: tokenLoaded,
    retry: false,
  });

  const health = useQuery({
    queryKey: ["health"],
    queryFn: () => apiGet<{ status?: string }>("/health"),
    refetchInterval: 30_000,
    retry: false,
  });

  const isActive = (p: string) => (p === "/" ? pathname === "/" : pathname.startsWith(p));
  const userName = (me.data?.name as string) || "Demo User";
  const userEmail = (me.data?.email as string) || "demo.user@business365.com";
  const initials = userName.split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase();
  const currentLabel = MODULES.find((m) => isActive(m.path))?.label ?? (pathname === "/profile" ? "My Profile" : "Business 365");

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* Sidebar */}
      <aside className="sticky top-0 flex h-screen w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
        <div className="flex items-center gap-2.5 px-5 py-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground shadow">
            <Grid3x3 className="h-5 w-5" />
          </div>
          <div>
            <div className="text-sm font-semibold tracking-tight">Business 365</div>
            <div className="text-[10px] uppercase tracking-wider opacity-70">Dynamics Suite</div>
          </div>
        </div>

        <nav className="flex-1 space-y-0.5 px-3 pt-2">
          <div className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider opacity-60">
            Modules
          </div>
          {MODULES.map((m) => {
            const Icon = ICONS[m.icon as keyof typeof ICONS] ?? LayoutDashboard;
            const active = isActive(m.path);
            return (
              <Link
                key={m.id}
                to={m.path}
                className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                  active
                    ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                    : "opacity-90 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{m.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-sidebar-border p-3">
          <div className="flex items-center gap-2 rounded-md bg-sidebar-accent/60 px-3 py-2 text-xs">
            <Activity
              className={`h-3.5 w-3.5 ${
                health.isSuccess ? "text-emerald-400" : health.isError ? "text-rose-400" : "text-amber-400"
              }`}
            />
            <span className="opacity-80">
              API {health.isSuccess ? "online" : health.isError ? "offline" : "…"}
            </span>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top app bar — BC365 style */}
        <header className="sticky top-0 z-30 flex h-12 items-center gap-3 border-b border-border bg-sidebar px-4 text-sidebar-foreground">
          <Link to="/" className="text-sm font-semibold tracking-tight">
            Business 365
          </Link>
          <span className="text-xs opacity-60">|</span>
          <span className="text-xs opacity-80">{currentLabel}</span>

          <div className="ml-6 hidden flex-1 max-w-md md:block">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 opacity-60" />
              <input
                placeholder="Search (Alt+Q)"
                className="h-8 w-full rounded-md border border-sidebar-border bg-sidebar-accent/40 pl-8 pr-3 text-sm placeholder:opacity-60 focus:border-sidebar-primary focus:outline-none"
              />
            </div>
          </div>

          <div className="ml-auto flex items-center gap-1">
            <IconBtn title="Notifications"><Bell className="h-4 w-4" /></IconBtn>
            <IconBtn title="Help"><HelpCircle className="h-4 w-4" /></IconBtn>
            <IconBtn title={theme === "dark" ? "Switch to light" : "Switch to dark"} onClick={toggle}>
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </IconBtn>
            <IconBtn title="Settings"><Link to="/settings"><Settings className="h-4 w-4" /></Link></IconBtn>

            <div className="relative ml-1" ref={menuRef}>
              <button
                onClick={() => setMenuOpen((v) => !v)}
                className="flex items-center gap-2 rounded-md px-1.5 py-1 hover:bg-sidebar-accent"
              >
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-sidebar-primary text-xs font-semibold text-sidebar-primary-foreground">
                  {initials}
                </div>
                <ChevronDown className="h-3 w-3 opacity-70" />
              </button>
              {menuOpen && (
                <div className="absolute right-0 mt-2 w-72 overflow-hidden rounded-lg border border-border bg-popover text-popover-foreground shadow-xl">
                  <div className="flex items-center gap-3 border-b border-border p-4">
                    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary text-base font-semibold text-primary-foreground">
                      {initials}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold">{userName}</div>
                      <div className="truncate text-xs text-muted-foreground">{userEmail}</div>
                    </div>
                  </div>
                  <div className="p-1.5 text-sm">
                    <Link to="/profile" onClick={() => setMenuOpen(false)} className="block rounded-md px-3 py-2 hover:bg-accent">
                      My profile
                    </Link>
                    <Link to="/settings" onClick={() => setMenuOpen(false)} className="block rounded-md px-3 py-2 hover:bg-accent">
                      Settings
                    </Link>
                    <button
                      onClick={() => { toggle(); setMenuOpen(false); }}
                      className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left hover:bg-accent"
                    >
                      <span>Theme</span>
                      <span className="text-xs text-muted-foreground capitalize">{theme}</span>
                    </button>
                    <div className="my-1 border-t border-border" />
                    <button className="block w-full rounded-md px-3 py-2 text-left hover:bg-accent">
                      Sign out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-x-hidden p-6">
          <Outlet />
        </main>
      </div>
    </div>
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
      className="inline-flex h-8 w-8 items-center justify-center rounded-md text-sidebar-foreground hover:bg-sidebar-accent"
    >
      {children}
    </button>
  );
}
