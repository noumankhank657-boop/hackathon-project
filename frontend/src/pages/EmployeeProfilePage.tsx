import { useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api/hcm";
import type { Employee } from "../api/types";
import { useAuth } from "../auth/AuthContext";
import { Button, Card, EmptyState, Field, FormError, LoadingState, PageHeading, StatusPill, TextAreaField } from "../components/Feedback";
import { useResource } from "../hooks/useResource";

function ProfileDetails({ employee, showCompensation }: { employee: Employee; showCompensation: boolean }) {
  const details: [string, string][] = [
    ["Employee code", employee.employeeCode],
    ["Email", employee.user?.email ?? "—"],
    ["Phone", employee.phone || "—"],
    ["Address", employee.address || "—"],
    ["Department", employee.department?.name ?? "Unassigned"],
    ["Designation", employee.designation?.name ?? "Unassigned"],
    ["Joining date", employee.joiningDate.slice(0, 10)],
    ["Leaving date", employee.leavingDate?.slice(0, 10) ?? "—"],
  ];
  if (showCompensation) {
    details.push(["Basic salary", Number(employee.basicSalary).toLocaleString(undefined, { style: "currency", currency: "PKR" })]);
  }
  return (
    <dl className="grid gap-x-6 gap-y-5 sm:grid-cols-2">
      {details.map(([label, value]) => (
        <div key={label} className="min-w-0">
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
          <dd className="mt-1 break-words text-sm font-medium text-slate-900">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function EmployeeProfilePage({ self = false }: { self?: boolean }) {
  const { id = "" } = useParams();
  const { session } = useAuth();
  const resource = useResource(() => self ? api.employees.me() : api.employees.get(id), [self, id]);
  const employee = resource.data as Employee | null;
  const [error, setError] = useState<unknown>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [resettingFace, setResettingFace] = useState(false);

  async function updatePersonalDetails(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await api.employees.updateMe({
        phone: String(form.get("phone")) || null,
        address: String(form.get("address")) || null,
      });
      setSuccess("Your contact details have been saved.");
      resource.refresh();
    } catch (reason) {
      setError(reason);
    } finally {
      setSaving(false);
    }
  }

  async function resetFace() {
    if (!employee || !window.confirm(`Reset the enrolled face for ${employee.firstName} ${employee.lastName}?`)) return;
    setResettingFace(true);
    setError(null);
    setSuccess(null);
    try {
      await api.employees.resetFace(employee.id);
      setSuccess("Face enrollment was reset.");
      resource.refresh();
    } catch (reason) {
      setError(reason);
    } finally {
      setResettingFace(false);
    }
  }

  if (resource.loading) return <><PageHeading title={self ? "My profile" : "Employee 360"} /><LoadingState label="Loading employee profile…" /></>;
  if (resource.error) return <><PageHeading title={self ? "My profile" : "Employee 360"} /><FormError error={resource.error} /><Button className="mt-4" variant="secondary" onClick={resource.refresh}>Retry</Button></>;
  if (!employee) return <><PageHeading title="Employee 360" /><EmptyState title="Employee profile not found" /></>;

  const showCompensation = session?.user.role !== "EMPLOYEE";
  const isEnrolled = Boolean(employee.faceDescriptor);
  return (
    <>
      <PageHeading
        title={self ? "My profile" : "Employee 360"}
        description={self ? "Your private employee profile. You can update your phone and address." : "Employment, team, account, and compensation details for this employee."}
        actions={!self ? <Link className="button button-primary" to={`/employees/${employee.id}/edit`}>Edit profile</Link> : <Link className="button button-secondary" to="/face/register">Register my face</Link>}
      />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <Card title={`${employee.firstName} ${employee.lastName}`} subtitle={employee.user?.email ?? undefined} actions={<StatusPill value={employee.status} />}>
          <FormError error={error} />
          {success ? <p className="mb-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{success}</p> : null}
          <ProfileDetails employee={employee} showCompensation={showCompensation} />
        </Card>
        <div className="grid content-start gap-5">
          <Card title="Account">
            <dl className="grid gap-3 text-sm">
              <div><dt className="text-xs uppercase text-slate-500">Login</dt><dd className="mt-1 font-medium">{employee.user?.isActive ? "Active" : "Inactive"}</dd></div>
              <div><dt className="text-xs uppercase text-slate-500">Password status</dt><dd className="mt-1 font-medium">{employee.user?.mustChangePassword ? "Must change at next login" : "Set"}</dd></div>
              <div><dt className="text-xs uppercase text-slate-500">Face enrollment</dt><dd className="mt-1 font-medium">{isEnrolled ? "Enrolled" : "Not enrolled"}</dd></div>
            </dl>
            {!self && showCompensation ? (
              <Button className="mt-4" variant="secondary" disabled={resettingFace || !isEnrolled} onClick={() => void resetFace()}>
                {resettingFace ? "Resetting…" : "Reset enrolled face"}
              </Button>
            ) : null}
          </Card>
          {self ? (
            <Card title="Edit contact information" subtitle="Employees may update phone and address only.">
              <form className="grid gap-4" onSubmit={(event) => void updatePersonalDetails(event)}>
                <Field label="Phone" name="phone" defaultValue={employee.phone ?? ""} maxLength={30} />
                <TextAreaField label="Address" name="address" defaultValue={employee.address ?? ""} maxLength={400} />
                <Button disabled={saving}>{saving ? "Saving…" : "Save contact details"}</Button>
              </form>
            </Card>
          ) : null}
        </div>
      </div>
    </>
  );
}
