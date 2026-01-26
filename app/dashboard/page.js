"use client";

import { Suspense, useContext, useMemo } from "react";
import { AuthContext } from "../../context/AuthContext";

import DashboardProjectsCard from "../../components/DashboardProjectsCard";
import DashboardContractsCard from "../../components/DashboardContractsCard";
import DashboardRequestsCard from "../../components/DashboardRequestsCard";

import RequestList from "../../components/RequestList";
import MyOrdersPage from "../orders/page";
import Projects from "../projects/page";

function normalizeRole(raw) {
  const s = String(raw || "").trim();
  if (!s) return "";
  return s.toUpperCase().replace(/\s+/g, "_");
}

function DashboardContent() {
  const { user, loading } = useContext(AuthContext);

  const role = useMemo(() => normalizeRole(user?.role), [user?.role]);

  const isPM = role === "PROJECT_MANAGER";
  const isRP = role === "RESOURCE_PLANNER";
  const isPO = role === "PROCUREMENT_OFFICER";
  const isAdmin = role === "SYSTEM_ADMIN";

  const canSeeAll = isAdmin;

  if (loading) {
    return (
      <main className="p-4 sm:p-6 text-sm text-slate-300">
        Loading dashboard…
      </main>
    );
  }

  return (
    <main className="space-y-6 p-3 sm:p-4 lg:p-6">
      {/* ✅ Top summary cards (responsive grid) */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <DashboardProjectsCard />
        <DashboardContractsCard />
        <DashboardRequestsCard variant="my" />
        <DashboardRequestsCard variant="all" />
      </section>

      <section className="space-y-6">
        {/* PM/Admin */}
        {(isPM || canSeeAll) && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-3 sm:p-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <h2 className="text-sm font-semibold text-slate-100">
                  Requests
                </h2>

                <a
                  href="/requests"
                  className="w-full sm:w-auto text-center text-xs px-3 py-2 rounded-xl border border-slate-700 hover:bg-slate-800"
                >
                  Open All Requests
                </a>
              </div>

              <div className="mt-3">
                <RequestList view="all" />
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-3 sm:p-4">
              <Projects />
            </div>
          </div>
        )}

        {/* ✅ PO/Admin (but not PM) — PO is Reviewer + Evaluator after swap */}
        {(isPO || canSeeAll) && !isPM && (
          <div className="space-y-4">
            {/* IN_REVIEW (Reviewer = PO) */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-3 sm:p-4">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <h2 className="text-sm font-semibold text-slate-100">
                  Requests In Review
                </h2>
                <a
                  href="/requests?status=IN_REVIEW"
                  className="text-xs px-3 py-2 rounded-xl border border-slate-700 hover:bg-slate-800"
                >
                  Open
                </a>
              </div>
              <div className="mt-3">
                <RequestList view="review" />
              </div>
            </div>

            {/* BID_EVALUATION (Evaluator = PO) */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-3 sm:p-4">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <h2 className="text-sm font-semibold text-slate-100">
                  Requests For Evaluation
                </h2>
                <a
                  href="/requests?status=BID_EVALUATION"
                  className="text-xs px-3 py-2 rounded-xl border border-slate-700 hover:bg-slate-800"
                >
                  Open
                </a>
              </div>
              <div className="mt-3">
                <RequestList view="bid-evaluation" />
              </div>
            </div>

            {/* All */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-3 sm:p-4">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <h2 className="text-sm font-semibold text-slate-100">
                  All Requests
                </h2>
                <a
                  href="/requests"
                  className="text-xs px-3 py-2 rounded-xl border border-slate-700 hover:bg-slate-800"
                >
                  Open
                </a>
              </div>
              <div className="mt-3">
                <RequestList view="all" />
              </div>
            </div>
          </div>
        )}

        {/* ✅ RP/Admin (but not PM and not PO) — RP is Ordering role after swap */}
        {(isRP || canSeeAll) && !isPM && !isPO && (
          <div className="space-y-4">
            {/* Orders (Ordering role = RP) */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-3 sm:p-4">
              <MyOrdersPage />
            </div>

            {/* Requests ready for ordering (SENT_TO_RP) */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-3 sm:p-4">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <h2 className="text-sm font-semibold text-slate-100">
                  Requests Ready for Ordering
                </h2>
                <a
                  href="/requests?status=SENT_TO_RP"
                  className="text-xs px-3 py-2 rounded-xl border border-slate-700 hover:bg-slate-800"
                >
                  Open
                </a>
              </div>
              <div className="mt-3">
                <RequestList view="ordering" />
              </div>
            </div>

            {/* All */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-3 sm:p-4">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <h2 className="text-sm font-semibold text-slate-100">
                  All Requests
                </h2>
                <a
                  href="/requests"
                  className="text-xs px-3 py-2 rounded-xl border border-slate-700 hover:bg-slate-800"
                >
                  Open
                </a>
              </div>
              <div className="mt-3">
                <RequestList view="all" />
              </div>
            </div>
          </div>
        )}

        {/* Admin note */}
        {canSeeAll && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-3 sm:p-4">
            <h2 className="text-sm font-semibold text-slate-100">
              System Admin Note
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              You can view everything (Projects, Contracts, Requests, Orders,
              Notifications).
            </p>
          </div>
        )}
      </section>
    </main>
  );
}

export default function Dashboard() {
  return (
    <Suspense
      fallback={
        <main className="p-4 sm:p-6 text-sm text-slate-300">Loading…</main>
      }
    >
      <DashboardContent />
    </Suspense>
  );
}
