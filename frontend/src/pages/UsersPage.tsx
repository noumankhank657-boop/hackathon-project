import { useState, type FormEvent } from "react";
import { api } from "../api/hcm";
import type { HrUser } from "../api/types";
import { Button, Card, EmptyState, Field, FormError, LoadingState, PageHeading, StatusPill } from "../components/Feedback";
import { useResource } from "../hooks/useResource";

function newTemporaryPassword() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
  const bytes = new Uint8Array(18);
  window.crypto.getRandomValues(bytes);
  return Array.from(bytes, (value) => alphabet[value % alphabet.length]).join("");
}

export function UsersPage() {
  const users = useResource(() => api.organization.hrUsers.list());
  const [temporaryPassword, setTemporaryPassword] = useState(newTemporaryPassword);
  const [oneTimeMessage, setOneTimeMessage] = useState<{ email: string; password: string } | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  async function createUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setBusy(true);
    setError(null);
    setOneTimeMessage(null);
    try {
      const email = String(form.get("email"));
      await api.organization.hrUsers.create({ email, password: temporaryPassword, name: String(form.get("name")) || undefined });
      setOneTimeMessage({ email, password: temporaryPassword });
      setTemporaryPassword(newTemporaryPassword());
      formElement.reset();
      await users.refresh();
    } catch (reason) {
      setError(reason);
    } finally {
      setBusy(false);
    }
  }

  async function toggleUser(user: HrUser) {
    setBusy(true);
    setError(null);
    setOneTimeMessage(null);
    try {
      await api.organization.hrUsers.setActive(user.id, !user.isActive);
      await users.refresh();
    } catch (reason) {
      setError(reason);
    } finally {
      setBusy(false);
    }
  }

  async function resetPassword(user: HrUser) {
    const password = newTemporaryPassword();
    setBusy(true);
    setError(null);
    setOneTimeMessage(null);
    try {
      await api.organization.hrUsers.resetPassword(user.id, password);
      setOneTimeMessage({ email: user.email, password });
    } catch (reason) {
      setError(reason);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeading title="User management" description="Create HR accounts and manage access. Temporary passwords are displayed once after the operation." />
      <div className="grid gap-5 xl:grid-cols-[minmax(18rem,0.75fr)_minmax(0,1.25fr)]">
        <Card title="Create HR login" subtitle="The user will be required to change this password at first sign-in.">
          <form className="grid gap-4" onSubmit={(event) => void createUser(event)}>
            <FormError error={error} />
            <Field label="Full name" name="name" autoComplete="name" minLength={2} maxLength={100} />
            <Field label="Email" name="email" type="email" autoComplete="email" required />
            <Field label="Temporary password" name="temporaryPassword" value={temporaryPassword} readOnly />
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="secondary" onClick={() => setTemporaryPassword(newTemporaryPassword())}>Generate another</Button>
              <Button disabled={busy}>{busy ? "Creating…" : "Create HR account"}</Button>
            </div>
          </form>
          {oneTimeMessage ? (
            <div className="mt-5 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
              <p className="font-bold">Copy this temporary password now</p>
              <p className="mt-1">It is shown once and will not be available after leaving this page.</p>
              <p className="mt-3 break-all rounded-lg bg-white px-3 py-2 font-mono">{oneTimeMessage.email}: {oneTimeMessage.password}</p>
              <Button className="mt-3" variant="secondary" onClick={() => void navigator.clipboard?.writeText(oneTimeMessage.password)}>Copy password</Button>
            </div>
          ) : null}
        </Card>
        <Card title="HR accounts" subtitle="Inactive accounts cannot sign in.">
          {users.loading ? <LoadingState label="Loading HR accounts…" /> : users.error ? (
            <div className="grid gap-3"><FormError error={users.error} /><Button variant="secondary" onClick={users.refresh}>Retry</Button></div>
          ) : !users.data || users.data.length === 0 ? (
            <EmptyState title="No HR accounts yet">Create an HR login to delegate employee and payroll administration.</EmptyState>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Name</th><th>Email</th><th>Status</th><th>Actions</th></tr></thead>
                <tbody>
                  {users.data.map((user) => (
                    <tr key={user.id}>
                      <td>{user.name || "—"}</td>
                      <td>{user.email}</td>
                      <td><StatusPill value={user.isActive ? "ACTIVE" : "INACTIVE"} /></td>
                      <td>
                        <div className="flex flex-wrap gap-2">
                          <Button variant="secondary" disabled={busy} onClick={() => void resetPassword(user)}>Reset password</Button>
                          <Button variant={user.isActive ? "danger" : "primary"} disabled={busy} onClick={() => void toggleUser(user)}>
                            {user.isActive ? "Deactivate" : "Activate"}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
