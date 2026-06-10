/**
 * msal.ts — Microsoft Authentication using @azure/msal-browser
 *
 * Tenant ID  : 99096dce-9dea-4f18-b4bb-b586eea333ee
 * Client ID  : 34f6d960-09e3-47a3-9783-7ae8bac4bf46
 *
 * Flow: redirect-based popup fallback.
 * On `login()`:
 *   1. If MSAL is available, trigger a popup login and acquire a token.
 *   2. Store the access token so apiGet() sends it as Bearer.
 * On `logout()`:
 *   1. Clear the stored token and sign out of MSAL.
 *
 * For local development without Azure credentials the function falls
 * back to the backend /login dummy endpoint automatically.
 */

import { PublicClientApplication, type AuthenticationResult, type Configuration } from "@azure/msal-browser";
import { setAuthToken, API_CONFIGURED } from "./api";

const TENANT_ID =
  (import.meta.env.VITE_AZURE_TENANT_ID as string) ||
  "99096dce-9dea-4f18-b4bb-b586eea333ee";
const CLIENT_ID =
  (import.meta.env.VITE_AZURE_CLIENT_ID as string) ||
  "34f6d960-09e3-47a3-9783-7ae8bac4bf46";

// The scope requests an access token for the backend API.
// If you registered a custom scope (e.g. api://<CLIENT_ID>/access_as_user) add it here.
const SCOPES = [`api://${CLIENT_ID}/access_as_user`, "openid", "profile", "email"];

const msalConfig: Configuration = {
  auth: {
    clientId: CLIENT_ID,
    authority: `https://login.microsoftonline.com/${TENANT_ID}`,
    redirectUri: typeof window !== "undefined" ? window.location.origin : "http://localhost:5173",
    postLogoutRedirectUri: typeof window !== "undefined" ? window.location.origin : "http://localhost:5173",
  },
  cache: {
    cacheLocation: "localStorage",
    storeAuthStateInCookie: false,
  },
};

// Singleton instance — created lazily on first use (SSR-safe)
let _msalInstance: PublicClientApplication | null = null;

function getMsalInstance(): PublicClientApplication {
  if (!_msalInstance) {
    _msalInstance = new PublicClientApplication(msalConfig);
  }
  return _msalInstance;
}

/**
 * Initialize MSAL and handle any redirect response that may be pending
 * after a loginRedirect() call. Call this once at app startup (e.g. in main.tsx).
 */
export async function initializeMsal(): Promise<void> {
  try {
    const instance = getMsalInstance();
    await instance.initialize();
    const response: AuthenticationResult | null = await instance.handleRedirectPromise();
    if (response?.accessToken) {
      setAuthToken(response.accessToken);
      console.log("[msal] Redirect handled — token stored");
    }
  } catch (err) {
    console.warn("[msal] handleRedirectPromise failed:", err);
  }
}

/**
 * Trigger Microsoft login.
 * Uses popup first; on failure (e.g. popup blocked) falls back to redirect.
 */
export async function login(): Promise<void> {
  try {
    const instance = getMsalInstance();
    await instance.initialize();

    let response: AuthenticationResult | null = null;

    // Try popup login
    try {
      response = await instance.loginPopup({ scopes: SCOPES });
    } catch (popupErr) {
      console.warn("[msal] Popup login failed, trying redirect:", popupErr);
      await instance.loginRedirect({ scopes: SCOPES });
      return; // page will redirect — nothing more to do here
    }

    if (response) {
      // Get a proper access token for the API
      const tokenResponse = await instance.acquireTokenSilent({
        scopes: SCOPES,
        account: response.account,
      });
      setAuthToken(tokenResponse.accessToken);
      console.log("[msal] Login successful — token stored");
    }
  } catch (err) {
    console.error("[msal] Login failed:", err);

    // Fallback for local dev: use the backend dummy /login endpoint
    if (API_CONFIGURED) {
      try {
        await devLogin();
      } catch (devErr) {
        console.error("[msal] Dev login fallback also failed:", devErr);
      }
    }
  }
}

/**
 * Local-development fallback: POST /login to get a dummy JWT.
 */
async function devLogin(): Promise<void> {
  const base = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/+$/, "") ?? "";
  const res = await fetch(`${base}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "dev-user" }),
  });
  if (!res.ok) throw new Error(`Dev login failed: ${res.status}`);
  const data = (await res.json()) as { access_token: string };
  setAuthToken(data.access_token);
  console.log("[msal] Dev fallback login — dummy JWT stored");
}

/**
 * Sign the user out of both the app and Microsoft.
 */
export async function logout(): Promise<void> {
  setAuthToken(null);
  try {
    const instance = getMsalInstance();
    await instance.initialize();
    const accounts = instance.getAllAccounts();
    if (accounts.length > 0) {
      await instance.logoutPopup({ account: accounts[0] });
    }
  } catch (err) {
    // Non-fatal — token is already cleared locally
    console.warn("[msal] Logout warning:", err);
  }
  console.log("[msal] Logged out");
}
