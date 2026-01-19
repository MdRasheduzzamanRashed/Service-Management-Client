"use client";

import { useEffect, useState } from "react";
import { apiGet } from "../../lib/api";

export default function ServiceOrdersPage() {
  const [orders, setOrders] = useState([]);
  const [error, setError] = useState("");

  async function load() {
    try {
      const res = await apiGet("/service-orders");
      setOrders(res.data);
    } catch (err) {
      setError(err?.response?.data?.error || "Error loading service orders");
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <main className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Service Orders</h1>
        <button
          onClick={load}
          className="text-xs px-3 py-1 rounded-full border border-slate-700 hover:bg-slate-800"
        >
          Refresh
        </button>
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}

      <div className="space-y-2">
        {orders.map((o) => (
          <div
            key={o._id}
            className="rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2 text-sm"
          >
            <div className="flex justify-between">
              <span className="font-medium">{o.title}</span>
              <span className="text-xs text-emerald-300">
                {o.contractValue} €
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Supplier: {o.supplierName} | Man Days: {o.manDays}
            </p>
          </div>
        ))}
        {orders.length === 0 && !error && (
          <p className="text-xs text-slate-400">No service orders found.</p>
        )}
      </div>
    </main>
  );
}
