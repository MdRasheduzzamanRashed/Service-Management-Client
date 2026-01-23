"use client";

import { useContext, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { AuthContext } from "../../context/AuthContext";
import { apiGet, apiPost } from "../../lib/api";

function fmtTime(v) {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

export default function NotificationsPage() {
  const router = useRouter();
  const { authHeaders, loading: authLoading, user } = useContext(AuthContext);

  const role = useMemo(() => user?.role || "", [user]);
  const canLoad = !!authHeaders?.["x-user-role"];

  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [unreadOnly, setUnreadOnly] = useState(false);

  const unreadCount = useMemo(
    () => (list || []).filter((n) => !n?.read).length,
    [list],
  );

  async function load() {
    if (!canLoad) return;
    setLoading(true);
    const t = toast.loading("Loading notifications...");
    try {
      const res = await apiGet("/notifications", {
        headers: authHeaders,
        params: { unreadOnly: unreadOnly ? 1 : 0, limit: 100 },
      });

      const payload = res?.data;
      const rows = Array.isArray(payload?.data) ? payload.data : [];
      setList(rows);

      toast.success("Loaded", { id: t });
    } catch (e) {
      toast.error(e?.response?.data?.error || "Failed to load", { id: t });
    } finally {
      setLoading(false);
    }
  }

  async function markRead(id) {
    if (!id) return;
    const t = toast.loading("Marking read...");
    try {
      await apiPost(`/notifications/${id}/read`, {}, { headers: authHeaders });
      setList((prev) =>
        prev.map((x) =>
          String(x?._id) === String(id) ? { ...x, read: true } : x,
        ),
      );
      toast.success("Marked read", { id: t });
    } catch (e) {
      toast.error(e?.response?.data?.error || "Failed", { id: t });
    }
  }

  async function markAllRead() {
    const t = toast.loading("Marking all read...");
    try {
      await apiPost("/notifications/read-all", {}, { headers: authHeaders });
      setList((prev) => prev.map((x) => ({ ...x, read: true })));
      toast.success("All marked read", { id: t });
    } catch (e) {
      toast.error(e?.response?.data?.error || "Failed", { id: t });
    }
  }

  useEffect(() => {
    if (authLoading) return;
    if (!canLoad) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, canLoad, unreadOnly]);

  if (authLoading) {
    return <div className="p-6 text-slate-300">Loading session...</div>;
  }

  if (!canLoad) {
    return (
      <div className="p-6 text-slate-300">
        Missing auth headers. Please logout/login again.
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-4">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-slate-100">
            Notifications
          </h1>
          <p className="text-xs text-slate-400">
            Role: <span className="text-slate-200">{String(role)}</span> ·
            Unread:{" "}
            <span className="text-emerald-300 font-semibold">
              {unreadCount}
            </span>
          </p>
        </div>

        <div className="flex gap-2 items-center">
          <button
            type="button"
            onClick={() => setUnreadOnly((v) => !v)}
            className="px-3 py-2 rounded-xl border border-slate-700 text-sm hover:bg-slate-800"
          >
            {unreadOnly ? "Show All" : "Show Unread"}
          </button>

          <button
            type="button"
            onClick={markAllRead}
            disabled={loading || list.length === 0}
            className="px-3 py-2 rounded-xl bg-emerald-500 text-black text-sm disabled:opacity-60"
          >
            Mark all read
          </button>

          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="px-3 py-2 rounded-xl border border-slate-700 text-sm hover:bg-slate-800 disabled:opacity-60"
          >
            Refresh
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/40 overflow-hidden">
        {(list || []).map((n) => {
          const id = String(n?._id || "");
          const isUnread = !n?.read;
          const requestId = String(n?.requestId || "").trim();

          return (
            <div
              key={id}
              className={`border-t border-slate-800 p-4 flex items-start justify-between gap-3 ${
                isUnread ? "bg-slate-950/30" : ""
              }`}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  {isUnread && (
                    <span className="inline-block w-2 h-2 rounded-full bg-emerald-400" />
                  )}
                  <p className="text-sm font-semibold text-slate-100 truncate">
                    {n?.title || "Notification"}
                  </p>
                  <span className="text-[10px] px-2 py-0.5 rounded-full border border-slate-700 bg-slate-900 text-slate-300">
                    {String(n?.type || "INFO")}
                  </span>
                </div>

                <p className="text-sm text-slate-300 mt-1 break-words">
                  {n?.message || "—"}
                </p>

                <p className="text-[11px] text-slate-500 mt-2">
                  {fmtTime(n?.createdAt)}
                </p>
              </div>

              <div className="flex flex-col gap-2 shrink-0">
                {requestId ? (
                  <button
                    type="button"
                    onClick={() => router.push(`/requests/${requestId}`)}
                    className="px-3 py-2 rounded-xl border border-slate-700 text-xs hover:bg-slate-800"
                  >
                    Open Request
                  </button>
                ) : null}

                {isUnread ? (
                  <button
                    type="button"
                    onClick={() => markRead(id)}
                    className="px-3 py-2 rounded-xl bg-slate-800 text-xs text-slate-100 hover:bg-slate-700"
                  >
                    Mark read
                  </button>
                ) : (
                  <span className="text-[11px] text-slate-500 text-right">
                    Read
                  </span>
                )}
              </div>
            </div>
          );
        })}

        {!loading && list.length === 0 && (
          <div className="p-6 text-sm text-slate-400">
            No notifications found.
          </div>
        )}

        {loading && (
          <div className="p-6 text-sm text-slate-400">Loading...</div>
        )}
      </div>
    </div>
  );
}
