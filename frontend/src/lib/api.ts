// Centralized API helper for the PO-Validator backend.
// Set VITE_API_URL in .env to point at the FastAPI service, for example http://localhost:8000.

const RAW_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";
const BASE = RAW_BASE.replace(/\/+$/, "");
export const API_CONFIGURED = BASE.length > 0;

let authToken: string | null = null;
let bcAccessToken: string | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
  if (typeof window !== "undefined") {
    if (token) {
      sessionStorage.setItem("po_jwt", token);
      localStorage.removeItem("po_jwt");
    } else {
      sessionStorage.removeItem("po_jwt");
      localStorage.removeItem("po_jwt");
    }
  }
}

export function clearAuthToken() {
  setAuthToken(null);
}

export function loadStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  const token = sessionStorage.getItem("po_jwt") ?? localStorage.getItem("po_jwt");
  if (token) {
    sessionStorage.setItem("po_jwt", token);
    localStorage.removeItem("po_jwt");
  }
  authToken = token;
  return token;
}

/** Clear any cached token (e.g. after a failed /auth/me check). */
export function resetStoredToken() {
  clearAuthToken();
  setBcAccessToken(null);
}

export function setBcAccessToken(token: string | null) {
  bcAccessToken = token;
}

function buildRequestHeaders(extra?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = { Accept: "application/json", ...extra };
  if (authToken) headers.Authorization = `Bearer ${authToken}`;
  if (bcAccessToken) headers["X-BC-Access-Token"] = bcAccessToken;
  return headers;
}

function buildUrl(path: string): string {
  let normalizedPath = path.startsWith("/") ? path : `/${path}`;
  if (BASE.endsWith("/api") && normalizedPath.startsWith("/api/")) {
    normalizedPath = normalizedPath.slice(4);
  }
  return `${BASE}${normalizedPath}`;
}

export async function apiGet<T = unknown>(path: string): Promise<T> {
  if (!API_CONFIGURED) {
    throw new Error("Backend not configured. Set VITE_API_URL in .env to your FastAPI service URL.");
  }

  const res = await fetch(buildUrl(path), { headers: buildRequestHeaders() });
  if (res.status === 401) {
    clearAuthToken();
    throw new Error("Session expired. Please sign in again.");
  }
  if (!res.ok) {
    let detail = `${res.status} ${res.statusText}`;
    try {
      const json = await res.json();
      if (json?.detail) {
        detail = typeof json.detail === "string" ? json.detail : JSON.stringify(json.detail);
      }
    } catch {
      /* ignore non-JSON error bodies */
    }
    throw new Error(detail);
  }

  return res.json() as Promise<T>;
}

export async function apiPostForm<T = unknown>(path: string, formData: FormData): Promise<T> {
  if (!API_CONFIGURED) {
    throw new Error("Backend not configured. Set VITE_API_URL in .env to your FastAPI service URL.");
  }

  const headers = buildRequestHeaders();
  delete headers.Accept;

  const res = await fetch(buildUrl(path), {
    method: "POST",
    headers,
    body: formData,
  });
  if (res.status === 401) {
    clearAuthToken();
    throw new Error("Session expired. Please sign in again.");
  }
  if (!res.ok) {
    let detail = `${res.status} ${res.statusText}`;
    try {
      const json = await res.json();
      if (json?.detail) {
        detail = typeof json.detail === "string" ? json.detail : JSON.stringify(json.detail);
      }
    } catch {
      /* ignore non-JSON error bodies */
    }
    throw new Error(detail);
  }

  return res.json() as Promise<T>;
}

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
  status:
    | "PASS"
    | "AUTO_MAP"
    | "AUTO-MAP"
    | "BLOCK_INACTIVE"
    | "BLOCK-INACTIVE"
    | "BLOCK_UNKNOWN"
    | "BLOCK-UNKNOWN"
    | string;
  message: string;
  timestamp: string;
  validated_by: string;
  notification_channel?: string;
  notification_message?: string;
}

export interface ValidationResponse {
  total: number;
  pass: number;
  auto_map: number;
  block_inactive: number;
  block_unknown: number;
  duplicate?: number;
  missing_code?: number;
  rejected?: number;
  results: ValidationResultRow[];
}

export interface FinanceSummaryResponse {
  data_source?: string;
  live_bc_data?: boolean;
  microsoft_login?: boolean;
  azure_app_configured?: boolean;
  note?: string;
  currency?: string;
  ledger?: Array<Record<string, unknown>>;
  payables?: Array<{ vendor: string; lines: number; total_amount: number }>;
  receivables?: unknown[];
  bank?: {
    total_payable?: number;
    vendor_count?: number;
    open_po_count?: number;
    open_po_lines?: number;
  };
}

export interface DashboardResponse {
  items: { total: number; active: number; inactive: number; categories: number };
  validation: { total: number; pass: number; auto_map: number; block_inactive: number; block_unknown: number };
  po: { total_lines: number; total_pos: number; po_numbers: string[] };
  mappings: { total: number };
}

export interface AuthUserResponse {
  id?: string;
  object_id?: string;
  subject?: string;
  name?: string;
  given_name?: string;
  family_name?: string;
  email?: string;
  username?: string;
  tenant_id?: string;
  roles?: string[];
  job_title?: string;
  department?: string;
  office_location?: string;
  mobile_phone?: string;
  business_phones?: string[];
  photo_url?: string;
  identity_provider?: string;
  auth_provider?: string;
  token_version?: string;
  issued_at?: number;
  expires_at?: number;
}

export interface UploadDatasetStatus {
  dataset: string;
  label: string;
  filename: string;
  exists: boolean;
  rows: number;
  columns: string[];
}

export interface UploadStatusResponse {
  data_source: string;
  datasets: UploadDatasetStatus[];
  last_upload?: UploadWorkbookResponse | null;
  last_trigger?: {
    source?: string;
    po_number?: string;
    received_at?: string;
    lines?: number;
    saved?: UploadedMapping;
  } | null;
}

export interface UploadedSheet {
  name: string;
  mapped_to?: string | null;
  columns: string[];
  row_count: number;
  rows: Array<Record<string, unknown>>;
}

export interface UploadedMapping {
  dataset: string;
  label: string;
  filename: string;
  rows: number;
  columns: string[];
}

export interface UploadWorkbookResponse {
  filename: string;
  sheet_count: number;
  mapped_count: number;
  mapped: UploadedMapping[];
  sheets: UploadedSheet[];
}

export interface MeResponse {
  authenticated: boolean;
  user?: AuthUserResponse;
  detail?: string;
  [k: string]: unknown;
}
