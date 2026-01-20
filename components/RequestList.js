"use client";

import { useEffect, useState, useContext, useMemo, useCallback } from "react";
import Link from "next/link";
import { AuthContext } from "../context/AuthContext";
import { apiGet } from "../lib/api";

function normalizeRole(raw) {
  return String(raw || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_");
}

export default function RequestList({ view = "pm" }) {
  const { user, authHeaders, loading: authLoading } = useContext(AuthContext);

  const [requests, setRequests] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const role = useMemo(() => normalizeRole(user?.role), [user?.role]);

  const canSeeList = useMemo(() => {
    return (
      role === "PROJECT_MANAGER" ||
      role === "PROCUREMENT_OFFICER" ||
      role === "RESOURCE_PLANNER" ||
      role === "SYSTEM_ADMIN"
    );
  }, [role]);

  const headersReady = !!authHeaders?.["x-user-role"];

  const load = useCallback(async () => {
    if (!canSeeList) return;
    if (!headersReady) return;

    try {
      setError("");
      setLoading(true);

      const params = {};
      if (view === "procurement") params.status = "IN_REVIEW";
      if (view === "planner") params.status = "EVALUATING";

      const res = await apiGet("/requests", {
        params,
        headers: authHeaders,
      });

      const list = Array.isArray(res?.data)
        ? res.data
        : Array.isArray(res)
          ? res
          : [];

      setRequests(list);
    } catch (err) {
      setRequests([]);
      setError(
        err?.response?.data?.error || err?.message || "Error loading requests",
      );
    } finally {
      setLoading(false);
    }
  }, [authHeaders, canSeeList, headersReady, view]);

  useEffect(() => {
    if (authLoading) return;
    load();
  }, [authLoading, load]);

  if (authLoading) {
    return (
      <div className="p-4">
        <p className="text-xs text-slate-300">Loading session...</p>
      </div>
    );
  }

  if (!canSeeList) {
    return (
      <div className="p-4">
        <p className="text-xs text-red-400">Not allowed to view requests.</p>
        <p className="mt-1 text-[11px] text-slate-400">
          Your role:{" "}
          <span className="text-slate-200">{String(user?.role || "-")}</span>
        </p>
      </div>
    );
  }

  if (!headersReady) {
    return (
      <div className="p-4">
        <p className="text-xs text-amber-300">
          Missing auth header x-user-role. Please logout/login again.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-sm font-semibold">
          {view === "pm"
            ? "All Service Requests"
            : view === "procurement"
              ? "Requests in Review"
              : "Requests in Evaluation"}
        </h2>

        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="text-xs px-3 py-1 rounded-full border border-slate-700 hover:bg-slate-800 disabled:opacity-60"
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}

      <div className="space-y-2">
        {requests.map((r) => (
          <Link
            key={r._id}
            href={`/requests/${r._id}`}
            className="block rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2 text-sm hover:border-emerald-400 hover:bg-slate-900 transition"
          >
            <div className="flex items-center justify-between">
              <span className="font-medium">{r.title || "Untitled"}</span>
              <span className="text-[11px] px-2 py-1 rounded-full bg-slate-800 border border-slate-700">
                {r.status || "—"}
              </span>
            </div>
          </Link>
        ))}

        {!loading && requests.length === 0 && (
          <p className="text-xs text-slate-400">No requests found.</p>
        )}
      </div>
    </div>
  );
}
