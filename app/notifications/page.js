"use client";

import Link from "next/link";
import { useContext, useEffect, useMemo, useState } from "react";
import { NotificationContext } from "../../context/NotificationContext";

function fmtDate(v) {
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

function normalizeId(raw) {
  if (!raw) return "";
  if (typeof raw === "string") return raw;
  if (raw?.$oid) return String(raw.$oid);
  try {
    return String(raw);
  } catch {
    return "";
  }
}

export default function NotificationsPage() {
  const {
    notifications,
    loading,
    refreshList,
    markRead,
    markAllRead,
    unreadCount,
  } = useContext(NotificationContext);

  const [tab, setTab] = useState("all"); // all | unread

  useEffect(() => {
    refreshList({ unreadOnly: tab === "unread" });
  }, [tab, refreshList]);

  const list = useMemo(() => notifications || [], [notifications]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-100">
            Notifications
          </h1>
          <p className="text-xs text-slate-400">
            Unread: <span className="text-slate-200">{unreadCount}</span>
          </p>
        </div>

        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setTab("all")}
            className={
              "px-3 py-2 rounded-xl text-xs border " +
              (tab === "all"
                ? "border-emerald-400 bg-emerald-500/10 text-emerald-200"
                : "border-slate-700 hover:bg-slate-900 text-slate-200")
            }
            type="button"
          >
            All
          </button>

          <button
            onClick={() => setTab("unread")}
            className={
              "px-3 py-2 rounded-xl text-xs border " +
              (tab === "unread"
                ? "border-emerald-400 bg-emerald-500/10 text-emerald-200"
                : "border-slate-700 hover:bg-slate-900 text-slate-200")
            }
            type="button"
          >
            Unread
          </button>

          <button
            onClick={() => refreshList({ unreadOnly: tab === "unread" })}
            className="px-3 py-2 rounded-xl text-xs border border-slate-700 hover:bg-slate-900 text-slate-200"
            type="button"
            disabled={loading}
          >
            {loading ? "Loading..." : "Refresh"}
          </button>

          <button
            onClick={markAllRead}
            className="px-3 py-2 rounded-xl text-xs bg-emerald-500 text-black hover:bg-emerald-400"
            type="button"
            disabled={unreadCount <= 0}
          >
            Mark all read
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/40 overflow-hidden">
        {list.length === 0 && !loading ? (
          <div className="p-6 text-sm text-slate-400">
            No notifications found.
          </div>
        ) : null}

        <ul className="divide-y divide-slate-800">
          {list.map((n) => {
            const id = normalizeId(n?._id);
            const isRead = !!n?.read;
            const requestId = n?.requestId ? String(n.requestId) : "";

            return (
              <li
                key={id || `${n?.type}-${n?.createdAt}`}
                className={
                  "p-4 flex flex-col gap-1 " +
                  (isRead ? "opacity-70" : "bg-slate-950/20")
                }
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-slate-100">
                        {n?.title || "Notification"}
                      </span>

                      {!isRead && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500 text-black font-semibold">
                          NEW
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-slate-300 mt-1">
                      {n?.message || "—"}
                    </p>

                    <p className="text-[11px] text-slate-500 mt-2">
                      {fmtDate(n?.createdAt)}
                      {n?.type ? (
                        <>
                          {" "}
                          · <span className="text-slate-400">{n.type}</span>
                        </>
                      ) : null}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {requestId ? (
                      <Link
                        href={`/requests/${requestId}`}
                        className="text-xs px-3 py-1.5 rounded-lg border border-slate-700 hover:bg-slate-800 text-slate-200"
                      >
                        Open
                      </Link>
                    ) : null}

                    {!isRead ? (
                      <button
                        onClick={() => markRead(id)}
                        className="text-xs px-3 py-1.5 rounded-lg bg-slate-200 text-black hover:bg-white"
                        type="button"
                      >
                        Mark read
                      </button>
                    ) : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
