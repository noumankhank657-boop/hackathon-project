import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext";
import type { Role } from "../api/types";
import { LoadingScreen } from "../components/Feedback";
import { NotAllowedPage } from "../pages/NotAllowedPage";

export function ProtectedRoute({ children, allowMustChange = false }: { children: ReactNode; allowMustChange?: boolean }) {
  const { session, setupLoading } = useAuth();
  const location = useLocation();

  if (!session) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (session.user.mustChangePassword && !allowMustChange && location.pathname !== "/change-password") {
    return <Navigate to="/change-password" replace />;
  }
  if (!session.user.mustChangePassword && location.pathname === "/change-password") {
    return <Navigate to="/" replace />;
  }
  if (setupLoading) return <LoadingScreen label="Checking account…" />;
  return <>{children}</>;
}

export function RoleGuard({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { session } = useAuth();
  if (!session || !roles.includes(session.user.role)) return <NotAllowedPage />;
  return <>{children}</>;
}

export function PublicOnly({ children }: { children: ReactNode }) {
  const { session, needsSetup, setupLoading, setupError } = useAuth();
  const location = useLocation();

  if (setupLoading) return <LoadingScreen label="Checking HCM Lite…" />;
  if (setupError) return <main className="auth-shell"><div className="auth-card"><h1>Unable to connect</h1><p className="text-rose-700">{setupError}</p><button className="button button-primary" onClick={() => window.location.reload()}>Try again</button></div></main>;
  if (session) {
    if (session.user.mustChangePassword) return <Navigate to="/change-password" replace />;
    return <Navigate to="/" replace state={{ from: location.pathname }} />;
  }
  return <>{children}</>;
}

export function SetupOnly({ children }: { children: ReactNode }) {
  const { session, needsSetup, setupLoading, setupError } = useAuth();
  if (setupLoading) return <LoadingScreen label="Checking first-run setup…" />;
  if (setupError) return <main className="auth-shell"><div className="auth-card"><h1>Unable to connect</h1><p className="text-rose-700">{setupError}</p><button className="button button-primary" onClick={() => window.location.reload()}>Try again</button></div></main>;
  if (session) return <Navigate to={session.user.mustChangePassword ? "/change-password" : "/"} replace />;
  if (!needsSetup) return <Navigate to="/login" replace />;
  return <>{children}</>;
}
