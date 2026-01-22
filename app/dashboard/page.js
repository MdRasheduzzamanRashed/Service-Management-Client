"use client";

import { useContext, useMemo } from "react";
import { AuthContext } from "../../context/AuthContext";

import DashboardProjectsCard from "../../components/DashboardProjectsCard";
import DashboardContractsCard from "../../components/DashboardContractsCard";
import DashboardRequestsCard from "../../components/DashboardRequestsCard";

import RequestList from "../../components/RequestList";
import ProjectsExplorer from "../projects/ProjectsExplorer";

function normalizeRole(raw) {
  const s = String(raw || "").trim();
  if (!s) return "";
  return s.toUpperCase().replace(/\s+/g, "_");
}

export default function Dashboard() {
  const { user, loading } = useContext(AuthContext);

  const role = useMemo(() => normalizeRole(user?.role), [user?.role]);

  const isPM = role === "PROJECT_MANAGER";
  const isRP = role === "RESOURCE_PLANNER";
  const isPO = role === "PROCUREMENT_OFFICER";
  const isAdmin = role === "SYSTEM_ADMIN";
  const isSP = role === "SERVICE_PROVIDER";

  // Admin sees everything
  const canSeeAll = isAdmin;

  if (loading) {
    return (
      <main className="p-6 text-sm text-slate-300">Loading dashboard…</main>
    );
  }

  return (
    <main className="space-y-6 p-4">
      {/* ✅ STATS CENTER */}
      <section className="flex justify-center">
        <div className="w-full max-w-6xl">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 place-items-center">
            <DashboardProjectsCard />
            <DashboardContractsCard />
            <DashboardRequestsCard variant="my" />
            <DashboardRequestsCard variant="all" />
          </div>
        </div>
      </section>

      {/* ✅ ROLE BASED CONTENT */}
      <section className="space-y-6">
        {/* ✅ SERVICE PROVIDER: only bidding page hint */}
        {isSP && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
            <h2 className="text-sm font-semibold text-slate-100">
              Service Provider Panel
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              You can view bidding requests only.
            </p>
            <div className="mt-3">
              <a
                href="/sp/bidding"
                className="inline-flex px-3 py-2 rounded-xl bg-emerald-500 text-black text-sm font-medium hover:bg-emerald-400"
              >
                Go to Bidding Requests
              </a>
            </div>
          </div>
        )}

        {/* ✅ PM: Projects + Requests */}
        {(isPM || canSeeAll) && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h2 className="text-sm font-semibold text-slate-100">
                  Requests
                </h2>
                <a
                  href="/requests"
                  className="text-xs px-3 py-1.5 rounded-lg border border-slate-700 hover:bg-slate-800"
                >
                  Open All Requests
                </a>
              </div>
              <div className="mt-3">
                <RequestList view="all" />
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h2 className="text-sm font-semibold text-slate-100">
                  Projects
                </h2>
                <a
                  href="/projects"
                  className="text-xs px-3 py-1.5 rounded-lg border border-slate-700 hover:bg-slate-800"
                >
                  Open All Projects
                </a>
              </div>
              <div className="mt-3">
                <ProjectsExplorer />
              </div>
            </div>
          </div>
        )}

        {/* ✅ RP: In Review + Recommended */}
        {(isRP || canSeeAll) && !isSP && !isPM && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
              <h2 className="text-sm font-semibold text-slate-100">
                Requests In Review
              </h2>
              <div className="mt-3">
                <RequestList view="review" />
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
              <h2 className="text-sm font-semibold text-slate-100">
                Recommended Requests
              </h2>
              <div className="mt-3">
                {/* ✅ Recommended list is filtered by status */}
                <RequestList view="all" />
              </div>
              <p className="text-[11px] text-slate-500 mt-2">
                Tip: use filter = RECOMMENDED in the Requests page.
              </p>
            </div>
          </div>
        )}

        {/* ✅ PO: Orders Requests */}
        {(isPO || canSeeAll) && !isSP && !isPM && !isRP && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h2 className="text-sm font-semibold text-slate-100">Orders</h2>
              <a
                href="/orders"
                className="text-xs px-3 py-1.5 rounded-lg border border-slate-700 hover:bg-slate-800"
              >
                Open Orders Page
              </a>
            </div>

            <p className="text-xs text-slate-400 mt-2">
              You can place orders for requests that are SENT_TO_PO.
            </p>

            {/* If you already have Orders page, just link above */}
            {/* Otherwise, we can show RequestList with status filter SENT_TO_PO */}
            <div className="mt-3">
              <RequestList view="all" />
            </div>
            <p className="text-[11px] text-slate-500 mt-2">
              Tip: filter status = SENT_TO_PO in Requests.
            </p>
          </div>
        )}

        {/* ✅ System Admin fallback */}
        {canSeeAll && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
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
