import { useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/hcm";
import type { Attendance, AttendanceStatus } from "../api/types";
import { useAuth } from "../auth/AuthContext";
import { Button, Card, EmptyState, Field, FormError, LoadingState, PageHeading, SelectField, StatusPill, TextAreaField } from "../components/Feedback";
import { useResource } from "../hooks/useResource";

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function dateRange(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  const finalDay = new Date(year, monthNumber, 0).getDate();
  return { from: `${month}-01`, to: `${month}-${String(finalDay).padStart(2, "0")}`, year, monthNumber, finalDay };
}

function dateStamp(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatTime(value: string | null) {
  return value ? new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—";
}

const statusColors: Record<AttendanceStatus, string> = {
  PRESENT: "bg-emerald-50 text-emerald-800",
  LATE: "bg-amber-50 text-amber-800",
  HALF_DAY: "bg-orange-50 text-orange-800",
  MISSING_CHECKOUT: "bg-amber-50 text-amber-800",
  ABSENT: "bg-rose-50 text-rose-800",
  ON_LEAVE: "bg-sky-50 text-sky-800",
};

export function AttendancePage() {
  const { session } = useAuth();
  const isEmployee = session?.user.role === "EMPLOYEE";
  const [month, setMonth] = useState(currentMonth);
  const [employeeId, setEmployeeId] = useState(session?.user.employeeId ?? "");
  const range = useMemo(() => dateRange(month), [month]);
  const employees = useResource(() => api.employees.list({ page: 1, pageSize: 100 }), [isEmployee]);
  const calendar = useResource(
    () => api.attendance.calendar({ from: range.from, to: range.to, employeeId: isEmployee ? undefined : employeeId || undefined }),
    [range.from, range.to, employeeId, isEmployee],
  );
  const today = dateStamp(new Date());
  const todayAttendance = useResource(
    () => isEmployee ? api.attendance.calendar({ from: today, to: today }) : Promise.resolve([] as Attendance[]),
    [today, isEmployee],
  );
  const todayRecord = todayAttendance.data?.find((item) => item.date.slice(0, 10) === today);
  const [actionError, setActionError] = useState<unknown>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionPending, setActionPending] = useState(false);
  const [correctionPending, setCorrectionPending] = useState(false);
  const [correctionMessage, setCorrectionMessage] = useState<string | null>(null);
  const [correctionError, setCorrectionError] = useState<unknown>(null);

  async function performCheckIn() {
    setActionPending(true);
    setActionError(null);
    setActionMessage(null);
    try {
      const result = await api.attendance.checkIn({ source: "WEB" });
      setActionMessage(`Checked in successfully. Server status: ${result.status.toLowerCase().replaceAll("_", " ")}.`);
      calendar.refresh();
      todayAttendance.refresh();
    } catch (reason) {
      setActionError(reason);
    } finally {
      setActionPending(false);
    }
  }

  async function performCheckOut() {
    setActionPending(true);
    setActionError(null);
    setActionMessage(null);
    try {
      const result = await api.attendance.checkOut({ source: "WEB" });
      setActionMessage(`Checked out successfully. Server status: ${result.status.toLowerCase().replaceAll("_", " ")}.`);
      calendar.refresh();
      todayAttendance.refresh();
    } catch (reason) {
      setActionError(reason);
    } finally {
      setActionPending(false);
    }
  }

  async function requestCorrection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setCorrectionPending(true);
    setCorrectionError(null);
    setCorrectionMessage(null);
    try {
      const date = String(form.get("date"));
      const checkInTime = String(form.get("checkIn") ?? "");
      const checkOutTime = String(form.get("checkOut") ?? "");
      const checkIn = checkInTime ? new Date(`${date}T${checkInTime}`).toISOString() : undefined;
      const checkOut = checkOutTime ? new Date(`${date}T${checkOutTime}`).toISOString() : undefined;
      await api.attendance.requestCorrection({
        date,
        checkIn,
        checkOut,
        reason: String(form.get("reason")),
      });
      formElement.reset();
      setCorrectionMessage("Correction request submitted to HR.");
    } catch (reason) {
      setCorrectionError(reason);
    } finally {
      setCorrectionPending(false);
    }
  }

  const days = Array.from({ length: range.finalDay }, (_, index) => index + 1);
  const firstOffset = new Date(range.year, range.monthNumber - 1, 1).getDay();
  const recordsByDate = new Map((calendar.data ?? []).map((record) => [record.date.slice(0, 10), record]));

  return (
    <>
      <PageHeading
        title="Attendance"
        description={isEmployee ? "Check in and out using server time, review your attendance calendar, or request a correction." : "Review attendance for an employee by month."}
        actions={!isEmployee ? <Link to="/attendance/board" className="button button-secondary">Daily attendance board</Link> : <Link to="/face/check-in" className="button button-secondary">Camera check-in</Link>}
      />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(18rem,0.7fr)]">
        <Card title="Attendance calendar" subtitle="Dates and statuses are loaded from the attendance service.">
          <div className="mb-4 grid gap-3 sm:grid-cols-2">
            <Field label="Month" type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
            {!isEmployee ? (
              <SelectField label="Employee" value={employeeId} onChange={(event) => setEmployeeId(event.target.value)}>
                <option value="">Choose employee</option>
                {(employees.data?.rows ?? []).map((employee) => <option key={employee.id} value={employee.id}>{employee.firstName} {employee.lastName} · {employee.employeeCode}</option>)}
              </SelectField>
            ) : null}
          </div>
          {!isEmployee && employees.error ? <FormError error={employees.error} /> : null}
          {calendar.loading ? <LoadingState label="Loading attendance calendar…" /> : calendar.error ? (
            <div className="grid gap-3"><FormError error={calendar.error} /><Button variant="secondary" onClick={calendar.refresh}>Retry</Button></div>
          ) : !isEmployee && !employeeId ? (
            <EmptyState title="Choose an employee">Select an employee to view their attendance calendar.</EmptyState>
          ) : (
            <>
              <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-slate-500">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => <div key={day} className="py-2">{day}</div>)}
                {Array.from({ length: firstOffset }, (_, index) => <div key={`blank-${index}`} aria-hidden="true" />)}
                {days.map((day) => {
                  const date = `${month}-${String(day).padStart(2, "0")}`;
                  const record = recordsByDate.get(date);
                  return (
                    <div key={date} className={`min-h-20 rounded-lg border p-1.5 text-left ${record ? "border-slate-200 bg-white" : "border-slate-100 bg-slate-50"}`}>
                      <span className="text-xs font-semibold text-slate-600">{day}</span>
                      {record ? (
                        <div className={`mt-1 rounded px-1 py-1 text-[0.65rem] font-semibold leading-tight ${statusColors[record.status]}`}>
                          {record.status.replaceAll("_", " ")}
                        </div>
                      ) : (
                        <span className="mt-1 block text-[0.6rem] leading-tight text-slate-400">No record</span>
                      )}
                    </div>
                  );
                })}
              </div>
              {calendar.data?.length === 0 ? <p className="mt-4 text-sm text-slate-500">No attendance or approved leave records are available for this month.</p> : null}
            </>
          )}
        </Card>
        {isEmployee ? (
          <div className="grid content-start gap-5">
            <Card title="Today’s attendance" subtitle="The server stamps check-in and check-out time.">
              <FormError error={actionError} />
              {todayAttendance.error ? <FormError error={todayAttendance.error} /> : null}
              {actionMessage ? <p className="mb-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{actionMessage}</p> : null}
              {todayAttendance.loading ? <LoadingState label="Checking today’s attendance…" /> : todayAttendance.error ? (
                <Button variant="secondary" onClick={todayAttendance.refresh}>Retry</Button>
              ) : todayRecord ? (
                <div className="grid gap-3">
                  <div className="flex items-center justify-between"><span className="text-sm text-slate-600">Status</span><StatusPill value={todayRecord.status} /></div>
                  <div className="flex justify-between text-sm"><span className="text-slate-500">Checked in</span><strong>{formatTime(todayRecord.checkIn)}</strong></div>
                  <div className="flex justify-between text-sm"><span className="text-slate-500">Checked out</span><strong>{formatTime(todayRecord.checkOut)}</strong></div>
                  {todayRecord.checkIn && !todayRecord.checkOut ? <Button disabled={actionPending} onClick={() => void performCheckOut()}>{actionPending ? "Checking out…" : "Check out"}</Button> : null}
                </div>
              ) : (
                <div className="grid gap-3">
                  <EmptyState title="You have not checked in today" />
                  <Button disabled={actionPending || todayAttendance.loading} onClick={() => void performCheckIn()}>{actionPending ? "Checking in…" : "Check in"}</Button>
                </div>
              )}
              <Link className="mt-3 inline-block text-sm font-semibold text-teal-800 hover:underline" to="/face/check-in">Use camera check-in</Link>
            </Card>
            <Card title="Request an attendance correction" subtitle="If check-in failed or your record is missing, explain it to HR.">
              <FormError error={correctionError} />
              {correctionMessage ? <p className="mb-3 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{correctionMessage}</p> : null}
              <form className="grid gap-3" onSubmit={(event) => void requestCorrection(event)}>
                <Field label="Date" name="date" type="date" required />
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Check-in (optional)" name="checkIn" type="time" />
                  <Field label="Check-out (optional)" name="checkOut" type="time" />
                </div>
                <TextAreaField label="Reason" name="reason" required minLength={5} maxLength={500} />
                <Button disabled={correctionPending}>{correctionPending ? "Submitting…" : "Submit correction request"}</Button>
              </form>
            </Card>
          </div>
        ) : null}
      </div>
      {calendar.data?.length ? (
        <Card className="mt-5" title="Attendance records" subtitle={`${calendar.data.length} record(s) in the selected month`}>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Date</th><th>Check-in</th><th>Check-out</th><th>Status</th><th>Source</th></tr></thead>
              <tbody>{calendar.data.map((item) => <tr key={item.id}><td>{item.date.slice(0, 10)}</td><td>{formatTime(item.checkIn)}</td><td>{formatTime(item.checkOut)}</td><td><StatusPill value={item.status} /></td><td>{item.source}</td></tr>)}</tbody>
            </table>
          </div>
        </Card>
      ) : null}
    </>
  );
}

export function AttendanceBoardPage() {
  const [date, setDate] = useState(dateStamp(new Date()));
  const board = useResource(() => api.attendance.board(date), [date]);
  return (
    <>
      <PageHeading title="Daily attendance board" description="Attendance records for the selected day. An empty board means no attendance records have been submitted for that date." />
      <Card title="Daily board">
        <div className="mb-4 max-w-xs"><Field label="Date" type="date" value={date} onChange={(event) => setDate(event.target.value)} /></div>
        {board.loading ? <LoadingState label="Loading daily attendance…" /> : board.error ? (
          <div className="grid gap-3"><FormError error={board.error} /><Button variant="secondary" onClick={board.refresh}>Retry</Button></div>
        ) : !board.data || board.data.length === 0 ? <EmptyState title="No attendance records for this date" /> : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Employee</th><th>Department</th><th>Check-in</th><th>Check-out</th><th>Status</th><th>Source</th></tr></thead>
              <tbody>
                {board.data.map((item) => <tr key={item.id}>
                  <td><span className="font-semibold">{item.employee?.firstName} {item.employee?.lastName}</span><br /><span className="text-xs text-slate-500">{item.employee?.user?.email}</span></td>
                  <td>{item.employee?.department?.name ?? "Unassigned"}</td>
                  <td>{formatTime(item.checkIn)}</td>
                  <td>{formatTime(item.checkOut)}</td>
                  <td><StatusPill value={item.status} /></td>
                  <td>{item.source}</td>
                </tr>)}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
