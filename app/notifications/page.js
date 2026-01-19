"use client";

import { useContext, useEffect, useState } from "react";
import { AuthContext } from "../../context/AuthContext";
import { NotificationContext } from "../../context/NotificationContext";
import { apiGet } from "../../lib/api";

export default function NotificationsPage() {
  const { user } = useContext(AuthContext);
  const { notifications, clearUnread } = useContext(NotificationContext);
  const [initialLoaded, setInitialLoaded] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) return;

    async function load() {
      try {
        const token = user.token;
        const res = await apiGet("/notifications", {
          headers: {
            Authorization: token ? `Bearer ${token}` : undefined,
          },
        });
        // We don't overwrite realtime notifications; just mark initial load done.
        setInitialLoaded(true);
      } catch (err) {
        setError(err?.response?.data?.error || "Error loading notifications");
      }
    }
    load();
    clearUnread();
  }, [user, clearUnread]);

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
            Live updates for your role ({user.role})
          </p>
        </div>
      </div>

      {error && (
        <p className="text-xs text-red-400 bg-red-950/40 border border-red-700/40 px-3 py-2 rounded-lg">
          {error}
        </p>
      )}

      <div className="space-y-2">
        {notifications.map((n) => (
          <div
            key={n._id || n.id}
            className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-xs"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-medium text-slate-100">{n.title}</p>
                <p className="text-[11px] text-slate-300 mt-0.5">
                  {n.message}
                </p>
              </div>
              <span className="text-[10px] text-slate-500 whitespace-nowrap">
                {new Date(n.createdAt).toLocaleString()}
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

        {notifications.length === 0 && !error && (
          <p className="text-xs text-slate-400">
            No notifications yet. They will appear here in real-time.
          </p>
        )}
      </div>
    </main>
  );
}
