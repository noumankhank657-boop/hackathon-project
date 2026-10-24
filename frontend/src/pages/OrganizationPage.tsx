import { useEffect, useState, type FormEvent } from "react";
import { api } from "../api/hcm";
import type { Department, Designation, Holiday, LeaveType, OrganizationSettings } from "../api/types";
import { useAuth } from "../auth/AuthContext";
import { Button, Card, EmptyState, Field, FormError, LoadingState, PageHeading, SelectField } from "../components/Feedback";
import { useResource } from "../hooks/useResource";

type NamedEntity = { id: string; name: string; description: string | null };
type NamedMutation = { name: string; description?: string };
type OrgData = {
  settings: OrganizationSettings;
  departments: Department[];
  designations: Designation[];
  leaveTypes: LeaveType[];
  holidays: Holiday[];
};

const weekdays = [
  { value: 0, name: "Sunday" },
  { value: 1, name: "Monday" },
  { value: 2, name: "Tuesday" },
  { value: 3, name: "Wednesday" },
  { value: 4, name: "Thursday" },
  { value: 5, name: "Friday" },
  { value: 6, name: "Saturday" },
];

function NamedEntityManager<T extends NamedEntity>({
  title,
  items,
  editable,
  create,
  update,
  remove,
  onChanged,
}: {
  title: string;
  items: T[];
  editable: boolean;
  create: (body: NamedMutation) => Promise<T>;
  update: (id: string, body: NamedMutation) => Promise<T>;
  remove: (id: string) => Promise<void>;
  onChanged: () => void;
}) {
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  async function submitCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setBusy(true);
    setError(null);
    try {
      await create({ name: String(form.get("name")), description: String(form.get("description") ?? "") || undefined });
      formElement.reset();
      onChanged();
    } catch (reason) {
      setError(reason);
    } finally {
      setBusy(false);
    }
  }

  async function submitUpdate(event: FormEvent<HTMLFormElement>, id: string) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError(null);
    try {
      await update(id, { name: String(form.get("name")), description: String(form.get("description") ?? "") || undefined });
      setEditingId(null);
      onChanged();
    } catch (reason) {
      setError(reason);
    } finally {
      setBusy(false);
    }
  }

  async function deleteItem(id: string) {
    if (!window.confirm(`Delete this ${title.toLowerCase().replace(/s$/, "")}?`)) return;
    setBusy(true);
    setError(null);
    try {
      await remove(id);
      onChanged();
    } catch (reason) {
      setError(reason);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title={title}>
      <div className="grid gap-4">
        <FormError error={error} />
        {items.length === 0 ? <EmptyState title={`No ${title.toLowerCase()} yet`} /> : (
          <ul className="divide-y divide-slate-100">
            {items.map((item) => (
              <li key={item.id} className="flex flex-col justify-between gap-3 py-3 first:pt-0 sm:flex-row sm:items-center">
                {editingId === item.id ? (
                  <form className="grid flex-1 gap-2 sm:grid-cols-2" onSubmit={(event) => void submitUpdate(event, item.id)}>
                    <Field label="Name" name="name" defaultValue={item.name} required maxLength={100} />
                    <Field label="Description" name="description" defaultValue={item.description ?? ""} maxLength={500} />
                    <div className="flex gap-2 sm:col-span-2">
                      <Button disabled={busy}>Save</Button>
                      <Button type="button" variant="secondary" onClick={() => setEditingId(null)}>Cancel</Button>
                    </div>
                  </form>
                ) : (
                  <>
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900">{item.name}</p>
                      {item.description ? <p className="mt-0.5 text-sm text-slate-500">{item.description}</p> : null}
                    </div>
                    {editable ? (
                      <div className="flex shrink-0 gap-2">
                        <Button variant="secondary" onClick={() => setEditingId(item.id)}>Edit</Button>
                        <Button variant="danger" disabled={busy} onClick={() => void deleteItem(item.id)}>Delete</Button>
                      </div>
                    ) : null}
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
        {editable ? (
          <form className="grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-2" onSubmit={(event) => void submitCreate(event)}>
            <Field label="Name" name="name" required maxLength={100} />
            <Field label="Description" name="description" maxLength={500} />
            <div className="sm:col-span-2"><Button disabled={busy}>{busy ? "Saving…" : `Add ${title.toLowerCase().replace(/s$/, "")}`}</Button></div>
          </form>
        ) : null}
      </div>
    </Card>
  );
}

function LeaveTypeManager({ items, editable, onChanged }: { items: LeaveType[]; editable: boolean; onChanged: () => void }) {
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const quota = String(form.get("yearlyQuota"));
    setBusy(true);
    setError(null);
    try {
      await api.organization.leaveTypes.create({
        name: String(form.get("name")),
        yearlyQuota: quota === "" ? null : Number(quota),
        isPaid: form.get("isPaid") === "on",
      });
      formElement.reset();
      onChanged();
    } catch (reason) {
      setError(reason);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!window.confirm("Delete this leave type?")) return;
    setBusy(true);
    setError(null);
    try {
      await api.organization.leaveTypes.remove(id);
      onChanged();
    } catch (reason) {
      setError(reason);
    } finally {
      setBusy(false);
    }
  }

  async function update(item: LeaveType) {
    const name = window.prompt("Leave type name", item.name);
    if (name === null) return;
    const quotaText = window.prompt("Yearly quota (leave blank for unlimited)", item.yearlyQuota === null ? "" : String(item.yearlyQuota));
    if (quotaText === null) return;
    const isPaid = window.confirm("Is this leave type paid? Choose Cancel for unpaid.");
    setBusy(true);
    setError(null);
    try {
      await api.organization.leaveTypes.update(item.id, {
        name: name.trim(),
        yearlyQuota: quotaText.trim() === "" ? null : Number(quotaText),
        isPaid,
      });
      onChanged();
    } catch (reason) {
      setError(reason);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title="Leave types" subtitle="Yearly quotas are configured by Admin; unlimited quota is used for unpaid leave.">
      <FormError error={error} />
      {items.length === 0 ? <EmptyState title="No leave types configured" /> : (
        <ul className="divide-y divide-slate-100">
          {items.map((item) => (
            <li key={item.id} className="flex flex-col justify-between gap-3 py-3 first:pt-0 sm:flex-row sm:items-center">
              <div>
                <p className="font-semibold text-slate-900">{item.name}</p>
                <p className="text-sm text-slate-500">{item.yearlyQuota === null ? "Unlimited" : `${item.yearlyQuota} days/year`} · {item.isPaid ? "Paid" : "Unpaid"}</p>
              </div>
              {editable ? <div className="flex gap-2"><Button variant="secondary" onClick={() => void update(item)}>Edit</Button><Button variant="danger" disabled={busy} onClick={() => void remove(item.id)}>Delete</Button></div> : null}
            </li>
          ))}
        </ul>
      )}
      {editable ? (
        <form className="mt-4 grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-2" onSubmit={(event) => void create(event)}>
          <Field label="Leave type name" name="name" required maxLength={100} />
          <Field label="Yearly quota" name="yearlyQuota" type="number" min={0} step={1} hint="Leave blank for unlimited." />
          <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" name="isPaid" defaultChecked /> Paid leave</label>
          <div><Button disabled={busy}>{busy ? "Saving…" : "Add leave type"}</Button></div>
        </form>
      ) : null}
    </Card>
  );
}

function HolidayManager({ items, editable, onChanged }: { items: Holiday[]; editable: boolean; onChanged: () => void }) {
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setBusy(true);
    setError(null);
    try {
      await api.organization.holidays.create({ name: String(form.get("name")), date: String(form.get("date")) });
      formElement.reset();
      onChanged();
    } catch (reason) {
      setError(reason);
    } finally {
      setBusy(false);
    }
  }

  async function update(item: Holiday) {
    const name = window.prompt("Holiday name", item.name);
    if (name === null) return;
    const date = window.prompt("Date (YYYY-MM-DD)", item.date.slice(0, 10));
    if (date === null) return;
    setBusy(true);
    setError(null);
    try {
      await api.organization.holidays.update(item.id, { name, date });
      onChanged();
    } catch (reason) {
      setError(reason);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!window.confirm("Delete this public holiday?")) return;
    setBusy(true);
    setError(null);
    try {
      await api.organization.holidays.remove(id);
      onChanged();
    } catch (reason) {
      setError(reason);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title="Public holidays">
      <FormError error={error} />
      {items.length === 0 ? <EmptyState title="No public holidays recorded" /> : (
        <ul className="divide-y divide-slate-100">
          {items.map((item) => (
            <li key={item.id} className="flex flex-col justify-between gap-3 py-3 first:pt-0 sm:flex-row sm:items-center">
              <div><p className="font-semibold text-slate-900">{item.name}</p><time className="text-sm text-slate-500">{item.date.slice(0, 10)}</time></div>
              {editable ? <div className="flex gap-2"><Button variant="secondary" onClick={() => void update(item)}>Edit</Button><Button variant="danger" disabled={busy} onClick={() => void remove(item.id)}>Delete</Button></div> : null}
            </li>
          ))}
        </ul>
      )}
      {editable ? (
        <form className="mt-4 grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-2" onSubmit={(event) => void create(event)}>
          <Field label="Holiday name" name="name" required maxLength={100} />
          <Field label="Date" name="date" type="date" required />
          <div className="sm:col-span-2"><Button disabled={busy}>{busy ? "Saving…" : "Add holiday"}</Button></div>
        </form>
      ) : null}
    </Card>
  );
}

export function OrganizationPage() {
  const { session } = useAuth();
  const editable = session?.user.role === "ADMIN";
  const resource = useResource<OrgData>(async () => {
    const [settings, departments, designations, leaveTypes, holidays] = await Promise.all([
      api.organization.settings(),
      api.organization.departments.list(),
      api.organization.designations.list(),
      api.organization.leaveTypes.list(),
      api.organization.holidays.list(),
    ]);
    return { settings, departments, designations, leaveTypes, holidays };
  });
  const [settings, setSettings] = useState<OrganizationSettings | null>(null);
  const [actionError, setActionError] = useState<unknown>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [locationMessage, setLocationMessage] = useState<string | null>(null);
  const [defaultLeavesBusy, setDefaultLeavesBusy] = useState(false);
  const data = resource.data;

  useEffect(() => {
    if (data) setSettings(data.settings);
  }, [data]);

  async function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!settings) return;
    setSavingSettings(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      const saved = await api.organization.saveSettings(settings);
      setSettings(saved);
      setActionSuccess("Company settings saved.");
      resource.refresh();
    } catch (reason) {
      setActionError(reason);
    } finally {
      setSavingSettings(false);
    }
  }

  function useCurrentLocation() {
    setLocationMessage(null);
    if (!navigator.geolocation) {
      setLocationMessage("This browser does not provide location services.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setSettings((current) => current ? {
          ...current,
          latitude: Number(position.coords.latitude.toFixed(6)),
          longitude: Number(position.coords.longitude.toFixed(6)),
        } : current);
        setLocationMessage("Current location added. Save settings to apply it.");
      },
      (reason) => setLocationMessage(`Unable to get location: ${reason.message}. Allow location access and use localhost or HTTPS.`),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  }

  async function addStandardLeaveTypes() {
    setDefaultLeavesBusy(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      await api.organization.bootstrapDefaultLeaveTypes();
      setActionSuccess("Standard leave types created.");
      resource.refresh();
    } catch (reason) {
      setActionError(reason);
    } finally {
      setDefaultLeavesBusy(false);
    }
  }

  function updateSetting<K extends keyof OrganizationSettings>(key: K, value: OrganizationSettings[K]) {
    setSettings((current) => current ? { ...current, [key]: value } : current);
  }

  if (resource.loading) return <><PageHeading title="Organization setup" description="Company rules and organization structure." /><LoadingState label="Loading organization data…" /></>;
  if (resource.error) return <><PageHeading title="Organization setup" /><FormError error={resource.error} /><Button className="mt-4" onClick={resource.refresh}>Retry</Button></>;
  if (!data || !settings) return <><PageHeading title="Organization setup" /><EmptyState title="Organization settings are unavailable" /></>;

  return (
    <>
      <PageHeading title="Organization setup" description={editable ? "Manage company rules, teams, leave types, and holidays." : "View company policies and organization structure."} />
      <div className="grid gap-5">
        <Card title="Company settings" subtitle="Rules apply to new records. Office coordinates are used by camera attendance.">
          <FormError error={actionError} />
          {actionSuccess ? <p className="mb-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{actionSuccess}</p> : null}
          <form className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" onSubmit={(event) => void saveSettings(event)}>
            <Field label="Office start" type="time" value={settings.officeStart} disabled={!editable} onChange={(event) => updateSetting("officeStart", event.target.value)} />
            <Field label="Grace period (minutes)" type="number" min={0} max={180} value={settings.graceMinutes} disabled={!editable} onChange={(event) => updateSetting("graceMinutes", Number(event.target.value))} />
            <Field label="Half-day threshold (hours)" type="number" min={0.1} max={24} step={0.25} value={settings.halfDayHours} disabled={!editable} onChange={(event) => updateSetting("halfDayHours", Number(event.target.value))} />
            <Field label="Office latitude" type="number" min={-90} max={90} step="any" value={settings.latitude ?? ""} disabled={!editable} onChange={(event) => updateSetting("latitude", event.target.value === "" ? null : Number(event.target.value))} />
            <Field label="Office longitude" type="number" min={-180} max={180} step="any" value={settings.longitude ?? ""} disabled={!editable} onChange={(event) => updateSetting("longitude", event.target.value === "" ? null : Number(event.target.value))} />
            <Field label="Office radius (meters)" type="number" min={1} max={5000} value={settings.radiusMeters} disabled={!editable} onChange={(event) => updateSetting("radiusMeters", Number(event.target.value))} />
            <fieldset className="grid gap-2 sm:col-span-2 lg:col-span-3">
              <legend className="text-sm font-semibold text-slate-700">Weekend days</legend>
              <div className="flex flex-wrap gap-x-4 gap-y-2">
                {weekdays.map((day) => (
                  <label className="flex items-center gap-2 text-sm text-slate-700" key={day.value}>
                    <input
                      type="checkbox"
                      checked={settings.weekend.includes(day.value)}
                      disabled={!editable}
                      onChange={(event) => {
                        const weekend = event.target.checked
                          ? [...settings.weekend, day.value]
                          : settings.weekend.filter((value) => value !== day.value);
                        updateSetting("weekend", weekend);
                      }}
                    />
                    {day.name}
                  </label>
                ))}
              </div>
            </fieldset>
            {locationMessage ? <p className="text-sm text-slate-600 sm:col-span-2 lg:col-span-3">{locationMessage}</p> : null}
            <div className="flex flex-wrap gap-2 sm:col-span-2 lg:col-span-3">
              {editable ? <Button type="button" variant="secondary" onClick={useCurrentLocation}>Use my current location</Button> : null}
              {editable ? <Button disabled={savingSettings}>{savingSettings ? "Saving…" : "Save settings"}</Button> : <span className="self-center text-sm text-slate-500">Read-only for HR.</span>}
            </div>
          </form>
        </Card>
        <div className="grid gap-5 lg:grid-cols-2">
          <NamedEntityManager
            title="Departments"
            items={data.departments}
            editable={editable}
            create={api.organization.departments.create}
            update={api.organization.departments.update}
            remove={api.organization.departments.remove}
            onChanged={resource.refresh}
          />
          <NamedEntityManager
            title="Designations"
            items={data.designations}
            editable={editable}
            create={api.organization.designations.create}
            update={api.organization.designations.update}
            remove={api.organization.designations.remove}
            onChanged={resource.refresh}
          />
          <div className="grid content-start gap-3">
            <LeaveTypeManager items={data.leaveTypes} editable={editable} onChanged={resource.refresh} />
            {editable && data.leaveTypes.length === 0 ? (
              <Button variant="secondary" disabled={defaultLeavesBusy} onClick={() => void addStandardLeaveTypes()}>
                {defaultLeavesBusy ? "Adding standard leave types…" : "Create standard annual, sick, casual and unpaid types"}
              </Button>
            ) : null}
          </div>
          <HolidayManager items={data.holidays} editable={editable} onChanged={resource.refresh} />
        </div>
      </div>
    </>
  );
}
