"use client";

import { useContext, useMemo } from "react";
import { AuthContext } from "../../context/AuthContext";

import DashboardProjectsCard from "../../components/DashboardProjectsCard";
import DashboardContractsCard from "../../components/DashboardContractsCard";
import DashboardRequestsCard from "../../components/DashboardRequestsCard";

import RequestList from "../../components/RequestList";
import ProjectsExplorer from "../projects/ProjectsExplorer";
import MyOrdersPage from "../orders/page";

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
      <section className="flex justify-center gap-4 items-center">
        <DashboardProjectsCard />
        <DashboardContractsCard />
        <DashboardRequestsCard variant="my" />
        <DashboardRequestsCard variant="all" />
      </section>

      {/* ✅ ROLE BASED CONTENT */}
      <section className="space-y-6">
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
        {(isRP || canSeeAll) && !isPM && (
          <div className="space-y-4">
            <div className="mt-3">
              <RequestList view="review" />
            </div>

            <div className="mt-3">
              {/* ✅ Recommended list is filtered by status */}
              <RequestList view="all" />
            </div>
          </div>
        )}

        {/* ✅ PO: Orders Requests */}
        {(isPO || canSeeAll) && !isPM && !isRP && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4 space-y-4">
            <MyOrdersPage></MyOrdersPage>
            {/* If you already have Orders page, just link above */}
            {/* Otherwise, we can show RequestList with status filter SENT_TO_PO */}
            <RequestList view="all" />
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
