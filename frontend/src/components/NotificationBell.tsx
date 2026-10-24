import { useState } from "react";
import { api } from "../api/hcm";
import { Button, EmptyState, FormError, LoadingState } from "./Feedback";
import { useResource } from "../hooks/useResource";

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const unread = useResource(() => api.comms.unreadCount());
  const notifications = useResource(() => open ? api.comms.notifications() : Promise.resolve([]), [open]);
  const [error, setError] = useState<unknown>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  async function markRead(id: string) {
    setPendingId(id);
    setError(null);
    try {
      await api.comms.markNotificationRead(id);
      notifications.refresh();
      unread.refresh();
    } catch (reason) {
      setError(reason);
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        className="relative grid h-10 w-10 place-items-center rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
        aria-label={`Notifications${unread.data?.count ? `, ${unread.data.count} unread` : ""}`}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span aria-hidden="true" className="text-lg">♢</span>
        {unread.data?.count ? <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-rose-600 px-1 text-[0.65rem] font-bold leading-5 text-white">{unread.data.count}</span> : null}
      </button>
      {open ? (
        <div className="absolute right-0 z-40 mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-slate-200 bg-white p-4 shadow-xl">
          <div className="mb-3 flex items-center justify-between"><h2 className="font-semibold text-slate-950">Notifications</h2><button className="text-xs font-semibold text-teal-800" onClick={() => setOpen(false)}>Close</button></div>
          {unread.error ? <FormError error={unread.error} /> : null}
          <FormError error={error} />
          {notifications.loading ? <LoadingState label="Loading notifications…" /> : notifications.error ? (
            <div className="grid gap-2"><FormError error={notifications.error} /><Button variant="secondary" onClick={notifications.refresh}>Retry</Button></div>
          ) : !notifications.data?.length ? <EmptyState title="No notifications" /> : (
            <ul className="max-h-[60vh] divide-y divide-slate-100 overflow-y-auto">
              {notifications.data.map((item) => (
                <li className={`py-3 ${item.isRead ? "opacity-70" : ""}`} key={item.id}>
                  <div className="flex items-start justify-between gap-2">
                    <div><p className="text-sm font-semibold text-slate-900">{item.title}</p><p className="mt-1 text-sm text-slate-600">{item.message}</p><time className="mt-1 block text-xs text-slate-400">{new Date(item.createdAt).toLocaleString()}</time></div>
                    {!item.isRead ? <button className="shrink-0 text-xs font-semibold text-teal-800 hover:underline" disabled={pendingId === item.id} onClick={() => void markRead(item.id)}>Mark read</button> : <span className="text-xs text-slate-400">Read</span>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
