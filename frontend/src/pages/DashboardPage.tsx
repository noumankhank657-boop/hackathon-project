import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api } from "../api/hcm";
import type { AdminDashboard as AdminDashboardData, EmployeeDashboard as EmployeeDashboardData, HrDashboard as HrDashboardData } from "../api/types";
import { useAuth } from "../auth/AuthContext";
import { Button, Card, EmptyState, ErrorAlert, Field, FormError, LoadingState, PageHeading, SelectField, StatusPill } from "../components/Feedback";
import { useResource } from "../hooks/useResource";
import { AiChatPanel } from "./AiAssistantPage";

const chartColors = ["#0f766e", "#f59e0b", "#8b5cf6", "#0284c7", "#e11d48", "#64748b"];

function todayString() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function currentRange() {
  const to = todayString();
  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - 30);
  const from = `${fromDate.getFullYear()}-${String(fromDate.getMonth() + 1).padStart(2, "0")}-${String(fromDate.getDate()).padStart(2, "0")}`;
  return { from, to };
}

function ytdRange() {
  const to = todayString();
  return { from: `${to.slice(0, 4)}-01-01`, to };
}

function DashboardMetric({ label, value, detail }: { label: string; value: string | number; detail?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-bold tracking-tight text-slate-950">{value}</p>
      {detail ? <p className="mt-1 text-xs text-slate-500">{detail}</p> : null}
    </div>
  );
}

function ChartEmpty({ title }: { title: string }) {
  return <EmptyState title={`No data for ${title.toLowerCase()}`} />;
}

export function DashboardPage() {
  const { session } = useAuth();
  if (!session) return null;
  if (session.user.role === "EMPLOYEE") return <EmployeeDashboard />;
  if (session.user.role === "ADMIN") return <AdminDashboard />;
  return <HrDashboard />;
}

function DashboardFilters({
  from,
  to,
  departmentId,
  departments,
  onFrom,
  onTo,
  onDepartment,
}: {
  from: string;
  to: string;
  departmentId: string;
  departments: Array<{ id: string; name: string }>;
  onFrom: (value: string) => void;
  onTo: (value: string) => void;
  onDepartment: (value: string) => void;
}) {
  return (
    <Card title="Dashboard filters" subtitle="All KPI values and charts are returned from server-side aggregations.">
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="From" type="date" required value={from} onChange={(event) => { if (event.target.value) onFrom(event.target.value); }} />
        <Field label="To" type="date" required value={to} onChange={(event) => { if (event.target.value) onTo(event.target.value); }} />
        <SelectField label="Department" value={departmentId} onChange={(event) => onDepartment(event.target.value)}>
          <option value="">All departments</option>
          {departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
        </SelectField>
      </div>
    </Card>
  );
}

function DashboardSummary({ kpis, context, disabled = false }: { kpis: Record<string, unknown>; context: string; disabled?: boolean }) {
  const [summary, setSummary] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);

  async function summarize() {
    setLoading(true);
    setError(null);
    setSummary(null);
    try {
      const result = await api.ai.summarize(kpis, context);
      setSummary(result.text);
    } catch (reason) {
      setError(reason);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card title="AI dashboard summary" subtitle="The assistant summarizes only the KPI values shown here." actions={<Button variant="secondary" disabled={loading || disabled} onClick={() => void summarize()}>{loading ? "Summarizing…" : "Summarize"}</Button>}>
      <FormError error={error} />
      {summary ? <><span className="mb-3 inline-flex rounded-full bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-800">AI-generated</span><p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">{summary}</p></> : <p className="text-sm text-slate-500">Request a brief summary of the current dashboard filters.</p>}
    </Card>
  );
}

function HrDashboard() {
  const defaults = useMemo(currentRange, []);
  const [from, setFrom] = useState(defaults.from);
  const [to, setTo] = useState(defaults.to);
  const [departmentId, setDepartmentId] = useState("");
  const departments = useResource(() => api.organization.departments.list());
  const dashboard = useResource(
    () => api.analytics.hrDashboard({ from, to, departmentId: departmentId || undefined }),
    [from, to, departmentId],
  );
  const announcements = useResource(() => api.comms.announcements());

  return (
    <>
      <PageHeading title="HR dashboard" description="People operations overview from current company records." actions={<Link className="button button-secondary" to="/assistant">Ask the assistant</Link>} />
      {departments.error ? <FormError error={departments.error} /> : null}
      <DashboardFilters
        from={from}
        to={to}
        departmentId={departmentId}
        departments={departments.data ?? []}
        onFrom={(value) => { setFrom(value); if (value > to) setTo(value); }}
        onTo={(value) => { setTo(value); if (value < from) setFrom(value); }}
        onDepartment={setDepartmentId}
      />
      {dashboard.loading ? <LoadingState label="Loading HR analytics…" /> : dashboard.error ? (
        <div className="mt-4 grid gap-3"><FormError error={dashboard.error} /><Button variant="secondary" onClick={dashboard.refresh}>Retry</Button></div>
      ) : !dashboard.data ? <EmptyState title="HR analytics are unavailable" /> : (
        <HrDashboardView data={dashboard.data} from={from} to={to} />
      )}
      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <DashboardSummary
          kpis={dashboard.data ? { ...dashboard.data.kpis } : {}}
          context={`HR dashboard from ${from} to ${to}${departmentId ? `, department ${departmentId}` : ""}`}
          disabled={!dashboard.data}
        />
        <AnnouncementsCard announcements={announcements.data ?? []} loading={announcements.loading} error={announcements.error} />
      </div>
    </>
  );
}

function HrDashboardView({ data, from, to }: { data: HrDashboardData; from: string; to: string }) {
  const trend = data.attendanceTrend;
  return (
    <div className="mt-5 grid gap-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        <DashboardMetric label="Headcount" value={data.kpis.headcount} />
        <DashboardMetric label="Present in period" value={data.kpis.present} detail={`${from} to ${to}`} />
        <DashboardMetric label="On leave today" value={data.kpis.onLeaveToday} />
        <DashboardMetric label="Late today" value={data.kpis.lateToday} />
        <DashboardMetric label="Pending leave" value={data.kpis.pendingLeave} />
        <DashboardMetric label="Pending corrections" value={data.kpis.pendingCorrections} />
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
        <Card title="Attendance trend" subtitle="Daily attendance statuses from the server.">
          {trend.length === 0 ? <ChartEmpty title="attendance trend" /> : (
            <div className="h-72 min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trend} margin={{ top: 10, right: 16, left: -16, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="present" stroke={chartColors[0]} strokeWidth={2} />
                  <Line type="monotone" dataKey="late" stroke={chartColors[1]} strokeWidth={2} />
                  <Line type="monotone" dataKey="halfDay" name="Half day" stroke={chartColors[2]} strokeWidth={2} />
                  <Line type="monotone" dataKey="missingCheckout" name="Missing checkout" stroke={chartColors[3]} strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
        <Card title="Absenteeism by department">
          {data.absenteeismByDept.length === 0 ? <ChartEmpty title="absenteeism" /> : (
            <div className="h-72 min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.absenteeismByDept} layout="vertical" margin={{ top: 8, right: 20, left: 16, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis type="number" unit="%" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="department" width={100} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(value) => [`${Number(value).toFixed(1)}%`, "Absenteeism"]} />
                  <Bar dataKey="absenteeismPercent" fill={chartColors[0]} radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
        <Card title="Leave by type" subtitle="Approved leave days in the selected date range.">
          {data.leaveByType.length === 0 ? <ChartEmpty title="leave" /> : (
            <div className="h-72 min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={data.leaveByType} dataKey="days" nameKey="name" cx="50%" cy="50%" outerRadius="72%" label>
                    {data.leaveByType.map((item, index) => <Cell key={item.name} fill={chartColors[index % chartColors.length]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
        <Card title="Late percentage by department">
          {data.lateByDept.length === 0 ? <ChartEmpty title="late percentage" /> : (
            <div className="h-72 min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.lateByDept} margin={{ top: 8, right: 12, left: -12, bottom: 36 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="department" angle={-25} textAnchor="end" interval={0} tick={{ fontSize: 10 }} />
                  <YAxis unit="%" tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(value) => [`${Number(value).toFixed(1)}%`, "Late"]} />
                  <Bar dataKey="latePercent" fill={chartColors[1]} radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
      </div>
      <Card title="Top late-comers" subtitle="Most late attendance records within the selected range.">
        {data.topLateComers.length === 0 ? <ChartEmpty title="late-comers" /> : (
          <div className="table-wrap">
            <table className="table"><thead><tr><th>Employee</th><th>Late records</th></tr></thead><tbody>{data.topLateComers.map((item) => <tr key={item.employeeId}><td>{item.name}</td><td>{item.lateCount}</td></tr>)}</tbody></table>
          </div>
        )}
      </Card>
    </div>
  );
}

function AdminDashboard() {
  const defaults = useMemo(ytdRange, []);
  const [from, setFrom] = useState(defaults.from);
  const [to, setTo] = useState(defaults.to);
  const [departmentId, setDepartmentId] = useState("");
  const departments = useResource(() => api.organization.departments.list());
  const dashboard = useResource(
    () => api.analytics.adminDashboard({ from, to, departmentId: departmentId || undefined }),
    [from, to, departmentId],
  );
  const announcements = useResource(() => api.comms.announcements());

  return (
    <>
      <PageHeading title="Admin dashboard" description="Company-level headcount, payroll, and audit activity." actions={<Link className="button button-secondary" to="/assistant">Ask the assistant</Link>} />
      {departments.error ? <FormError error={departments.error} /> : null}
      <DashboardFilters
        from={from}
        to={to}
        departmentId={departmentId}
        departments={departments.data ?? []}
        onFrom={(value) => { setFrom(value); if (value > to) setTo(value); }}
        onTo={(value) => { setTo(value); if (value < from) setFrom(value); }}
        onDepartment={setDepartmentId}
      />
      {dashboard.loading ? <LoadingState label="Loading Admin analytics…" /> : dashboard.error ? (
        <div className="mt-4 grid gap-3"><FormError error={dashboard.error} /><Button variant="secondary" onClick={dashboard.refresh}>Retry</Button></div>
      ) : !dashboard.data ? <EmptyState title="Admin analytics are unavailable" /> : <AdminDashboardView data={dashboard.data} />}
      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <DashboardSummary
          kpis={dashboard.data ? { ...dashboard.data.kpis } : {}}
          context={`Admin dashboard from ${from} to ${to}${departmentId ? `, department ${departmentId}` : ""}`}
          disabled={!dashboard.data}
        />
        <AnnouncementsCard announcements={announcements.data ?? []} loading={announcements.loading} error={announcements.error} />
      </div>
    </>
  );
}

function AdminDashboardView({ data }: { data: AdminDashboardData }) {
  return (
    <div className="mt-5 grid gap-5">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <DashboardMetric label="Headcount" value={data.kpis.headcount} />
        <DashboardMetric label="Attrition in period" value={`${data.kpis.attrition.toFixed(1)}%`} />
        <DashboardMetric label="Payroll cost" value={data.kpis.payrollCost.toLocaleString(undefined, { style: "currency", currency: "PKR" })} />
        <DashboardMetric label="Average gross salary" value={data.kpis.averageSalary.toLocaleString(undefined, { style: "currency", currency: "PKR" })} />
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
        <Card title="Headcount by department">
          {data.headcountByDepartment.length === 0 ? <ChartEmpty title="headcount" /> : (
            <div className="h-72 min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.headcountByDepartment} margin={{ top: 8, right: 12, left: -12, bottom: 36 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="department" angle={-25} textAnchor="end" interval={0} tick={{ fontSize: 10 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="count" name="Employees" fill={chartColors[0]} radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
        <Card title="Payroll cost by department" subtitle="Net payroll in the selected period.">
          {data.payrollCostByDepartment.length === 0 ? <ChartEmpty title="payroll cost" /> : (
            <div className="h-72 min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.payrollCostByDepartment} layout="vertical" margin={{ top: 8, right: 20, left: 16, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="department" width={100} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(value) => [Number(value).toLocaleString(undefined, { style: "currency", currency: "PKR" }), "Net payroll"]} />
                  <Bar dataKey="net" fill={chartColors[2]} radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
      </div>
      <Card title="Gender and tenure" subtitle="These dimensions require profile fields from the employee records.">
        <EmptyState title="No gender or tenure analytics are available">
          {data.genderTenure.note ?? "The server has not returned demographic or tenure aggregates."}
        </EmptyState>
      </Card>
      <Card title="Recent audit activity">
        {data.auditFeed.length === 0 ? <ChartEmpty title="audit activity" /> : (
          <div className="table-wrap">
            <table className="table"><thead><tr><th>Time</th><th>Actor</th><th>Action</th><th>Entity</th></tr></thead><tbody>{data.auditFeed.map((item) => <tr key={item.id}><td>{new Date(item.createdAt).toLocaleString()}</td><td>{item.actor}</td><td>{item.action}</td><td>{item.entity}</td></tr>)}</tbody></table>
          </div>
        )}
      </Card>
    </div>
  );
}

function EmployeeDashboard() {
  const dashboard = useResource(() => api.analytics.employeeDashboard());
  const [checkinError, setCheckinError] = useState<unknown>(null);
  const [checkinPending, setCheckinPending] = useState(false);

  async function checkIn() {
    setCheckinPending(true);
    setCheckinError(null);
    try {
      await api.attendance.checkIn({ source: "WEB" });
      dashboard.refresh();
    } catch (reason) {
      setCheckinError(reason);
    } finally {
      setCheckinPending(false);
    }
  }

  async function checkOut() {
    setCheckinPending(true);
    setCheckinError(null);
    try {
      await api.attendance.checkOut({ source: "WEB" });
      dashboard.refresh();
    } catch (reason) {
      setCheckinError(reason);
    } finally {
      setCheckinPending(false);
    }
  }

  return (
    <>
      <PageHeading title="My dashboard" description="Personal attendance, leave, payslip, announcements, and assistant shortcuts." actions={<Link className="button button-secondary" to="/assistant">Ask my assistant</Link>} />
      {dashboard.loading ? <LoadingState label="Loading your dashboard…" /> : dashboard.error ? (
        <div className="grid gap-3"><FormError error={dashboard.error} /><Button variant="secondary" onClick={dashboard.refresh}>Retry</Button></div>
      ) : !dashboard.data ? <EmptyState title="Personal dashboard is unavailable" /> : <EmployeeDashboardView data={dashboard.data} />}
      <FormError error={checkinError} />
      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <AiChatPanel compact />
        <AnnouncementsCard announcements={dashboard.data?.announcements ?? []} loading={dashboard.loading} error={dashboard.error} />
      </div>
      {dashboard.data ? (
        <Card className="mt-5" title="Quick attendance" subtitle="Check-in and check-out use server time.">
          {dashboard.data.checkInState ? (
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div><p className="text-sm text-slate-600">Today’s status</p><StatusPill value={dashboard.data.checkInState.status} /></div>
              {dashboard.data.checkInState.checkIn && !dashboard.data.checkInState.checkOut ? <Button disabled={checkinPending} onClick={() => void checkOut()}>{checkinPending ? "Checking out…" : "Check out"}</Button> : <Link className="button button-secondary" to="/attendance">View attendance</Link>}
            </div>
          ) : (
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <p className="text-sm text-slate-600">No check-in recorded today.</p>
              <div className="flex flex-wrap gap-2"><Button disabled={checkinPending} onClick={() => void checkIn()}>{checkinPending ? "Checking in…" : "Check in"}</Button><Link to="/face/check-in" className="button button-secondary">Camera check-in</Link></div>
            </div>
          )}
        </Card>
      ) : null}
    </>
  );
}

function EmployeeDashboardView({ data }: { data: EmployeeDashboardData }) {
  const hoursData = [
    { name: "This week", hours: data.weeklyHours },
    { name: "Target", hours: data.weeklyTarget },
  ];
  return (
    <div className="grid gap-5">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <DashboardMetric label="Hours this week" value={`${data.weeklyHours.toFixed(1)} h`} detail={`Target ${data.weeklyTarget} h`} />
        <DashboardMetric label="Late this month" value={data.lateCount} />
        <DashboardMetric label="Leave types" value={data.leaveBalances.length} detail="Balances shown below" />
        <DashboardMetric label="Last payslip" value={data.lastPayslip ? `${Number(data.lastPayslip.net).toLocaleString()} PKR` : "—"} detail={data.lastPayslip ? "Finalized run" : "No finalized payslip"} />
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
        <Card title="Weekly hours" subtitle="Actual hours are returned from the personal dashboard service.">
          <div className="h-64 min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hoursData} margin={{ top: 8, right: 12, left: -12, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" />
                <YAxis unit=" h" />
                <Tooltip formatter={(value) => [`${Number(value).toFixed(1)} h`, "Hours"]} />
                <Bar dataKey="hours" fill={chartColors[0]} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card title="Leave balance">
          {data.leaveBalances.length === 0 ? <EmptyState title="No leave balances configured" /> : (
            <ul className="divide-y divide-slate-100">
              {data.leaveBalances.map((balance) => (
                <li key={balance.leaveTypeId} className="flex items-center justify-between gap-3 py-3 first:pt-0">
                  <div><p className="font-semibold">{balance.name}</p><p className="text-xs text-slate-500">{balance.used} used of {balance.quota ?? "unlimited"}</p></div>
                  <strong className="text-teal-900">{balance.remaining ?? "∞"} left</strong>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
      <Card title="Latest payslip" subtitle="Download is enabled after Admin finalizes payroll.">
        {data.lastPayslip ? (
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div><p className="font-semibold text-slate-900">Net pay {Number(data.lastPayslip.net).toLocaleString(undefined, { style: "currency", currency: "PKR" })}</p><p className="text-xs text-slate-500">Gross {Number(data.lastPayslip.gross).toLocaleString(undefined, { style: "currency", currency: "PKR" })}</p></div>
            <Link to="/payroll" className="button button-secondary">Open payslips</Link>
          </div>
        ) : <EmptyState title="No payslip is available yet">A finalized payroll run will appear here.</EmptyState>}
      </Card>
    </div>
  );
}

function AnnouncementsCard({
  announcements,
  loading,
  error,
}: {
  announcements: Array<{ id: string; title: string; body: string; createdAt: string }>;
  loading: boolean;
  error: unknown;
}) {
  return (
    <Card title="Announcements" subtitle="Company updates">
      {loading ? <LoadingState label="Loading announcements…" /> : error ? <FormError error={error} /> : announcements.length === 0 ? (
        <EmptyState title="No announcements yet" />
      ) : (
        <ul className="divide-y divide-slate-100">
          {announcements.slice(0, 6).map((item) => (
            <li className="py-3 first:pt-0 last:pb-0" key={item.id}>
              <h3 className="font-semibold text-slate-900">{item.title}</h3>
              <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">{item.body}</p>
              <time className="mt-2 block text-xs text-slate-400">{new Date(item.createdAt).toLocaleString()}</time>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
