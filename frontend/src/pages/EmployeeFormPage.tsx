import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../api/hcm";
import type { Employee, EmployeeCreateResult, EmploymentStatus } from "../api/types";
import { Button, Card, EmptyState, Field, FormError, LoadingState, PageHeading, SelectField } from "../components/Feedback";
import { useResource } from "../hooks/useResource";

const statuses: EmploymentStatus[] = ["ACTIVE", "PROBATION", "INACTIVE", "RESIGNED", "TERMINATED"];

function dateInputValue(value: string | null | undefined) {
  return value ? value.slice(0, 10) : "";
}

export function EmployeeFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const editing = Boolean(id);
  const employee = useResource<Employee | null>(() => id ? api.employees.get(id) : Promise.resolve(null), [id]);
  const organization = useResource(async () => {
    const [departments, designations] = await Promise.all([
      api.organization.departments.list(),
      api.organization.designations.list(),
    ]);
    return { departments, designations };
  });
  const [error, setError] = useState<unknown>(null);
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState<EmployeeCreateResult | null>(null);
  const [formVersion, setFormVersion] = useState(0);

  useEffect(() => {
    if (employee.data) setFormVersion((value) => value + 1);
  }, [employee.data]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const departmentId = String(form.get("departmentId") ?? "");
    const designationId = String(form.get("designationId") ?? "");
    const phone = String(form.get("phone") ?? "");
    const address = String(form.get("address") ?? "");
    const dateOfBirth = String(form.get("dateOfBirth") ?? "");
    const leavingDate = String(form.get("leavingDate") ?? "");
    setSaving(true);
    setError(null);
    setCreated(null);
    try {
      if (id) {
        await api.employees.update(id, {
          firstName: String(form.get("firstName")),
          lastName: String(form.get("lastName")),
          phone: phone || null,
          address: address || null,
          dateOfBirth: dateOfBirth || null,
          joiningDate: String(form.get("joiningDate")),
          leavingDate: leavingDate || null,
          status: String(form.get("status")) as EmploymentStatus,
          basicSalary: Number(form.get("basicSalary")),
          departmentId: departmentId || null,
          designationId: designationId || null,
        });
        navigate(`/employees/${id}`);
      } else {
        const result = await api.employees.create({
          employeeCode: String(form.get("employeeCode")),
          firstName: String(form.get("firstName")),
          lastName: String(form.get("lastName")),
          email: String(form.get("email")),
          phone: phone || undefined,
          address: address || undefined,
          dateOfBirth: dateOfBirth || undefined,
          joiningDate: String(form.get("joiningDate")),
          leavingDate: leavingDate || undefined,
          status: String(form.get("status")) as EmploymentStatus,
          basicSalary: Number(form.get("basicSalary")),
          departmentId: departmentId || undefined,
          designationId: designationId || undefined,
        });
        setCreated(result);
        formElement.reset();
      }
    } catch (reason) {
      setError(reason);
    } finally {
      setSaving(false);
    }
  }

  if (organization.loading || (editing && employee.loading)) {
    return <><PageHeading title={editing ? "Edit employee" : "Register employee"} /><LoadingState label="Loading employee and organization data…" /></>;
  }
  if (organization.error || (editing && employee.error)) {
    return (
      <>
        <PageHeading title={editing ? "Edit employee" : "Register employee"} />
        <FormError error={organization.error ?? employee.error} />
        <Button className="mt-4" variant="secondary" onClick={() => { organization.refresh(); employee.refresh(); }}>Retry</Button>
      </>
    );
  }
  if (!organization.data || (editing && !employee.data)) {
    return <><PageHeading title={editing ? "Edit employee" : "Register employee"} /><EmptyState title="Employee data is unavailable" /></>;
  }

  const current = employee.data;
  return (
    <>
      <PageHeading
        title={editing ? "Edit employee" : "Register employee"}
        description={editing ? "Update employment and profile details." : "Create the employee profile and login. The temporary password is shown once."}
        actions={editing && id ? <Link className="button button-secondary" to={`/employees/${id}`}>View 360 profile</Link> : null}
      />
      <div className="max-w-5xl">
        <Card title={editing ? "Employee information" : "New employee"} subtitle={editing ? "Email and employee code are retained as identifiers." : "Required fields are marked by the browser form validation."}>
          <FormError error={error} />
          <form key={formVersion} className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3" onSubmit={(event) => void submit(event)}>
            {!editing ? <Field label="Employee code" name="employeeCode" required minLength={2} maxLength={50} /> : (
              <Field label="Employee code" value={current?.employeeCode ?? ""} readOnly />
            )}
            <Field label="First name" name="firstName" defaultValue={current?.firstName} required maxLength={100} />
            <Field label="Last name" name="lastName" defaultValue={current?.lastName} required maxLength={100} />
            {!editing ? <Field label="Work email" name="email" type="email" required autoComplete="email" /> : (
              <Field label="Work email" value={current?.user?.email ?? ""} readOnly />
            )}
            <Field label="Phone" name="phone" defaultValue={current?.phone ?? ""} maxLength={30} />
            <Field label="Address" name="address" defaultValue={current?.address ?? ""} maxLength={400} />
            <Field label="Date of birth" name="dateOfBirth" type="date" defaultValue={dateInputValue(current?.dateOfBirth)} />
            <Field label="Joining date" name="joiningDate" type="date" defaultValue={dateInputValue(current?.joiningDate)} required />
            <Field label="Leaving date" name="leavingDate" type="date" defaultValue={dateInputValue(current?.leavingDate)} />
            <SelectField label="Employment status" name="status" defaultValue={current?.status ?? "ACTIVE"}>
              {statuses.map((status) => <option key={status} value={status}>{status.replaceAll("_", " ")}</option>)}
            </SelectField>
            <Field label="Basic monthly salary (PKR)" name="basicSalary" type="number" min={0.01} step="0.01" defaultValue={current ? Number(current.basicSalary) : undefined} required />
            <SelectField label="Department" name="departmentId" defaultValue={current?.departmentId ?? ""}>
              <option value="">Unassigned</option>
              {organization.data.departments.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}
            </SelectField>
            <SelectField label="Designation" name="designationId" defaultValue={current?.designationId ?? ""}>
              <option value="">Unassigned</option>
              {organization.data.designations.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}
            </SelectField>
            <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-3">
              <Button disabled={saving}>{saving ? "Saving…" : editing ? "Save employee" : "Register employee"}</Button>
              {editing ? <Link className="button button-secondary" to="/employees">Cancel</Link> : null}
            </div>
          </form>
          {created ? (
            <div className="mt-6 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
              <h2 className="font-bold">Employee created — copy this temporary password</h2>
              <p className="mt-1">It is only displayed now. The employee must change it on first sign-in.</p>
              <p className="mt-3"><strong>{created.employee.firstName} {created.employee.lastName}</strong> · {created.employee.user?.email}</p>
              <p className="mt-2 break-all rounded-lg bg-white px-3 py-2 font-mono">{created.temporaryPassword}</p>
              <Button className="mt-3" variant="secondary" onClick={() => void navigator.clipboard?.writeText(created.temporaryPassword)}>Copy password</Button>
              <Link className="button button-secondary ml-2 mt-3" to={`/employees/${created.employee.id}`}>Open 360 profile</Link>
            </div>
          ) : null}
        </Card>
      </div>
    </>
  );
}
