"use client";

import { useContext, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AuthContext } from "../../context/AuthContext";
import ServiceRequestForm from "../../components/ServiceRequestForm";
import RequestList from "../../components/RequestList";

function normalizeRole(raw) {
  return String(raw || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_");
}

export default function RequestsClient() {
  const { user, loading } = useContext(AuthContext);
  const sp = useSearchParams();

  const [showForm, setShowForm] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  const role = useMemo(() => normalizeRole(user?.role), [user?.role]);

  const isPM = role === "PROJECT_MANAGER";
  const isPO = role === "PROCUREMENT_OFFICER"; // ✅ swapped reviewer
  const isAdmin = role === "SYSTEM_ADMIN";

  const viewParam = (sp.get("view") || "").toLowerCase();

  const listView = useMemo(() => {
    // PM can see their own requests
    if (isPM && viewParam === "my") return "my";

    // ✅ Review queue is for PO (and Admin)
    if ((isPO || isAdmin) && viewParam === "review") return "review";

    // default
    return "all";
  }, [isPM, isPO, isAdmin, viewParam]);

  if (loading) return <div className="p-6 text-slate-300">Loading...</div>;

  if (!user) {
    return (
      <div className="p-6 text-slate-300">
        Not authenticated. Go to{" "}
        <a href="/auth/login" className="text-emerald-400">
          Login
        </a>
        .
      </div>
    );
  }

  const viewLabel =
    listView === "my"
      ? "My Requests"
      : listView === "review"
        ? "Review Queue"
        : "All Requests";

  return (
    <main className="space-y-5">
      {/* Header: show for PM (create) or PO/Admin (review label) */}
      {(isPM || isPO || isAdmin) && !showForm && (
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm text-slate-300">
            Showing:{" "}
            <span className="text-slate-100 font-semibold">{viewLabel}</span>
          </div>

          {/* ✅ Only PM can create requests */}
          {isPM && (
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="px-4 py-2 rounded-xl bg-emerald-500 text-black text-sm shadow hover:bg-emerald-400"
            >
              + New Service Request
            </button>
          )}
        </div>
      )}

      {/* ✅ Only PM can open the form */}
      {isPM && showForm && (
        <ServiceRequestForm
          onCreated={() => {
            setReloadToken((t) => t + 1);
            setShowForm(false);
          }}
          onCancel={() => setShowForm(false)}
        />
      )}

      <RequestList key={`${reloadToken}-${listView}`} view={listView} />
    </main>
  );
}
