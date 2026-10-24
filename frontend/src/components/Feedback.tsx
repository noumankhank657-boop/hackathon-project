import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ApiError } from "../api/client";
import { useAuth } from "../auth/AuthContext";

export function LoadingScreen({ label = "Loading…" }: { label?: string }) {
  return (
    <main className="auth-shell">
      <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm text-slate-600 shadow-sm">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-teal-700 border-t-transparent" />
        {label}
      </div>
    </main>
  );
}

export function LoadingState({ label = "Loading…" }: { label?: string }) {
  return (
    <div role="status" className="flex items-center gap-3 py-8 text-sm text-slate-500">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-teal-700 border-t-transparent" />
      {label}
    </div>
  );
}

export function ErrorAlert({ message, status }: { message: string; status?: number }) {
  return (
    <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
      {status ? <strong className="mr-2">{status}</strong> : null}
      {message}
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-center">
      <h3 className="font-semibold text-slate-800">{title}</h3>
      {children ? <div className="mt-2 text-sm text-slate-500">{children}</div> : null}
    </div>
  );
}

export function PageHeading({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div>
        <p className="eyebrow">HCM LITE</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">{title}</h1>
        {description ? <p className="mt-1 max-w-3xl text-sm text-slate-500">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function Card({ title, subtitle, actions, children, className = "" }: {
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel ${className}`}>
      {title || subtitle || actions ? (
        <div className="mb-4 flex flex-col justify-between gap-3 border-b border-slate-100 pb-3 sm:flex-row sm:items-center">
          <div>
            {title ? <h2 className="text-base font-semibold text-slate-900">{title}</h2> : null}
            {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
          </div>
          {actions}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function Button({ children, variant = "primary", className = "", ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger" | "ghost";
}) {
  return (
    <button className={`button button-${variant} ${className}`} {...props}>
      {children}
    </button>
  );
}

export function Field({ label, hint, className = "", ...props }: React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: string;
}) {
  return (
    <label className={`field ${className}`}>
      <span>{label}</span>
      <input className="input" {...props} />
      {hint ? <small className="text-slate-500">{hint}</small> : null}
    </label>
  );
}

export function SelectField({ label, children, className = "", ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className={`field ${className}`}>
      <span>{label}</span>
      <select className="input" {...props}>{children}</select>
    </label>
  );
}

export function TextAreaField({ label, className = "", ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
}) {
  return (
    <label className={`field ${className}`}>
      <span>{label}</span>
      <textarea className="input min-h-24 resize-y" {...props} />
    </label>
  );
}

export function StatusPill({ value }: { value: string }) {
  const tone = ["APPROVED", "ACTIVE", "PRESENT", "FINALIZED"].includes(value)
    ? "bg-emerald-100 text-emerald-800"
    : ["PENDING", "PROBATION", "LATE", "DRAFT", "MISSING_CHECKOUT"].includes(value)
      ? "bg-amber-100 text-amber-800"
      : ["REJECTED", "INACTIVE", "TERMINATED", "ABSENT"].includes(value)
        ? "bg-rose-100 text-rose-800"
        : "bg-slate-100 text-slate-700";
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${tone}`}>{value.replaceAll("_", " ")}</span>;
}

export function FormError({ error }: { error: unknown }) {
  if (!error) return null;
  if (error instanceof ApiError) return <ErrorAlert message={error.message} status={error.status} />;
  return <ErrorAlert message={error instanceof Error ? error.message : String(error)} />;
}

export function AppFooter() {
  const { session } = useAuth();
  return (
    <footer className="mt-10 border-t border-slate-200 py-5 text-xs text-slate-500">
      Signed in as {session?.user.email ?? "guest"} · HCM Lite
    </footer>
  );
}

export function BackLink({ to, children = "Back" }: { to: string; children?: ReactNode }) {
  return <Link className="text-sm font-semibold text-teal-800 hover:text-teal-950" to={to}>← {children}</Link>;
}
