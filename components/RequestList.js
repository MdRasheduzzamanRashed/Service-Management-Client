"use client";

import { useEffect, useState, useContext, useMemo, useCallback } from "react";
import axios from "axios";
import Link from "next/link";
import { AuthContext } from '../context/AuthContext';


const API_BASE = "http://localhost:8000";

export default function RequestList({ view = "pm" }) {
  const { user, authHeaders, loading: authLoading } = useContext(AuthContext);

  const [requests, setRequests] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const canSeeList = useMemo(() => {
    const role = user?.role;
    return (
      role === "ProjectManager" ||
      role === "ProcurementOfficer" ||
      role === "ResourcePlanner" ||
      role === "System"
    );
  }, [user]);

  const headersReady =
    !!authHeaders?.["x-user-id"] && !!authHeaders?.["x-user-role"];

  const load = useCallback(async () => {
    if (!canSeeList) return;
    if (!headersReady) return;

    try {
      setError("");
      setLoading(true);

      // ✅ If you want filtering by view, keep it:
      const params = {};
      if (view === "procurement") params.status = "in_review";
      if (view === "planner") params.status = "evaluating";

      const res = await axios.get(API_BASE + "/api/requests", {
        params,
        headers: authHeaders, // ✅ FIX
      });

      setRequests(res.data || []);
    } catch (err) {
      setRequests([]);
      setError(err?.response?.data?.error || "Error loading requests");
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
      </div>
    );
  }

  if (!headersReady) {
    return (
      <div className="p-4">
        <p className="text-xs text-amber-300">
          Missing auth headers. Please login again.
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
              <span className="font-medium">{r.title}</span>
              <span className="text-[11px] px-2 py-1 rounded-full bg-slate-800 border border-slate-700">
                {r.status}
              </span>
            </div>

            {r.submissionWindowOpen && (
              <p className="text-[11px] text-emerald-300 mt-1">
                Supplier submission window is open
              </p>
            )}
          </Link>
        ))}

        {!loading && requests.length === 0 && (
          <p className="text-xs text-slate-400">No requests found.</p>
        )}
      </div>
    </div>
  );
}
