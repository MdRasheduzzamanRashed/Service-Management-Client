"use client";

import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useRouter } from "next/navigation";

const CONTRACTS_API = process.env.NEXT_PUBLIC_CONTRACTS_API;

export default function DashboardContractsCard() {
  const router = useRouter();

  const [contracts, setContracts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    let alive = true;

    async function load() {
      setLoading(true);
      setErr("");

      try {
        const res = await axios.get(CONTRACTS_API);
        if (alive) setContracts(res.data || []);
      } catch (e) {
        if (!alive) return;
        setErr(e?.message || "Failed to load contracts");
      } finally {
        if (alive) setLoading(false);
      }
    }

    load();
    return () => {
      alive = false;
    };
  }, []);

  const stats = useMemo(() => {
    const total = contracts.length;

    const active = contracts.filter(
      (c) => String(c?.status).toLowerCase() === "active",
    ).length;

    const expired = contracts.filter(
      (c) => String(c?.status).toLowerCase() === "expired",
    ).length;

    return { total, active, expired };
  }, [contracts]);

  return (
    <div
      className="relative group w-full max-w-sm cursor-pointer"
      onClick={() => router.push("/contracts")}
    >
      {/* MAIN CARD */}
      <div className="bg-slate-700 rounded-xl p-4 border border-slate-600 hover:border-emerald-400 hover:bg-slate-600/80 transition">
        <h3 className="text-sm text-slate-200 font-medium">Contracts</h3>

        {loading ? (
          <h2 className="mt-1 text-2xl font-semibold text-white">Loading...</h2>
        ) : err ? (
          <div className="mt-2 text-xs text-red-300">{err}</div>
        ) : (
          <h2 className="mt-1 text-2xl font-semibold text-white">
            Total: {stats.total}
          </h2>
        )}
      </div>

      {/* HOVER DETAILS */}
      {!loading && !err && (
        <div className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 w-56 -translate-x-1/2 rounded-xl border border-slate-700 bg-slate-900 p-3 text-xs text-slate-200 opacity-0 shadow-xl transition-all duration-200 group-hover:opacity-100 group-hover:translate-y-1">
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Active</span>
            <span className="text-emerald-400 font-semibold">
              {stats.active}
            </span>
          </div>

          <div className="mt-2 flex items-center justify-between">
            <span className="text-slate-400">Expired</span>
            <span className="text-red-400 font-semibold">{stats.expired}</span>
          </div>
        </div>
      )}
    </div>
  );
}
