import { useState } from "react";
import { api } from "../api/hcm";
import type { AttendanceCorrection } from "../api/types";
import { Button, Card, EmptyState, FormError, LoadingState, PageHeading, SelectField, StatusPill, TextAreaField } from "../components/Feedback";
import { useResource } from "../hooks/useResource";

export function AttendanceCorrectionsPage() {
  const [status, setStatus] = useState<"PENDING" | "APPROVED" | "REJECTED" | "">("PENDING");
  const corrections = useResource(() => api.attendance.corrections(status || undefined), [status]);
  const [comments, setComments] = useState<Record<string, string>>({});
  const [error, setError] = useState<unknown>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  async function decide(item: AttendanceCorrection, decision: "approve" | "reject") {
    const comment = comments[item.id]?.trim() ?? "";
    if (!comment) {
      setError(new Error("Enter a comment before approving or rejecting."));
      return;
    }
    setError(null);
    setPendingId(item.id);
    try {
      if (decision === "approve") {
        await api.attendance.approveCorrection(item.id, { comment });
      } else {
        await api.attendance.rejectCorrection(item.id, comment);
      }
      corrections.refresh();
    } catch (reason) {
      setError(reason);
    } finally {
      setPendingId(null);
    }
  }

  return (
    <>
      <PageHeading title="Attendance corrections" description="Review employee requests and record a decision comment." />
      <Card title="Correction requests">
        <FormError error={error} />
        <div className="mb-4 max-w-xs">
          <SelectField label="Request status" value={status} onChange={(event) => setStatus(event.target.value as typeof status)}>
            <option value="">All requests</option>
            <option value="PENDING">Pending</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
          </SelectField>
        </div>
        {corrections.loading ? <LoadingState label="Loading correction requests…" /> : corrections.error ? (
          <div className="grid gap-3"><FormError error={corrections.error} /><Button variant="secondary" onClick={corrections.refresh}>Retry</Button></div>
        ) : !corrections.data?.length ? <EmptyState title="No correction requests" /> : (
          <div className="grid gap-3">
            {corrections.data.map((item) => (
              <CorrectionCard
                key={item.id}
                item={item}
                comment={comments[item.id] ?? ""}
                onComment={(value) => setComments((current) => ({ ...current, [item.id]: value }))}
                onDecision={(decision) => void decide(item, decision)}
                pending={pendingId === item.id}
              />
            ))}
          </div>
        )}
      </Card>
    </>
  );
}

function CorrectionCard({
  item,
  comment,
  onComment,
  onDecision,
  pending,
}: {
  item: AttendanceCorrection;
  comment: string;
  onComment: (value: string) => void;
  onDecision: (decision: "approve" | "reject") => void;
  pending: boolean;
}) {
  return (
    <article className="rounded-xl border border-slate-200 p-4">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-slate-900">{item.employee?.firstName} {item.employee?.lastName}</h3>
            <StatusPill value={item.status} />
          </div>
          <p className="mt-1 text-sm text-slate-500">{item.employee?.user?.email} · {item.date.slice(0, 10)}</p>
          <p className="mt-3 text-sm text-slate-700">{item.reason}</p>
          <p className="mt-2 text-xs text-slate-500">
            Requested: in {item.checkIn ? new Date(item.checkIn).toLocaleString() : "—"} · out {item.checkOut ? new Date(item.checkOut).toLocaleString() : "—"}
          </p>
          {item.comment ? <p className="mt-2 text-sm text-slate-500">Decision comment: {item.comment}</p> : null}
        </div>
      </div>
      {item.status === "PENDING" ? (
        <div className="mt-4 grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <TextAreaField label="Decision comment (required)" value={comment} onChange={(event) => onComment(event.target.value)} maxLength={500} />
          <div className="flex gap-2">
            <Button disabled={pending || !comment.trim()} onClick={() => onDecision("approve")}>{pending ? "Saving…" : "Approve"}</Button>
            <Button variant="danger" disabled={pending || !comment.trim()} onClick={() => onDecision("reject")}>Reject</Button>
          </div>
        </div>
      ) : null}
    </article>
  );
}
