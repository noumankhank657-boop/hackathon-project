import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { api } from "../api/hcm";
import { ApiError } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { Button, ErrorAlert, Field } from "../components/Feedback";

function AuthFrame({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <main className="auth-shell px-4 py-8">
      <div className="auth-card w-full max-w-md">
        <div className="mb-6">
          <p className="eyebrow">HCM LITE · PEOPLE OPERATIONS</p>
          <h1 className="mt-2 text-2xl font-bold text-slate-950">{title}</h1>
          <p className="mt-2 text-sm text-slate-500">{description}</p>
        </div>
        {children}
      </div>
    </main>
  );
}

export function SetupPage() {
  const { setSession, refreshSetupStatus } = useAuth();
  const navigate = useNavigate();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<{ message: string; status?: number } | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(null);
    try {
      const result = await api.auth.setup({
        companyName: String(form.get("companyName")),
        email: String(form.get("email")),
        password: String(form.get("password")),
      });
      setSession(result);
      await refreshSetupStatus();
      navigate("/", { replace: true });
    } catch (reason) {
      setError(reason instanceof ApiError
        ? { message: reason.message, status: reason.status }
        : { message: reason instanceof Error ? reason.message : "Unable to create the Admin account" });
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthFrame title="Set up your company" description="Create the first Admin account to begin configuring your workspace.">
      <form className="grid gap-4" onSubmit={submit}>
        {error ? <ErrorAlert message={error.message} status={error.status} /> : null}
        <Field label="Company name" name="companyName" autoComplete="organization" required minLength={2} maxLength={100} />
        <Field label="Admin email" name="email" type="email" autoComplete="email" required />
        <Field label="Password" name="password" type="password" autoComplete="new-password" required minLength={8} />
        <Button disabled={pending}>{pending ? "Creating account…" : "Create Admin account"}</Button>
      </form>
    </AuthFrame>
  );
}

export function LoginPage() {
  const { setSession, needsSetup, setupLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<{ message: string; status?: number } | null>(
    (location.state as { reason?: string } | null)?.reason ? { message: (location.state as { reason: string }).reason } : null,
  );

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(null);
    try {
      const result = await api.auth.login({
        email: String(form.get("email")),
        password: String(form.get("password")),
      });
      setSession(result);
      navigate(result.user.mustChangePassword ? "/change-password" : "/", { replace: true });
    } catch (reason) {
      setError(reason instanceof ApiError
        ? { message: reason.message, status: reason.status }
        : { message: reason instanceof Error ? reason.message : "Unable to sign in" });
    } finally {
      setPending(false);
    }
  }

  if (setupLoading) {
    return <AuthFrame title="Welcome back" description="Checking your workspace…"><p className="text-sm text-slate-500">Loading…</p></AuthFrame>;
  }

  return (
    <AuthFrame title="Welcome back" description="Sign in with your HCM Lite account.">
      <form className="grid gap-4" onSubmit={submit}>
        {error ? <ErrorAlert message={error.message} status={error.status} /> : null}
        <Field label="Email" name="email" type="email" autoComplete="email" required />
        <Field label="Password" name="password" type="password" autoComplete="current-password" required />
        <Button disabled={pending}>{pending ? "Signing in…" : "Sign in"}</Button>
        {needsSetup ? <p className="text-sm text-slate-500">First visit? <Link className="font-semibold text-teal-800" to="/setup">Set up your company</Link></p> : null}
      </form>
    </AuthFrame>
  );
}

export function ChangePasswordPage() {
  const { session, setSession } = useAuth();
  const navigate = useNavigate();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<{ message: string; status?: number } | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const newPassword = String(form.get("newPassword"));
    if (newPassword !== String(form.get("confirmPassword"))) {
      setError({ message: "The new passwords do not match." });
      return;
    }
    setPending(true);
    setError(null);
    try {
      await api.auth.changePassword({
        currentPassword: String(form.get("currentPassword")),
        newPassword,
      });
      if (session) setSession({ ...session, user: { ...session.user, mustChangePassword: false } });
      navigate("/", { replace: true });
    } catch (reason) {
      setError(reason instanceof ApiError
        ? { message: reason.message, status: reason.status }
        : { message: reason instanceof Error ? reason.message : "Unable to change password" });
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthFrame title="Change your password" description="Your account requires a new password before you can continue.">
      <form className="grid gap-4" onSubmit={submit}>
        {error ? <ErrorAlert message={error.message} status={error.status} /> : null}
        <Field label="Current password" name="currentPassword" type="password" autoComplete="current-password" required />
        <Field label="New password" name="newPassword" type="password" autoComplete="new-password" required minLength={8} />
        <Field label="Confirm new password" name="confirmPassword" type="password" autoComplete="new-password" required minLength={8} />
        <Button disabled={pending}>{pending ? "Saving…" : "Save new password"}</Button>
      </form>
    </AuthFrame>
  );
}
