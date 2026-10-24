import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/hcm";
import type { CsvDryRunResult, EmployeeCreateResult } from "../api/types";
import { Button, Card, EmptyState, FormError, PageHeading, StatusPill } from "../components/Feedback";

export function CsvImportPage() {
  const [csv, setCsv] = useState("");
  const [fileName, setFileName] = useState("");
  const [dryRun, setDryRun] = useState<CsvDryRunResult | null>(null);
  const [created, setCreated] = useState<EmployeeCreateResult[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  async function readFile(file: File | undefined) {
    setCsv("");
    setFileName("");
    setDryRun(null);
    setCreated(null);
    setError(null);
    if (!file) return;
    try {
      setCsv(await file.text());
      setFileName(file.name);
    } catch (reason) {
      setError(reason instanceof Error ? reason : new Error("Unable to read the CSV file"));
    }
  }

  async function runDryRun() {
    setBusy(true);
    setError(null);
    setDryRun(null);
    setCreated(null);
    try {
      setDryRun(await api.employees.dryRunCsv(csv));
    } catch (reason) {
      setError(reason);
    } finally {
      setBusy(false);
    }
  }

  async function confirmImport() {
    if (!dryRun || dryRun.validRows.length === 0) return;
    if (!window.confirm(`Create ${dryRun.validRows.length} valid employee records? Temporary passwords will be shown once.`)) return;
    setBusy(true);
    setError(null);
    try {
      setCreated(await api.employees.confirmCsv(dryRun.validRows));
    } catch (reason) {
      setError(reason);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeading title="Import employees from CSV" description="Validate the file first. No records are created until you confirm the valid rows." actions={<Link to="/employees" className="button button-secondary">Back to directory</Link>} />
      <div className="grid gap-5">
        <Card title="Select a CSV file" subtitle="Required columns: employeeCode, firstName, lastName, email, joiningDate, basicSalary. Optional: departmentId, designationId, phone, address.">
          <FormError error={error} />
          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
            <label className="field">
              <span>CSV file</span>
              <input className="input file:mr-3 file:rounded-lg file:border-0 file:bg-teal-50 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-teal-900" type="file" accept=".csv,text/csv" onChange={(event) => void readFile(event.target.files?.[0])} />
              {fileName ? <small className="text-slate-500">Selected: {fileName}</small> : null}
            </label>
            <Button disabled={!csv || busy} onClick={() => void runDryRun()}>{busy ? "Checking…" : "Run dry run"}</Button>
          </div>
          {!csv && !dryRun ? <div className="mt-4"><EmptyState title="Choose a CSV file to begin">The dry run reports each invalid row and field. It does not create employee accounts.</EmptyState></div> : null}
        </Card>

        {dryRun ? (
          <Card
            title="Dry-run results"
            subtitle={`${dryRun.validRows.length} valid row(s) · ${dryRun.errors.length} issue(s)`}
            actions={<StatusPill value={dryRun.errors.length === 0 ? "READY" : "REVIEW"} />}
          >
            {dryRun.errors.length ? (
              <div className="mb-5">
                <h3 className="mb-2 font-semibold text-rose-800">Rows to fix</h3>
                <div className="table-wrap">
                  <table className="table">
                    <thead><tr><th>Row</th><th>Field</th><th>Reason</th></tr></thead>
                    <tbody>{dryRun.errors.map((item, index) => <tr key={`${item.row}-${item.field}-${index}`}><td>{item.row}</td><td>{item.field}</td><td>{item.reason}</td></tr>)}</tbody>
                  </table>
                </div>
              </div>
            ) : null}
            {dryRun.validRows.length ? (
              <>
                <h3 className="mb-2 font-semibold text-slate-900">Valid rows</h3>
                <div className="table-wrap">
                  <table className="table">
                    <thead><tr><th>Code</th><th>Name</th><th>Email</th><th>Joining date</th><th>Basic salary</th></tr></thead>
                    <tbody>
                      {dryRun.validRows.map((row) => (
                        <tr key={`${row.employeeCode}-${row.email}`}>
                          <td>{row.employeeCode}</td>
                          <td>{row.firstName} {row.lastName}</td>
                          <td>{row.email}</td>
                          <td>{row.joiningDate}</td>
                          <td>{row.basicSalary.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <Button disabled={busy} onClick={() => void confirmImport()}>{busy ? "Importing…" : `Confirm ${dryRun.validRows.length} valid row(s)`}</Button>
                  {dryRun.errors.length ? <p className="text-sm text-slate-500">Rows with issues will not be submitted.</p> : null}
                </div>
              </>
            ) : <EmptyState title="No valid rows to import">Fix the issues above, choose the updated CSV file, and run the dry run again.</EmptyState>}
          </Card>
        ) : null}

        {created ? (
          <Card title="Import completed" subtitle="Copy the temporary passwords now. They are displayed only for this result.">
            {created.length === 0 ? <EmptyState title="No employees were created" /> : (
              <div className="table-wrap">
                <table className="table">
                  <thead><tr><th>Employee</th><th>Email</th><th>Temporary password</th></tr></thead>
                  <tbody>
                    {created.map((item) => (
                      <tr key={item.employee.id}>
                        <td>{item.employee.firstName} {item.employee.lastName}</td>
                        <td>{item.employee.user?.email}</td>
                        <td className="font-mono">{item.temporaryPassword}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <Link className="button button-secondary mt-4" to="/employees">Open employee directory</Link>
          </Card>
        ) : null}
      </div>
    </>
  );
}
