"use client";

import { useContext, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { AuthContext } from "../../context/AuthContext";
import { NotificationContext } from "../../context/NotificationContext";
import { apiDelete, apiGet, apiPost } from "../../lib/api";

function fmtDate(v) {
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

export default function NotificationsPage() {
  const { authHeaders, loading: authLoading } = useContext(AuthContext);
  const { refreshUnread } = useContext(NotificationContext);

  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [limit] = useState(25);
  const [totalPages, setTotalPages] = useState(1);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [loading, setLoading] = useState(false);

  const canLoad = useMemo(() => !!authHeaders?.["x-user-role"], [authHeaders]);

  async function load(p = page) {
    if (!canLoad) return;
    setLoading(true);
    const t = toast.loading("Loading notifications...");
    try {
      const res = await apiGet("/notifications", {
        headers: authHeaders,
        params: { page: p, limit, unreadOnly },
      });

      const list = Array.isArray(res?.data?.data) ? res.data.data : [];
      setItems(list);

      const meta = res?.data?.meta || {};
      setTotalPages(meta.totalPages || 1);

      toast.dismiss(t);
      refreshUnread();
    } catch (e) {
      toast.error(e?.response?.data?.error || "Failed to load notifications", {
        id: t,
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (authLoading) return;
    load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, unreadOnly, canLoad]);

  async function markRead(id) {
    const t = toast.loading("Marking as read...");
    try {
      await apiPost(`/notifications/${id}/read`, {}, { headers: authHeaders });
      toast.success("Marked as read", { id: t });
      load(page);
      refreshUnread();
    } catch (e) {
      toast.error(e?.response?.data?.error || "Failed", { id: t });
    }
  }

  async function readAll() {
    const t = toast.loading("Marking all as read...");
    try {
      await apiPost("/notifications/read-all", {}, { headers: authHeaders });
      toast.success("All marked as read", { id: t });
      load(1);
      refreshUnread();
    } catch (e) {
      toast.error(e?.response?.data?.error || "Failed", { id: t });
    }
  }

  async function remove(id) {
    const t = toast.loading("Deleting...");
    try {
      await apiDelete(`/notifications/${id}`, { headers: authHeaders });
      toast.success("Deleted", { id: t });
      load(page);
      refreshUnread();
    } catch (e) {
      toast.error(e?.response?.data?.error || "Failed", { id: t });
    }
  }

  if (!canLoad) {
    return <div className="text-sm text-slate-300">Login required.</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <h1 className="text-lg font-semibold text-slate-100">Notifications</h1>

        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-300 flex items-center gap-2">
            <input
              type="checkbox"
              checked={unreadOnly}
              onChange={(e) => setUnreadOnly(e.target.checked)}
            />
            Unread only
          </label>

          <button
            onClick={readAll}
            className="px-3 py-2 rounded-xl border border-slate-700 text-xs hover:bg-slate-800"
            type="button"
          >
            Read all
          </button>

          <button
            onClick={() => load(page)}
            className="px-3 py-2 rounded-xl border border-slate-700 text-xs hover:bg-slate-800"
            type="button"
          >
            Refresh
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/40 overflow-hidden">
        {items.length === 0 && !loading ? (
          <div className="p-4 text-sm text-slate-400">No notifications.</div>
        ) : (
          <ul className="divide-y divide-slate-800">
            {items.map((n) => (
              <li key={n._id} className="p-4 flex gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="text-sm font-semibold text-slate-100 truncate">
                      {n.title || "Notification"}
                    </div>
                    {!n.read && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500 text-black">
                        NEW
                      </span>
                    )}
                  </div>

                  <div className="text-xs text-slate-300 mt-1">
                    {n.message || ""}
                  </div>

                  <div className="text-[11px] text-slate-500 mt-2 flex flex-wrap gap-3">
                    <span>{fmtDate(n.createdAt)}</span>
                    {n.type ? <span>Type: {n.type}</span> : null}
                    {n.requestId ? <span>Request: {n.requestId}</span> : null}
                  </div>
                </div>

                <div className="flex flex-col gap-2 items-end">
                  {!n.read && (
                    <button
                      onClick={() => markRead(n._id)}
                      className="px-3 py-1.5 rounded-lg bg-emerald-500 text-black text-xs"
                      type="button"
                    >
                      Mark read
                    </button>
                  )}
                  <button
                    onClick={() => remove(n._id)}
                    className="px-3 py-1.5 rounded-lg border border-slate-700 text-xs hover:bg-slate-800"
                    type="button"
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* pagination */}
      <div className="flex items-center justify-between text-xs text-slate-300">
        <button
          disabled={page <= 1}
          onClick={() => {
            const p = Math.max(1, page - 1);
            setPage(p);
            load(p);
          }}
          className="px-3 py-2 rounded-xl border border-slate-700 disabled:opacity-50"
          type="button"
        >
          Prev
        </button>

        <span>
          Page {page} / {totalPages}
        </span>

        <button
          disabled={page >= totalPages}
          onClick={() => {
            const p = Math.min(totalPages, page + 1);
            setPage(p);
            load(p);
          }}
          className="px-3 py-2 rounded-xl border border-slate-700 disabled:opacity-50"
          type="button"
        >
          Next
        </button>
      </div>
    </div>
  );
}
