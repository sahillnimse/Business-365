// Centralized API helper for the PO-Validator backend.
// Set VITE_API_URL in .env to point at the FastAPI service (e.g. http://localhost:8000).
// Falls back to "/api" which assumes a dev proxy or same-origin deployment.

const RAW_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";
// Normalize: remove trailing slash. Empty string = backend not configured.
const BASE = RAW_BASE.replace(/\/+$/, "");
export const API_CONFIGURED = BASE.length > 0;

let authToken: string | null = null;
export function setAuthToken(token: string | null) {
  authToken = token;
  if (typeof window !== "undefined") {
    if (token) localStorage.setItem("po_jwt", token);
    else localStorage.removeItem("po_jwt");
  }
}
export function loadStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  const t = localStorage.getItem("po_jwt");
  authToken = t;
  return t;
}

function buildUrl(path: string): string {
  // path may start with "/" or not, and may already include "/api"
  let p = path.startsWith("/") ? path : `/${path}`;
  // If BASE already ends with "/api" and path also starts with "/api", strip one
  if (BASE.endsWith("/api") && p.startsWith("/api/")) p = p.slice(4);
  // If BASE does NOT include /api and path doesn't start with /api, add nothing — caller picks
  return `${BASE}${p}`;
}

export async function apiGet<T = unknown>(path: string): Promise<T> {
  if (!API_CONFIGURED) {
    throw new Error("Backend not configured. Set VITE_API_URL in .env to your FastAPI service URL.");
  }
  const headers: Record<string, string> = { Accept: "application/json" };
  if (authToken) headers.Authorization = `Bearer ${authToken}`;
  const res = await fetch(buildUrl(path), { headers });
  if (res.status === 401) {
    // Token missing or expired — trigger Microsoft login
    const { login } = await import("./msal");
    await login();
    throw new Error("Session expired — please sign in again.");
  }
  if (!res.ok) {
    let detail = `${res.status} ${res.statusText}`;
    try {
      const j = await res.json();
      if (j?.detail) detail = typeof j.detail === "string" ? j.detail : JSON.stringify(j.detail);
    } catch {
      /* ignore */
    }
    throw new Error(detail);
  }
  return res.json() as Promise<T>;
}

// ---- Typed response shapes ----
export interface ItemRow {
  "Item Code"?: string;
  "Item Description"?: string;
  Category?: string;
  Status?: string;
  [k: string]: unknown;
}
export interface MappingRow {
  "Old Item Code"?: string;
  "New Item Code"?: string;
  [k: string]: unknown;
}
export interface PoLine {
  "PO Number"?: string;
  "Line #"?: number;
  "Item Code"?: string;
  Vendor?: string;
  Qty?: number;
  "Unit Price (USD)"?: number;
  [k: string]: unknown;
}
export interface ValidationResultRow {
  po_number: string;
  line_num: number;
  original_code: string;
  mapped_code: string;
  status: "PASS" | "AUTO_MAP" | "AUTO-MAP" | "BLOCK_INACTIVE" | "BLOCK-INACTIVE" | "BLOCK_UNKNOWN" | "BLOCK-UNKNOWN" | string;
  message: string;
  timestamp: string;
  validated_by: string;
}
export interface ValidationResponse {
  total: number;
  pass: number;
  auto_map: number;
  block_inactive: number;
  block_unknown: number;
  results: ValidationResultRow[];
}
export interface DashboardResponse {
  items: { total: number; active: number; inactive: number; categories: number };
  validation: { total: number; pass: number; auto_map: number; block_inactive: number; block_unknown: number };
  po: { total_lines: number; total_pos: number; po_numbers: string[] };
  mappings: { total: number };
}
export interface MeResponse {
  authenticated: boolean;
  user?: {
    id?: string;
    name?: string;
    email?: string;
    [k: string]: unknown;
  };
  [k: string]: unknown;
}
