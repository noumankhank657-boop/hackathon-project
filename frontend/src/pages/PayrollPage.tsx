import { useEffect, useState } from "react";
import { api } from "../api/hcm";
import type { Employee, PayrollRun, Payslip } from "../api/types";
import { useAuth } from "../auth/AuthContext";
import { Button, Card, EmptyState, Field, FormError, LoadingState, PageHeading, StatusPill } from "../components/Feedback";
import { useResource } from "../hooks/useResource";

function currentMonthValue() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function money(value: string | number) {
  return Number(value).toLocaleString(undefined, { style: "currency", currency: "PKR", maximumFractionDigits: 2 });
}

export function PayrollPage() {
  const { session } = useAuth();
  const role = session?.user.role;
  const isEmployee = role === "EMPLOYEE";
  const isHr = role === "HR";
  const isAdmin = role === "ADMIN";
  const runs = useResource(() => api.payroll.runs());
  const [month, setMonth] = useState(currentMonthValue);
  const [selectedRunId, setSelectedRunId] = useState("");
  const [error, setError] = useState<unknown>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [downloadError, setDownloadError] = useState<unknown>(null);
  const employees = useResource(() => isHr ? api.employees.list({ page: 1, pageSize: 100 }) : Promise.resolve(null), [isHr]);

  useEffect(() => {
    if (!runs.data?.length) return;
    const visibleRuns = isEmployee ? runs.data.filter((item) => item.status === "FINALIZED") : runs.data;
    if (visibleRuns.length && !visibleRuns.some((item) => item.id === selectedRunId)) {
      setSelectedRunId(visibleRuns[0].id);
    }
  }, [runs.data, selectedRunId, isEmployee]);

  const visibleRuns = isEmployee ? (runs.data ?? []).filter((item) => item.status === "FINALIZED") : runs.data ?? [];
  const selectedRun = visibleRuns.find((item) => item.id === selectedRunId) ?? null;
  const payslips = useResource<Payslip[]>(
    () => selectedRunId ? api.payroll.payslips(selectedRunId) : Promise.resolve([]),
    [selectedRunId],
  );

  async function createDraft() {
    const [year, monthNumber] = month.split("-").map(Number);
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      const result = await api.payroll.createDraft(monthNumber, year);
      setSelectedRunId(result.id);
      setMessage(`Payroll draft for ${month} is ready to review.`);
      runs.refresh();
      payslips.refresh();
    } catch (reason) {
      setError(reason);
    } finally {
      setPending(false);
    }
  }

  async function finalizeRun(run: PayrollRun) {
    if (!window.confirm(`Finalize payroll for ${run.month}/${run.year}? This locks the run.`)) return;
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      await api.payroll.finalize(run.id);
      setMessage("Payroll finalized and locked. Employees can now access their payslips.");
      runs.refresh();
      payslips.refresh();
    } catch (reason) {
      setError(reason);
    } finally {
      setPending(false);
    }
  }

  async function downloadPayslip(id: string) {
    setDownloadError(null);
    try {
      await api.payroll.downloadPayslip(id);
    } catch (reason) {
      setDownloadError(reason);
    }
  }

  return (
    <>
      <PageHeading title="Payroll" description={isEmployee ? "View and download your finalized payslips." : "Prepare monthly payroll drafts, review amounts, and let Admin finalize the locked run."} />
      <FormError error={error} />
      {message ? <p className="mt-3 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{message}</p> : null}
      {isHr ? (
        <SalaryStructure employees={employees.data?.rows ?? []} loading={employees.loading} error={employees.error} onSaved={employees.refresh} />
      ) : null}
      {!isEmployee ? (
        <Card className="mt-5" title="Monthly payroll draft" subtitle="Draft recalculation uses current employee salaries, attendance, and approved leave records.">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <Field label="Payroll month" type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
            {isHr ? <Button disabled={pending || !month} onClick={() => void createDraft()}>{pending ? "Calculating…" : "Create / recalculate draft"}</Button> : null}
          </div>
        </Card>
      ) : null}

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(15rem,0.45fr)_minmax(0,1.55fr)]">
        <Card title={isEmployee ? "Finalized pay periods" : "Payroll runs"}>
          {runs.loading ? <LoadingState label="Loading payroll runs…" /> : runs.error ? (
            <div className="grid gap-3"><FormError error={runs.error} /><Button variant="secondary" onClick={runs.refresh}>Retry</Button></div>
          ) : visibleRuns.length === 0 ? <EmptyState title={isEmployee ? "No finalized payslips yet" : "No payroll runs yet"} /> : (
            <ul className="divide-y divide-slate-100">
              {visibleRuns.map((run) => (
                <li key={run.id} className="py-3 first:pt-0">
                  <button
                    type="button"
                    className={`w-full rounded-lg p-3 text-left transition ${selectedRunId === run.id ? "bg-teal-50 ring-1 ring-teal-200" : "hover:bg-slate-50"}`}
                    onClick={() => setSelectedRunId(run.id)}
                  >
                    <span className="flex items-center justify-between gap-2"><strong>{run.month}/{run.year}</strong><StatusPill value={run.status} /></span>
                    <span className="mt-1 block text-xs text-slate-500">{run.payslips.length} payslip(s)</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card
          title={selectedRun ? `Payslips · ${selectedRun.month}/${selectedRun.year}` : "Payroll review"}
          subtitle={selectedRun?.status === "FINALIZED" ? "This period is locked." : selectedRun ? "Review the draft amounts before finalization." : "Select a payroll run to review."}
          actions={selectedRun && isAdmin && selectedRun.status === "DRAFT" ? <Button disabled={pending} onClick={() => void finalizeRun(selectedRun)}>{pending ? "Finalizing…" : "Finalize and lock"}</Button> : null}
        >
          {downloadError ? <FormError error={downloadError} /> : null}
          {!selectedRun ? <EmptyState title="Select a payroll run" /> : payslips.loading ? <LoadingState label="Loading payslips…" /> : payslips.error ? (
            <div className="grid gap-3"><FormError error={payslips.error} /><Button variant="secondary" onClick={payslips.refresh}>Retry</Button></div>
          ) : !payslips.data?.length ? <EmptyState title="No payslips in this run" /> : (
            <div className="table-wrap">
              <table className="table">
                <thead><tr>{!isEmployee ? <th>Employee</th> : null}<th>Basic</th><th>HRA</th><th>Medical</th><th>Gross</th><th>Deductions</th><th>Tax</th><th>Net</th><th /></tr></thead>
                <tbody>
                  {payslips.data.map((slip) => (
                    <tr key={slip.id}>
                      {!isEmployee ? <td>{slip.employee ? `${slip.employee.firstName} ${slip.employee.lastName}` : "Employee"}</td> : null}
                      <td>{money(slip.basic)}</td><td>{money(slip.hra)}</td><td>{money(slip.medical)}</td><td>{money(slip.gross)}</td><td>{money(slip.deductions)}</td><td>{money(slip.tax)}</td><td className="font-bold">{money(slip.net)}</td>
                      <td>{selectedRun.status === "FINALIZED" ? <Button variant="secondary" onClick={() => void downloadPayslip(slip.id)}>Download PDF</Button> : <span className="text-xs text-slate-400">Not finalized</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {selectedRun?.status === "FINALIZED" ? <p className="mt-3 text-xs text-emerald-800">Locked payroll run · finalized {selectedRun.finalizedAt ? new Date(selectedRun.finalizedAt).toLocaleString() : ""}</p> : null}
        </Card>
      </div>
    </>
  );
}

function SalaryStructure({
  employees,
  loading,
  error,
  onSaved,
}: {
  employees: Employee[];
  loading: boolean;
  error: unknown;
  onSaved: () => void;
}) {
  return (
    <Card title="Salary structures" subtitle="HR manages basic monthly salary. Gross components are calculated by the payroll service.">
      {loading ? <LoadingState label="Loading employee salary structures…" /> : error ? <FormError error={error} /> : employees.length === 0 ? (
        <EmptyState title="No employees found">Register employees before setting salary structures.</EmptyState>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Employee</th><th>Department</th><th>Basic monthly salary</th><th /></tr></thead>
            <tbody>{employees.map((employee) => <SalaryRow key={employee.id} employee={employee} onSaved={onSaved} />)}</tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function SalaryRow({ employee, onSaved }: { employee: Employee; onSaved: () => void }) {
  const [salary, setSalary] = useState(String(Number(employee.basicSalary)));
  const [error, setError] = useState<unknown>(null);
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save() {
    setPending(true);
    setError(null);
    setSaved(false);
    try {
      await api.employees.update(employee.id, { basicSalary: Number(salary) });
      setSaved(true);
      onSaved();
    } catch (reason) {
      setError(reason);
    } finally {
      setPending(false);
    }
  }

  return (
    <tr>
      <td>{employee.firstName} {employee.lastName}<br /><span className="text-xs text-slate-500">{employee.employeeCode}</span></td>
      <td>{employee.department?.name ?? "Unassigned"}</td>
      <td><input className="input min-w-36" aria-label={`Basic salary for ${employee.firstName} ${employee.lastName}`} type="number" min="0.01" step="0.01" value={salary} onChange={(event) => setSalary(event.target.value)} /></td>
      <td><div className="grid gap-2"><Button variant="secondary" disabled={pending || Number(salary) <= 0} onClick={() => void save()}>{pending ? "Saving…" : "Save"}</Button>{saved ? <span className="text-xs text-emerald-700">Saved</span> : null}{error ? <FormError error={error} /> : null}</div></td>
    </tr>
  );
}
