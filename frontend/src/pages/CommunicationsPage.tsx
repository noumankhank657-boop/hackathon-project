import { useState, type FormEvent } from "react";
import { api } from "../api/hcm";
import { useAuth } from "../auth/AuthContext";
import { Button, Card, EmptyState, Field, FormError, LoadingState, PageHeading, TextAreaField } from "../components/Feedback";
import { useResource } from "../hooks/useResource";

export function CommunicationsPage() {
  const { session } = useAuth();
  const canPost = session?.user.role === "ADMIN" || session?.user.role === "HR";
  const announcements = useResource(() => api.comms.announcements());
  const [error, setError] = useState<unknown>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function postAnnouncement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setPending(true);
    setError(null);
    setSuccess(null);
    try {
      await api.comms.postAnnouncement({ title: String(form.get("title")), body: String(form.get("body")) });
      formElement.reset();
      setSuccess("Announcement posted.");
      announcements.refresh();
    } catch (reason) {
      setError(reason);
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <PageHeading title="Communications" description="Read company announcements and post updates if your role permits it." />
      {canPost ? (
        <Card title="Post an announcement" subtitle="Announcements are visible to every signed-in user.">
          <FormError error={error} />
          {success ? <p className="mb-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{success}</p> : null}
          <form className="grid gap-4" onSubmit={(event) => void postAnnouncement(event)}>
            <Field label="Title" name="title" required minLength={2} maxLength={150} />
            <TextAreaField label="Message" name="body" required minLength={5} maxLength={2000} />
            <div><Button disabled={pending}>{pending ? "Posting…" : "Post announcement"}</Button></div>
          </form>
        </Card>
      ) : null}
      <Card className="mt-5" title="Company announcements">
        {announcements.loading ? <LoadingState label="Loading announcements…" /> : announcements.error ? (
          <div className="grid gap-3"><FormError error={announcements.error} /><Button variant="secondary" onClick={announcements.refresh}>Retry</Button></div>
        ) : !announcements.data?.length ? <EmptyState title="No announcements yet" /> : (
          <div className="grid gap-3">
            {announcements.data.map((item) => (
              <article className="rounded-xl border border-slate-200 p-4" key={item.id}>
                <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
                  <div><h2 className="font-semibold text-slate-950">{item.title}</h2><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{item.body}</p></div>
                  <time className="shrink-0 text-xs text-slate-400">{new Date(item.createdAt).toLocaleString()}</time>
                </div>
                {item.author?.email ? <p className="mt-3 text-xs text-slate-500">Posted by {item.author.name || item.author.email}</p> : null}
              </article>
            ))}
          </div>
        )}
      </Card>
    </>
  );
}
