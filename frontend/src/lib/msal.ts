import type { AuthenticationResult, Configuration, PublicClientApplication } from "@azure/msal-browser";
import { API_CONFIGURED, setAuthToken, setBcAccessToken as storeBcAccessToken } from "./api";

const TENANT_ID =
  (import.meta.env.VITE_AZURE_TENANT_ID as string) ||
  "99096dce-9dea-4f18-b4bb-b586eea333ee";
const CLIENT_ID =
  (import.meta.env.VITE_AZURE_CLIENT_ID as string) ||
  "34f6d960-09e3-47a3-9783-7ae8bac4bf46";
const AZURE_CONFIGURED = Boolean(
  import.meta.env.VITE_AZURE_TENANT_ID && import.meta.env.VITE_AZURE_CLIENT_ID,
);

const API_SCOPE = import.meta.env.VITE_AZURE_API_SCOPE as string | undefined;
// Default OIDC scopes return an id_token (aud = client_id) for our API.
const SCOPES = API_SCOPE ? [API_SCOPE, "openid", "profile", "email"] : ["openid", "profile", "email", "User.Read"];
const GRAPH_PROFILE_SCOPES = ["User.Read"];
const BC_SCOPES = ["https://api.businesscentral.dynamics.com/user_impersonation"];

let bcAccessToken: string | null = null;

function getRedirectUri(): string {
  return (
    (import.meta.env.VITE_AZURE_REDIRECT_URI as string | undefined) ||
    (typeof window !== "undefined" ? window.location.origin : "http://localhost:8080")
  );
}

function buildMsalConfig(): Configuration {
  const redirectUri = getRedirectUri();
  return {
    auth: {
      clientId: CLIENT_ID,
      authority: `https://login.microsoftonline.com/${TENANT_ID}`,
      redirectUri,
      postLogoutRedirectUri: redirectUri,
      navigateToLoginRequestUrl: false,
    },
    cache: {
      cacheLocation: "sessionStorage",
      storeAuthStateInCookie: false,
    },
  };
}

let msalInstance: PublicClientApplication | null = null;
let graphProfileCache: { accountId: string; profile: MsalGraphProfile } | null = null;

function assertBrowserAuthContext(): void {
  if (typeof window === "undefined") {
    throw new Error("Microsoft sign-in is only available in the browser.");
  }
  if (!window.isSecureContext || !window.crypto?.subtle) {
    throw new Error(
      "Microsoft sign-in needs a secure browser context (Web Crypto API). " +
        "Use http://localhost:8080 — not a network IP like http://192.168.x.x:8080. " +
        "Browsers block crypto on plain HTTP except for localhost.",
    );
  }
}

async function getMsalInstance(): Promise<PublicClientApplication> {
  assertBrowserAuthContext();
  if (!msalInstance) {
    const { PublicClientApplication } = await import("@azure/msal-browser");
    msalInstance = new PublicClientApplication(buildMsalConfig());
  }
  return msalInstance;
}

function pickApiToken(response: AuthenticationResult | null | undefined): string | null {
  if (!response) return null;

  if (API_SCOPE) {
    // Custom API scope → use the access token issued for our backend.
    return response.accessToken || null;
  }

  // Default SPA flow → backend validates the Microsoft ID token (aud = client ID).
  // Never send the Graph access token; it has the wrong audience.
  return response.idToken || null;
}

function storeToken(response: AuthenticationResult | null | undefined) {
  const token = pickApiToken(response);
  if (!token) return null;
  setAuthToken(token);
  return token;
}

export function getBcAccessToken(): string | null {
  return bcAccessToken;
}

export function clearBcAccessToken() {
  bcAccessToken = null;
  storeBcAccessToken(null);
}

export async function refreshBcToken(): Promise<string | null> {
  if (typeof window === "undefined") return null;

  try {
    assertBrowserAuthContext();
    const instance = await getMsalInstance();
    await instance.initialize();
    const account = instance.getActiveAccount() ?? instance.getAllAccounts()[0];
    if (!account) return null;
    instance.setActiveAccount(account);
    const response = await instance.acquireTokenSilent({ scopes: BC_SCOPES, account });
    bcAccessToken = response.accessToken || null;
    storeBcAccessToken(bcAccessToken);
    return bcAccessToken;
  } catch (err) {
    if (isInteractionRequiredError(err)) {
      console.info("[msal] Business Central consent required — redirecting for user_impersonation");
      const instance = await getMsalInstance();
      await instance.acquireTokenRedirect({ scopes: BC_SCOPES });
      return null;
    }
    console.warn("[msal] Business Central token acquisition failed:", err);
    bcAccessToken = null;
    storeBcAccessToken(null);
    return null;
  }
}

export async function refreshApiToken(): Promise<string | null> {
  if (typeof window === "undefined") return null;

  try {
    assertBrowserAuthContext();
    const instance = await getMsalInstance();
    await instance.initialize();
    const account = instance.getActiveAccount() ?? instance.getAllAccounts()[0];
    if (!account) return null;
    instance.setActiveAccount(account);
    const response = await instance.acquireTokenSilent({ scopes: SCOPES, account });
    return storeToken(response);
  } catch (err) {
    console.warn("[msal] Silent API token refresh failed:", err);
    return null;
  }
}

export async function initializeMsal(): Promise<void> {
  if (typeof window === "undefined") return;

  try {
    assertBrowserAuthContext();
  } catch (err) {
    console.warn("[msal] Skipping init:", err);
    return;
  }

  try {
    const instance = await getMsalInstance();
    await instance.initialize();
    const response = await instance.handleRedirectPromise();
    if (response?.account) {
      instance.setActiveAccount(response.account);
    }
    if (storeToken(response)) {
      console.log("[msal] Redirect handled - token stored");
    }
    await refreshBcToken();
  } catch (err) {
    console.warn("[msal] handleRedirectPromise failed:", err);
  }
}

export async function login(): Promise<"authenticated" | "redirecting"> {
  try {
    const instance = await getMsalInstance();
    await instance.initialize();

    const redirectResult = await instance.handleRedirectPromise();
    if (redirectResult?.account) {
      instance.setActiveAccount(redirectResult.account);
      if (storeToken(redirectResult)) {
        console.log("[msal] Login successful via redirect");
        return "authenticated";
      }
    }

    const accounts = instance.getAllAccounts();
    if (accounts.length > 0) {
      instance.setActiveAccount(accounts[0]);
      try {
        const silent = await instance.acquireTokenSilent({ scopes: SCOPES, account: accounts[0] });
        if (storeToken(silent)) {
          console.log("[msal] Login successful via silent token");
          return "authenticated";
        }
        console.warn("[msal] Silent response had no usable ID token — starting interactive login");
      } catch (silentErr) {
        console.warn("[msal] Silent token acquisition failed:", silentErr);
      }
    }

    await instance.loginRedirect({ scopes: SCOPES });
    return "redirecting";
  } catch (err) {
    console.error("[msal] Login failed:", err);

    if (API_CONFIGURED && !AZURE_CONFIGURED) {
      try {
        await devLogin();
        return "authenticated";
      } catch (devErr) {
        console.error("[msal] Dev login fallback also failed:", devErr);
      }
    }
    throw err;
  }
}

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
  console.log("[msal] Dev fallback login - dummy JWT stored");
}

export interface MsalAccountProfile {
  name?: string;
  email?: string;
  username?: string;
  givenName?: string;
  familyName?: string;
  tenantId?: string;
  objectId?: string;
  roles?: string[];
  jobTitle?: string;
  department?: string;
  officeLocation?: string;
  mobilePhone?: string;
  businessPhones?: string[];
  photoUrl?: string;
}

interface GraphUserResponse {
  displayName?: string;
  mail?: string | null;
  userPrincipalName?: string;
  givenName?: string;
  surname?: string;
  jobTitle?: string | null;
  department?: string | null;
  officeLocation?: string | null;
  mobilePhone?: string | null;
  businessPhones?: string[];
}

type MsalGraphProfile = Pick<
  MsalAccountProfile,
  | "name"
  | "email"
  | "username"
  | "givenName"
  | "familyName"
  | "jobTitle"
  | "department"
  | "officeLocation"
  | "mobilePhone"
  | "businessPhones"
  | "photoUrl"
>;

function isInteractionRequiredError(err: unknown): boolean {
  const error = err as { errorCode?: string; errorMessage?: string; message?: string };
  const text = `${error?.errorCode ?? ""} ${error?.errorMessage ?? ""} ${error?.message ?? ""}`.toLowerCase();
  return (
    text.includes("interaction_required") ||
    text.includes("consent_required") ||
    text.includes("login_required")
  );
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

async function fetchGraphProfile(
  instance: PublicClientApplication,
  account: ReturnType<PublicClientApplication["getActiveAccount"]>,
): Promise<MsalGraphProfile | null> {
  if (!account) return null;
  if (graphProfileCache?.accountId === account.homeAccountId) return graphProfileCache.profile;

  try {
    const token = await instance.acquireTokenSilent({
      scopes: GRAPH_PROFILE_SCOPES,
      account,
    });

    const profileRes = await fetch(
      "https://graph.microsoft.com/v1.0/me?$select=displayName,mail,userPrincipalName,givenName,surname,jobTitle,department,officeLocation,mobilePhone,businessPhones",
      { headers: { Authorization: `Bearer ${token.accessToken}` } },
    );
    if (!profileRes.ok) return null;

    const graphUser = (await profileRes.json()) as GraphUserResponse;
    let photoUrl: string | undefined;
    try {
      const photoRes = await fetch("https://graph.microsoft.com/v1.0/me/photo/$value", {
        headers: { Authorization: `Bearer ${token.accessToken}` },
      });
      if (photoRes.ok) {
        photoUrl = await blobToDataUrl(await photoRes.blob());
      }
    } catch {
      /* A missing profile photo should not affect sign-in. */
    }

    const profile: MsalGraphProfile = {
      name: graphUser.displayName,
      email: graphUser.mail ?? graphUser.userPrincipalName,
      username: graphUser.userPrincipalName,
      givenName: graphUser.givenName,
      familyName: graphUser.surname,
      jobTitle: graphUser.jobTitle ?? undefined,
      department: graphUser.department ?? undefined,
      officeLocation: graphUser.officeLocation ?? undefined,
      mobilePhone: graphUser.mobilePhone ?? undefined,
      businessPhones: graphUser.businessPhones,
      photoUrl,
    };
    graphProfileCache = { accountId: account.homeAccountId, profile };
    return profile;
  } catch (err) {
    if (!isInteractionRequiredError(err)) {
      console.warn("[msal] Graph profile fetch failed:", err);
    }
    return null;
  }
}

export async function getMsalAccountProfile(): Promise<MsalAccountProfile | null> {
  if (typeof window === "undefined") return null;

  try {
    assertBrowserAuthContext();
    const instance = await getMsalInstance();
    await instance.initialize();
    const account = instance.getActiveAccount() ?? instance.getAllAccounts()[0];
    if (!account) return null;

    const claims = (account.idTokenClaims ?? {}) as Record<string, unknown>;
    const roles = claims.roles;
    const graphProfile = await fetchGraphProfile(instance, account);
    return {
      name: graphProfile?.name ?? account.name ?? (claims.name as string | undefined),
      email: graphProfile?.email ?? account.username,
      username: graphProfile?.username ?? account.username,
      givenName: graphProfile?.givenName ?? (claims.given_name as string | undefined),
      familyName: graphProfile?.familyName ?? (claims.family_name as string | undefined),
      tenantId: (claims.tid as string | undefined) ?? account.tenantId,
      objectId: (claims.oid as string | undefined) ?? account.localAccountId,
      roles: Array.isArray(roles) ? (roles as string[]) : roles ? [String(roles)] : [],
      jobTitle: graphProfile?.jobTitle,
      department: graphProfile?.department,
      officeLocation: graphProfile?.officeLocation,
      mobilePhone: graphProfile?.mobilePhone,
      businessPhones: graphProfile?.businessPhones,
      photoUrl: graphProfile?.photoUrl,
    };
  } catch {
    return null;
  }
}

export async function logout(): Promise<void> {
  setAuthToken(null);
  clearBcAccessToken();
  graphProfileCache = null;
  if (typeof window === "undefined") return;

  try {
    assertBrowserAuthContext();
    const instance = await getMsalInstance();
    await instance.initialize();
    const account = instance.getActiveAccount() ?? instance.getAllAccounts()[0];
    if (account) {
      await instance.logoutRedirect({ account });
      return;
    }
  } catch (err) {
    console.warn("[msal] Logout warning:", err);
  }
  console.log("[msal] Logged out");
}
