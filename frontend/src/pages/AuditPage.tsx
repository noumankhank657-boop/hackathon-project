import { useState, type FormEvent } from "react";
import { api } from "../api/hcm";
import { Button, Card, EmptyState, Field, FormError, LoadingState, PageHeading } from "../components/Feedback";
import { useResource } from "../hooks/useResource";

function printJson(value: unknown) {
  if (value === null || value === undefined) return "No value recorded";
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return "Unable to display JSON value";
  }
}

export function AuditPage() {
  const [actorIdInput, setActorIdInput] = useState("");
  const [actionInput, setActionInput] = useState("");
  const [entityInput, setEntityInput] = useState("");
  const [filters, setFilters] = useState({ actorId: "", action: "", entity: "", page: 1 });
  const logs = useResource(
    () => api.comms.auditLogs({
      actorId: filters.actorId || undefined,
      action: filters.action || undefined,
      entity: filters.entity || undefined,
      page: filters.page,
      pageSize: 20,
    }),
    [filters.actorId, filters.action, filters.entity, filters.page],
  );

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFilters({ actorId: actorIdInput.trim(), action: actionInput.trim(), entity: entityInput.trim(), page: 1 });
  }

  const pages = Math.max(1, Math.ceil((logs.data?.total ?? 0) / 20));

  return (
    <>
      <PageHeading title="Audit log" description="Read-only history of create, update, approval, and finalization actions." />
      <Card title="Filter audit events">
        <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(10rem,1fr)_minmax(10rem,1fr)_minmax(10rem,1fr)_auto]" onSubmit={applyFilters}>
          <Field label="Actor user ID" value={actorIdInput} onChange={(event) => setActorIdInput(event.target.value)} placeholder="UUID" />
          <Field label="Action" value={actionInput} onChange={(event) => setActionInput(event.target.value)} placeholder="CREATE, APPROVE…" />
          <Field label="Entity" value={entityInput} onChange={(event) => setEntityInput(event.target.value)} placeholder="LEAVE_REQUEST…" />
          <div className="flex items-end"><Button>Apply filters</Button></div>
        </form>
      </Card>
      <Card className="mt-5" title="Audit events" subtitle={logs.data ? `${logs.data.total} event(s)` : undefined}>
        {logs.loading ? <LoadingState label="Loading audit events…" /> : logs.error ? (
          <div className="grid gap-3"><FormError error={logs.error} /><Button variant="secondary" onClick={logs.refresh}>Retry</Button></div>
        ) : !logs.data?.rows.length ? <EmptyState title="No audit events match these filters" /> : (
          <>
            <div className="grid gap-3">
              {logs.data.rows.map((item) => (
                <article className="rounded-xl border border-slate-200 p-4" key={item.id}>
                  <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
                    <div>
                      <h2 className="font-semibold text-slate-950">{item.action} · {item.entity}</h2>
                      <p className="mt-1 text-sm text-slate-600">Actor: {item.actor?.email ?? item.actorId ?? "System"} · Entity ID: {item.entityId ?? "—"}</p>
                    </div>
                    <time className="text-xs text-slate-400">{new Date(item.createdAt).toLocaleString()}</time>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <details className="min-w-0 rounded-lg bg-slate-50 p-3">
                      <summary className="cursor-pointer text-sm font-semibold text-slate-700">Before JSON</summary>
                      <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap break-words text-xs text-slate-600">{printJson(item.before)}</pre>
                    </details>
                    <details className="min-w-0 rounded-lg bg-slate-50 p-3">
                      <summary className="cursor-pointer text-sm font-semibold text-slate-700">After JSON</summary>
                      <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap break-words text-xs text-slate-600">{printJson(item.after)}</pre>
                    </details>
                  </div>
                </article>
              ))}
            </div>
            <div className="mt-4 flex flex-col justify-between gap-3 text-sm sm:flex-row sm:items-center">
              <p className="text-slate-500">Page {filters.page} of {pages}</p>
              <div className="flex gap-2">
                <Button variant="secondary" disabled={filters.page <= 1} onClick={() => setFilters((current) => ({ ...current, page: current.page - 1 }))}>Previous</Button>
                <Button variant="secondary" disabled={filters.page >= pages} onClick={() => setFilters((current) => ({ ...current, page: current.page + 1 }))}>Next</Button>
              </div>
            </div>
          </>
        )}
      </Card>
    </>
  );
}
