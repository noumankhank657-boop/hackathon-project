import { Link } from "react-router-dom";

export function NotAllowedPage() {
  return (
    <main className="auth-shell px-4 py-10">
      <section className="auth-card w-full max-w-lg text-center">
        <p className="eyebrow">ACCESS DENIED</p>
        <h1 className="mt-2 text-2xl font-bold text-slate-950">You are not allowed to view this page</h1>
        <p className="mt-2 text-sm text-slate-600">This route is not available for your account role. Your access is protected on the server too.</p>
        <Link className="button button-primary mt-6 inline-flex" to="/">Return to your dashboard</Link>
      </section>
    </main>
  );
}
