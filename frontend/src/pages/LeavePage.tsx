import { useEffect, useState, type FormEvent } from "react";
import { api } from "../api/hcm";
import type { LeaveRequest, LeaveType } from "../api/types";
import { useAuth } from "../auth/AuthContext";
import { Button, Card, EmptyState, Field, FormError, LoadingState, PageHeading, SelectField, StatusPill, TextAreaField } from "../components/Feedback";
import { useResource } from "../hooks/useResource";

function currentYear() {
  return new Date().getFullYear();
}

function dateIsValid(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(new Date(`${value}T00:00:00`).getTime());
}

export function LeavePage() {
  const { session } = useAuth();
  const isEmployee = session?.user.role === "EMPLOYEE";
  const canReview = session?.user.role === "ADMIN" || session?.user.role === "HR";
  const leaveTypes = useResource(() => api.organization.leaveTypes.list());
  const requests = useResource(() => api.leave.requests({}), [isEmployee]);
  const balances = useResource(() => isEmployee ? api.leave.balanceMe(currentYear()) : Promise.resolve([]), [isEmployee]);
  const [form, setForm] = useState({ leaveTypeId: "", startDate: "", endDate: "", reason: "" });
  const [smartText, setSmartText] = useState("");
  const [smartPending, setSmartPending] = useState(false);
  const [smartMessage, setSmartMessage] = useState<string | null>(null);
  const [smartError, setSmartError] = useState<unknown>(null);
  const [applyError, setApplyError] = useState<unknown>(null);
  const [applySuccess, setApplySuccess] = useState<string | null>(null);
  const [applyPending, setApplyPending] = useState(false);
  const [actionError, setActionError] = useState<unknown>(null);
  const [actionPendingId, setActionPendingId] = useState<string | null>(null);
  const [comments, setComments] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!form.leaveTypeId && leaveTypes.data?.length) {
      setForm((current) => ({ ...current, leaveTypeId: leaveTypes.data?.[0].id ?? "" }));
    }
  }, [form.leaveTypeId, leaveTypes.data]);

  function updateForm<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function getSmartSuggestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSmartPending(true);
    setSmartError(null);
    setSmartMessage(null);
    try {
      const suggestion = await api.ai.smartLeave(smartText);
      if (suggestion.fallback) {
        setSmartMessage("The assistant could not format a reliable request. Use the normal leave form below.");
        return;
      }

      const typeText = suggestion.type.toLowerCase();
      const matchedType = (leaveTypes.data ?? []).find((item) => {
        const normalized = item.name.toLowerCase();
        return normalized === typeText || typeText.includes(normalized) || normalized.includes(typeText);
      });
      const nextStart = dateIsValid(suggestion.start) ? suggestion.start : "";
      const nextEnd = dateIsValid(suggestion.end) ? suggestion.end : "";
      setForm((current) => ({
        ...current,
        leaveTypeId: matchedType?.id ?? current.leaveTypeId,
        startDate: nextStart,
        endDate: nextEnd,
        reason: suggestion.reason || smartText,
      }));
      setSmartMessage(
        `${suggestion.aiGenerated ? "AI-generated suggestion. " : ""}Review the leave type and dates, edit as needed, then submit the form to save.`,
      );
      if (!matchedType) setSmartError(new Error(`Could not match suggested leave type "${suggestion.type}". Select the leave type manually.`));
      if (!nextStart || !nextEnd) setSmartError(new Error("The assistant did not return valid YYYY-MM-DD dates. Please enter the dates manually."));
    } catch (reason) {
      setSmartError(reason);
      setSmartMessage("Smart leave is unavailable. You can still use the normal leave form.");
    } finally {
      setSmartPending(false);
    }
  }

  async function submitLeave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setApplyPending(true);
    setApplyError(null);
    setApplySuccess(null);
    try {
      await api.leave.apply(form);
      setApplySuccess("Leave request submitted for review.");
      setForm((current) => ({ ...current, startDate: "", endDate: "", reason: "" }));
      requests.refresh();
      balances.refresh();
    } catch (reason) {
      setApplyError(reason);
    } finally {
      setApplyPending(false);
    }
  }

  async function cancelRequest(item: LeaveRequest) {
    if (!window.confirm("Cancel this leave request?")) return;
    setActionPendingId(item.id);
    setActionError(null);
    try {
      await api.leave.cancel(item.id);
      requests.refresh();
      balances.refresh();
    } catch (reason) {
      setActionError(reason);
    } finally {
      setActionPendingId(null);
    }
  }

  async function reviewRequest(item: LeaveRequest, decision: "approve" | "reject") {
    const comment = comments[item.id]?.trim() ?? "";
    if (!comment) {
      setActionError(new Error("Enter a review comment before approving or rejecting."));
      return;
    }
    setActionPendingId(item.id);
    setActionError(null);
    try {
      if (decision === "approve") await api.leave.approve(item.id, comment);
      else await api.leave.reject(item.id, comment);
      requests.refresh();
    } catch (reason) {
      setActionError(reason);
    } finally {
      setActionPendingId(null);
    }
  }

  return (
    <>
      <PageHeading title="Leave" description={isEmployee ? "Check your yearly balance, apply for leave, and review your request history." : "Review leave requests and their current status."} />
      {isEmployee ? (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(18rem,0.8fr)]">
          <div className="grid content-start gap-5">
            <Card title="Smart leave" subtitle="Describe the request in plain language. The assistant only prefills the form; it never submits or saves leave.">
              <FormError error={smartError} />
              {smartMessage ? <p className="mb-3 rounded-xl bg-teal-50 px-4 py-3 text-sm text-teal-900">{smartMessage}</p> : null}
              <form className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]" onSubmit={(event) => void getSmartSuggestion(event)}>
                <TextAreaField label="Describe your leave" value={smartText} onChange={(event) => setSmartText(event.target.value)} placeholder="I need next Monday and Tuesday off for a wedding" required minLength={3} maxLength={1000} />
                <div className="flex items-end"><Button disabled={smartPending || !leaveTypes.data?.length}>{smartPending ? "Preparing…" : "Suggest leave"}</Button></div>
              </form>
              <span className="mt-3 inline-block rounded-full bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-800">AI-generated suggestions must be reviewed</span>
            </Card>

            <Card title="Apply for leave">
              <FormError error={applyError} />
              {applySuccess ? <p className="mb-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{applySuccess}</p> : null}
              {leaveTypes.loading ? <LoadingState label="Loading leave types…" /> : leaveTypes.error ? <FormError error={leaveTypes.error} /> : (leaveTypes.data?.length ?? 0) === 0 ? (
                <EmptyState title="No leave types are configured">Ask an Admin to configure leave types before submitting a request.</EmptyState>
              ) : (
                <form className="grid gap-4 sm:grid-cols-2" onSubmit={(event) => void submitLeave(event)}>
                  <SelectField label="Leave type" value={form.leaveTypeId} onChange={(event) => updateForm("leaveTypeId", event.target.value)} required>
                    {(leaveTypes.data ?? []).map((item) => <option key={item.id} value={item.id}>{item.name} {item.yearlyQuota === null ? "(unlimited)" : `(${item.yearlyQuota} days/year)`}</option>)}
                  </SelectField>
                  <div className="hidden sm:block" />
                  <Field label="Start date" type="date" value={form.startDate} onChange={(event) => updateForm("startDate", event.target.value)} required />
                  <Field label="End date" type="date" value={form.endDate} onChange={(event) => updateForm("endDate", event.target.value)} required />
                  <TextAreaField className="sm:col-span-2" label="Reason" value={form.reason} onChange={(event) => updateForm("reason", event.target.value)} required minLength={5} maxLength={500} />
                  <div className="sm:col-span-2"><Button disabled={applyPending}>{applyPending ? "Submitting…" : "Submit leave request"}</Button></div>
                </form>
              )}
            </Card>
          </div>

          <Card title="My leave balance" subtitle={`Approved days used in ${currentYear()}`}>
            {balances.loading ? <LoadingState label="Loading balances…" /> : balances.error ? <FormError error={balances.error} /> : !balances.data?.length ? (
              <EmptyState title="No leave balances available" />
            ) : (
              <ul className="divide-y divide-slate-100">
                {balances.data.map((item) => (
                  <li key={item.leaveTypeId} className="flex items-center justify-between gap-3 py-4 first:pt-0">
                    <div><p className="font-semibold text-slate-900">{item.name}</p><p className="text-xs text-slate-500">{item.used} used · {item.quota === null ? "Unlimited" : `${item.quota} days`}</p></div>
                    <strong className="whitespace-nowrap text-lg text-teal-900">{item.remaining === null ? "∞" : item.remaining} <span className="text-xs font-normal text-slate-500">left</span></strong>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      ) : null}

      <Card className="mt-5" title={canReview ? "Leave requests inbox" : "My leave history"} subtitle={canReview ? "Approve or reject pending requests with a comment." : "Request decisions and comments are shown here."}>
        <FormError error={actionError} />
        {requests.loading ? <LoadingState label="Loading leave requests…" /> : requests.error ? (
          <div className="grid gap-3"><FormError error={requests.error} /><Button variant="secondary" onClick={requests.refresh}>Retry</Button></div>
        ) : !requests.data || requests.data.length === 0 ? <EmptyState title="No leave requests yet" /> : (
          <div className="grid gap-3">
            {requests.data.map((item) => (
              <LeaveRequestCard
                key={item.id}
                item={item}
                isEmployee={Boolean(isEmployee)}
                canReview={Boolean(canReview)}
                pending={actionPendingId === item.id}
                comment={comments[item.id] ?? ""}
                onComment={(value) => setComments((current) => ({ ...current, [item.id]: value }))}
                onCancel={() => void cancelRequest(item)}
                onReview={(decision) => void reviewRequest(item, decision)}
              />
            ))}
          </div>
        )}
      </Card>
    </>
  );
}

function LeaveRequestCard({
  item,
  isEmployee,
  canReview,
  pending,
  comment,
  onComment,
  onCancel,
  onReview,
}: {
  item: LeaveRequest;
  isEmployee: boolean;
  canReview: boolean;
  pending: boolean;
  comment: string;
  onComment: (value: string) => void;
  onCancel: () => void;
  onReview: (decision: "approve" | "reject") => void;
}) {
  return (
    <article className="rounded-xl border border-slate-200 p-4">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-slate-950">{item.leaveType.name}</h3>
            <StatusPill value={item.status} />
          </div>
          <p className="mt-1 text-sm text-slate-600">
            {item.employee ? `${item.employee.firstName} ${item.employee.lastName} · ` : ""}
            {item.startDate.slice(0, 10)} – {item.endDate.slice(0, 10)} · {Number(item.days)} working day(s)
          </p>
          <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{item.reason}</p>
          {item.comment ? <p className="mt-2 text-sm text-slate-500">Review: {item.comment}</p> : null}
        </div>
        {isEmployee && ["PENDING", "APPROVED"].includes(item.status) ? <Button variant="secondary" disabled={pending} onClick={onCancel}>Cancel request</Button> : null}
      </div>
      {canReview && item.status === "PENDING" ? (
        <div className="mt-4 grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <TextAreaField label="Review comment (required)" value={comment} onChange={(event) => onComment(event.target.value)} maxLength={500} />
          <div className="flex gap-2">
            <Button disabled={pending || !comment.trim()} onClick={() => onReview("approve")}>{pending ? "Saving…" : "Approve"}</Button>
            <Button variant="danger" disabled={pending || !comment.trim()} onClick={() => onReview("reject")}>Reject</Button>
          </div>
        </div>
      ) : null}
    </article>
  );
}
