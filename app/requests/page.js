"use client";

import { useContext, useState } from "react";
import { AuthContext } from "../../context/AuthContext";
import ServiceRequestForm from "../../components/ServiceRequestForm";
import RequestList from "../../components/RequestList";

export default function RequestsPage() {
  const { user, loading } = useContext(AuthContext);

  const [showForm, setShowForm] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

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

  const isPM = user?.role === "PROJECT_MANAGER";

  return (
    <main className="space-y-5">
      {/* ✅ Only PM can see Create button */}
      {isPM && !showForm && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="px-4 py-2 rounded-xl bg-emerald-500 text-black text-sm shadow hover:bg-emerald-400"
          >
            + New Service Request
          </button>
        </div>
      )}

      {/* ✅ Form only for PM */}
      {isPM && showForm && (
        <ServiceRequestForm
          onCreated={() => {
            setReloadToken((t) => t + 1); // refresh list
            setShowForm(false); // close form
          }}
        />
      )}

      {/* ✅ List for PM/PO/RP/System (backend already filters) */}
      <RequestList key={reloadToken} />
    </main>
  );
}
