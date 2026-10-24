import { useEffect, useState } from "react";

type HealthState =
  | { kind: "loading" }
  | { kind: "success"; status: string }
  | { kind: "error"; message: string };

const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

export default function App() {
  const [health, setHealth] = useState<HealthState>({ kind: "loading" });

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const response = await fetch(`${apiUrl}/health`);

        if (!response.ok) {
          throw new Error(`Backend returned ${response.status}`);
        }

        const data: { status: string } = await response.json();
        setHealth({ kind: "success", status: data.status });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to reach the backend";
        setHealth({ kind: "error", message });
      }
    };

    void checkHealth();
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-5 text-slate-100">
      <section className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-8 shadow-2xl">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-300">HCM Lite</p>
        <h1 className="mt-3 text-3xl font-bold">Project setup</h1>
        <p className="mt-3 text-slate-300">Checking the backend connection before the first company is configured.</p>

        <div className="mt-7 rounded-xl bg-slate-800 p-4" aria-live="polite">
          {health.kind === "loading" && <p>Checking backend health…</p>}
          {health.kind === "success" && <p className="text-emerald-300">Backend status: {health.status}</p>}
          {health.kind === "error" && <p className="text-rose-300">Backend unavailable: {health.message}</p>}
        </div>
      </section>
    </main>
  );
}
