import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/hcm";
import type { Session } from "../api/types";

const SESSION_KEY = "hcm-session";

type AuthContextValue = {
  session: Session | null;
  needsSetup: boolean | null;
  setupError: string | null;
  setupLoading: boolean;
  setSession: (session: Session | null) => void;
  refreshSetupStatus: () => Promise<void>;
  signOut: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function readSession() {
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Session;
    if (!parsed.token || !parsed.user?.id || !parsed.user?.role) return null;
    return parsed;
  } catch {
    window.localStorage.removeItem(SESSION_KEY);
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [session, setSessionState] = useState<Session | null>(readSession);
  const [needsSetup, setNeedsSetup] = useState<boolean | null>(null);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [setupLoading, setSetupLoading] = useState(true);

  const setSession = useCallback((nextSession: Session | null) => {
    setSessionState(nextSession);
    if (nextSession) window.localStorage.setItem(SESSION_KEY, JSON.stringify(nextSession));
    else window.localStorage.removeItem(SESSION_KEY);
  }, []);

  const refreshSetupStatus = useCallback(async () => {
    setSetupLoading(true);
    setSetupError(null);
    try {
      const status = await api.auth.setupStatus();
      setNeedsSetup(status.needsSetup);
    } catch (error) {
      setSetupError(error instanceof Error ? error.message : "Unable to check first-run status");
    } finally {
      setSetupLoading(false);
    }
  }, []);

  const signOut = useCallback(() => {
    setSession(null);
    navigate("/login", { replace: true });
  }, [navigate, setSession]);

  useEffect(() => {
    void refreshSetupStatus();
  }, [refreshSetupStatus]);

  useEffect(() => {
    const onUnauthorized = () => {
      setSession(null);
      navigate("/login", { replace: true, state: { reason: "Your session expired. Sign in again." } });
    };
    window.addEventListener("hcm:unauthorized", onUnauthorized);
    return () => window.removeEventListener("hcm:unauthorized", onUnauthorized);
  }, [navigate, setSession]);

  const value = useMemo(
    () => ({ session, needsSetup, setupError, setupLoading, setSession, refreshSetupStatus, signOut }),
    [session, needsSetup, setupError, setupLoading, setSession, refreshSetupStatus, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
