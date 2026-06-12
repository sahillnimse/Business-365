// Centralized API helper for the PO-Validator backend.
// Set VITE_API_URL in .env to point at the FastAPI service, for example http://localhost:8000.

const RAW_BASE = import.meta.env.VITE_API_URL ?? "";
const BASE = RAW_BASE.replace(/\/+$/, "");
export const API_CONFIGURED = BASE.length > 0;

let authToken = null;
let bcAccessToken = null;

export function setAuthToken(token) {
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

export function loadStoredToken() {
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

export function setBcAccessToken(token) {
  bcAccessToken = token;
}

function buildRequestHeaders(extra) {
  const headers = { Accept: "application/json", ...extra };
  if (authToken) headers.Authorization = `Bearer ${authToken}`;
  if (bcAccessToken) headers["X-BC-Access-Token"] = bcAccessToken;
  return headers;
}

function buildUrl(path) {
  let normalizedPath = path.startsWith("/") ? path : `/${path}`;
  if (BASE.endsWith("/api") && normalizedPath.startsWith("/api/")) {
    normalizedPath = normalizedPath.slice(4);
  }
  return `${BASE}${normalizedPath}`;
}

export async function apiGet(path) {
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

  return res.json();
}

export async function apiPostForm(path, formData) {
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

  return res.json();
}
