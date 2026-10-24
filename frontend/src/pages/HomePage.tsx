import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/hcm";
import type { Announcement } from "../api/types";
import { useAuth } from "../auth/AuthContext";
import { Card, EmptyState, ErrorAlert, LoadingState, PageHeading } from "../components/Feedback";

export function HomePage() {
  const { session } = useAuth();
  const [health, setHealth] = useState<string | null>(null);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([api.health(), api.comms.announcements()])
      .then(([status, messages]) => {
        if (!active) return;
        setHealth(status.status);
        setAnnouncements(messages);
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : "Unable to load your dashboard");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  if (!session) return null;
  return (
    <>
      <PageHeading
        title={`Welcome, ${session.user.email}`}
        description="Your workspace data is connected to the HCM Lite server."
      />
      {error ? <ErrorAlert message={error} /> : null}
      {loading ? <LoadingState label="Loading workspace…" /> : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <Card title="Your workspace" subtitle="Choose a module from the role-based navigation.">
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span className="rounded-full bg-emerald-50 px-3 py-1.5 font-semibold text-emerald-800">
                Backend {health === "ok" ? "connected" : health}
              </span>
              <span className="rounded-full bg-slate-100 px-3 py-1.5 font-semibold text-slate-700">{session.user.role}</span>
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-600">
              This view is backed by live service responses. As you add employees and activity, your role dashboard will reflect those records.
            </p>
            {session.user.role === "EMPLOYEE" ? (
              <div className="mt-5 flex flex-wrap gap-2">
                <Link className="button button-primary" to="/attendance">Open attendance</Link>
                <Link className="button button-secondary" to="/leave">Request leave</Link>
              </div>
            ) : (
              <div className="mt-5 flex flex-wrap gap-2">
                <Link className="button button-primary" to="/employees">Open employees</Link>
                <Link className="button button-secondary" to="/organization">Organization setup</Link>
              </div>
            )}
          </Card>
          <Card title="Announcements" subtitle="Latest company updates">
            {announcements.length === 0 ? (
              <EmptyState title="No announcements yet">New company updates will appear here.</EmptyState>
            ) : (
              <ul className="divide-y divide-slate-100">
                {announcements.slice(0, 5).map((item) => (
                  <li key={item.id} className="py-3 first:pt-0 last:pb-0">
                    <h3 className="font-semibold text-slate-900">{item.title}</h3>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">{item.body}</p>
                    <time className="mt-2 block text-xs text-slate-400" dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString()}</time>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}
    </>
  );
}
