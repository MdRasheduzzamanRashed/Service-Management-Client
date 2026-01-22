"use client";

import { useContext, useEffect, useMemo, useState } from "react";
import { AuthContext } from "../../context/AuthContext";
import { NotificationContext } from "../../context/NotificationContext";
import { apiGet } from "../../lib/api";

function getKey(n) {
  return (
    n?.uniqKey ||
    (n?._id && String(n._id)) ||
    (n?.id && String(n.id)) ||
    `${n?.type || "N"}:${n?.requestId || ""}:${n?.createdAt || ""}:${n?.title || ""}`
  );
}

function mergeUnique(primary = [], secondary = []) {
  // primary first (realtime), then API history
  const out = [];
  const seen = new Set();
  for (const item of [...primary, ...secondary]) {
    const k = getKey(item);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(item);
  }
  // newest first
  out.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  return out;
}

export default function NotificationsPage() {
  const { user, authHeaders } = useContext(AuthContext);
  const { notifications: liveNotifications, clearUnread } =
    useContext(NotificationContext);

  const [apiNotifications, setApiNotifications] = useState([]);
  const [error, setError] = useState("");
  const [loadingApi, setLoadingApi] = useState(false);

  useEffect(() => {
    if (!user) return;

    async function load() {
      try {
        setError("");
        setLoadingApi(true);

        const res = await apiGet("/notifications", {
          headers: authHeaders, // ✅ uses Bearer token from AuthContext
        });

        const list = Array.isArray(res?.data?.notifications)
          ? res.data.notifications
          : Array.isArray(res?.data)
            ? res.data
            : [];

        setApiNotifications(list);
      } catch (err) {
        setApiNotifications([]);
        setError(err?.response?.data?.error || "Error loading notifications");
      } finally {
        setLoadingApi(false);
      }
    }

    load();
    clearUnread();
  }, [user, authHeaders, clearUnread]);

  const merged = useMemo(
    () => mergeUnique(liveNotifications, apiNotifications),
    [liveNotifications, apiNotifications],
  );

  if (!user) {
    return (
      <main className="p-4 text-xs text-slate-300">
        Not authenticated. Go to{" "}
        <a href="/auth/login" className="text-emerald-400">
          Login
        </a>
        .
      </main>
    );
  }

  return (
    <main className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Notifications</h1>
          <p className="text-xs text-slate-400">
            Live updates for your account ({user.username || user.role})
          </p>
        </div>

        <button
          type="button"
          onClick={() => window.location.reload()}
          className="text-xs px-3 py-1.5 rounded-lg border border-slate-700 hover:bg-slate-800"
        >
          Refresh
        </button>
      </div>

      {error && (
        <p className="text-xs text-red-400 bg-red-950/40 border border-red-700/40 px-3 py-2 rounded-lg">
          {error}
        </p>
      )}

      {loadingApi && (
        <p className="text-xs text-slate-400">Loading notifications…</p>
      )}

      <div className="space-y-2">
        {merged.map((n) => (
          <div
            key={getKey(n)}
            className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-xs"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-medium text-slate-100">{n.title}</p>
                <p className="text-[11px] text-slate-300 mt-0.5">{n.message}</p>
              </div>
              <span className="text-[10px] text-slate-500 whitespace-nowrap">
                {n.createdAt ? new Date(n.createdAt).toLocaleString() : "—"}
              </span>
            </div>

            {n.requestId && (
              <a
                href={`/requests/${n.requestId}`}
                className="inline-flex mt-1 text-[11px] text-emerald-400 hover:underline"
              >
                Open related request
              </a>
            )}
          </div>
        ))}

        {merged.length === 0 && !error && !loadingApi && (
          <p className="text-xs text-slate-400">
            No notifications yet. They will appear here in real-time.
          </p>
        )}
      </div>
    </main>
  );
}
