import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { setAuthToken, apiGet, loadStoredToken } from "@/lib/api";
import { initializeMsal, login as msalLogin, logout as msalLogout } from "@/lib/msal";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const checkAuth = useCallback(async () => {
    try {
      const me = await apiGet("/auth/me");
      if (me?.authenticated && me?.user) {
        setUser(me.user);
        setIsAuthenticated(true);
        return true;
      }
    } catch {
      // Not authenticated
    }
    setUser(null);
    setIsAuthenticated(false);
    return false;
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
    await msalLogin();
    await checkAuth();
  }, [checkAuth]);

  const logout = useCallback(async () => {
    await msalLogout();
    setUser(null);
    setIsAuthenticated(false);
  }, []);

  return (
    <AuthContext.Provider value={{ user, isAuthenticated, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
