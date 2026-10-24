import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/hcm";
import type { EmploymentStatus } from "../api/types";
import { Button, Card, EmptyState, FormError, LoadingState, PageHeading, SelectField, StatusPill, Field } from "../components/Feedback";
import { useResource } from "../hooks/useResource";

const pageSize = 20;

export function EmployeeDirectoryPage() {
  const departments = useResource(() => api.organization.departments.list());
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [status, setStatus] = useState<EmploymentStatus | "">("");
  const [page, setPage] = useState(1);
  const directory = useResource(
    () => api.employees.list({ page, pageSize, search: search || undefined, departmentId: departmentId || undefined, status: status || undefined }),
    [page, search, departmentId, status],
  );

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  }

  const totalPages = Math.max(1, Math.ceil((directory.data?.total ?? 0) / pageSize));

  return (
    <>
      <PageHeading
        title="Employees"
        description="Search and filter the employee directory. Results are paged by the server."
        actions={
          <>
            <Button variant="secondary" onClick={() => void api.employees.exportCsv().catch((error: unknown) => window.alert(error instanceof Error ? error.message : "Export failed"))}>Export CSV</Button>
            <Link className="button button-secondary" to="/employees/import">Import CSV</Link>
            <Link className="button button-primary" to="/employees/new">Register employee</Link>
          </>
        }
      />
      <Card title="Directory">
        <form className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(12rem,2fr)_minmax(10rem,1fr)_minmax(10rem,1fr)_auto]" onSubmit={applyFilters}>
          <Field label="Search" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Name, employee code or email" />
          <SelectField label="Department" value={departmentId} onChange={(event) => { setDepartmentId(event.target.value); setPage(1); }}>
            <option value="">All departments</option>
            {(departments.data ?? []).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </SelectField>
          <SelectField label="Employment status" value={status} onChange={(event) => { setStatus(event.target.value as EmploymentStatus | ""); setPage(1); }}>
            <option value="">All statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="PROBATION">Probation</option>
            <option value="INACTIVE">Inactive</option>
            <option value="RESIGNED">Resigned</option>
            <option value="TERMINATED">Terminated</option>
          </SelectField>
          <div className="flex items-end"><Button>Apply filters</Button></div>
        </form>
        {departments.error ? <FormError error={departments.error} /> : null}
        {directory.loading ? <LoadingState label="Searching employees…" /> : directory.error ? (
          <div className="grid gap-3"><FormError error={directory.error} /><Button variant="secondary" onClick={directory.refresh}>Retry</Button></div>
        ) : !directory.data || directory.data.rows.length === 0 ? (
          <EmptyState title="No employees found">Try a different search or register an employee to begin.</EmptyState>
        ) : (
          <>
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Employee</th><th>Code</th><th>Department</th><th>Designation</th><th>Status</th><th>Basic salary</th><th /></tr></thead>
                <tbody>
                  {directory.data.rows.map((employee) => (
                    <tr key={employee.id}>
                      <td><p className="font-semibold text-slate-900">{employee.firstName} {employee.lastName}</p><p className="text-xs text-slate-500">{employee.user?.email}</p></td>
                      <td>{employee.employeeCode}</td>
                      <td>{employee.department?.name ?? "Unassigned"}</td>
                      <td>{employee.designation?.name ?? "Unassigned"}</td>
                      <td><StatusPill value={employee.status} /></td>
                      <td>{Number(employee.basicSalary).toLocaleString(undefined, { style: "currency", currency: "PKR" })}</td>
                      <td><Link className="font-semibold text-teal-800 hover:underline" to={`/employees/${employee.id}`}>360 profile</Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex flex-col justify-between gap-3 text-sm sm:flex-row sm:items-center">
              <p className="text-slate-500">{directory.data.total} employees · Page {page} of {totalPages}</p>
              <div className="flex gap-2">
                <Button variant="secondary" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</Button>
                <Button variant="secondary" disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)}>Next</Button>
              </div>
            </div>
          </>
        )}
      </Card>
    </>
  );
}
