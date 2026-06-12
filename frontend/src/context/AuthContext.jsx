import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { apiGet, loadStoredToken, resetStoredToken } from "@/lib/api";
import {
  initializeMsal,
  login as msalLogin,
  logout as msalLogout,
  getMsalAccountProfile,
  refreshApiToken,
  refreshBcToken,
} from "@/lib/msal";
import { mergeUserProfile } from "@/lib/user";

const AuthContext = createContext(null);

async function resolveUser() {
  await refreshBcToken();
  const [me, msal] = await Promise.all([
    apiGet("/auth/me"),
    getMsalAccountProfile(),
  ]);

  if (me?.authenticated && me?.user) {
    return mergeUserProfile(me.user, msal);
  }
  return null;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  const checkAuth = useCallback(async () => {
    let errorMsg = null;
    try {
      let merged = await resolveUser();
      if (merged) {
        setUser(merged);
        setIsAuthenticated(true);
        setAuthError(null);
        // Enrich with Microsoft Graph profile (photo, job title, etc.) in the background.
        getMsalAccountProfile()
          .then((msal) => {
            const enriched = mergeUserProfile(merged, msal);
            if (enriched) setUser(enriched);
          })
          .catch(() => {});
        return { ok: true };
      }

      const me = await apiGet("/auth/me");
      if (me?.detail) {
        errorMsg = typeof me.detail === "string" ? me.detail : JSON.stringify(me.detail);
      }
    } catch (err) {
      errorMsg = err instanceof Error ? err.message : "Authentication check failed";
    }

    await refreshBcToken();
    const refreshed = await refreshApiToken();
    if (refreshed) {
      try {
        let merged = await resolveUser();
        if (merged) {
          setUser(merged);
          setIsAuthenticated(true);
          setAuthError(null);
          getMsalAccountProfile()
            .then((msal) => {
              const enriched = mergeUserProfile(merged, msal);
              if (enriched) setUser(enriched);
            })
            .catch(() => {});
          return { ok: true };
        }
      } catch (err) {
        errorMsg = err instanceof Error ? err.message : errorMsg;
      }
    }

    resetStoredToken();
    setUser(null);
    setIsAuthenticated(false);
    setAuthError(errorMsg);
    return { ok: false, error: errorMsg };
  }, []);

  const refreshProfile = useCallback(async () => {
    try {
      const profile = await apiGet("/auth/profile");
      const msal = await getMsalAccountProfile();
      if (profile?.user) {
        const merged = mergeUserProfile(profile.user, msal);
        setUser(merged);
        return merged;
      }
    } catch {
      /* keep existing user */
    }
    return null;
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      loadStoredToken();
      await initializeMsal();
      if (!cancelled) {
        await checkAuth();
        setIsLoading(false);
      }
    }

    init();
    return () => { cancelled = true; };
  }, [checkAuth]);

  const login = useCallback(async () => {
    try {
      const loginResult = await msalLogin();
      if (loginResult === "redirecting") return;

      const authResult = await checkAuth();
      if (!authResult.ok) {
        throw new Error(
          authResult.error ||
            "Microsoft sign-in succeeded but the API rejected the token. Try signing in again."
        );
      }
    } catch (err) {
      setUser(null);
      setIsAuthenticated(false);
      throw err;
    }
  }, [checkAuth]);

  const logout = useCallback(async () => {
    await msalLogout();
    setUser(null);
    setIsAuthenticated(false);
  }, []);

  const connectBusinessCentral = useCallback(async () => {
    try {
      const token = await refreshBcToken(true);
      return token;
    } catch (err) {
      console.error("Failed to connect to Business Central:", err);
      throw err;
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        isLoading,
        authError,
        login,
        logout,
        refreshProfile,
        connectBusinessCentral,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
