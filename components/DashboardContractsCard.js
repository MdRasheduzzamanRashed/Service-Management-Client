"use client";

import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

const CONTRACTS_API = process.env.NEXT_PUBLIC_CONTRACTS_API;
const TOAST_ID = "contracts-loading";

export default function DashboardContractsCard() {
  const router = useRouter();

  const [contracts, setContracts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    let alive = true;

    async function load() {
      setLoading(true);
      setErr("");

      // ✅ one toast only (same id every time)
      toast.loading("Loading contracts...", { id: TOAST_ID });

      try {
        if (!CONTRACTS_API)
          throw new Error("Missing NEXT_PUBLIC_CONTRACTS_API");

        const res = await axios.get(CONTRACTS_API, {
          headers: { Accept: "application/json" },
          signal: controller.signal,
        });

        const data = res?.data;

        const list =
          (Array.isArray(data) && data) ||
          (Array.isArray(data?.data) && data.data) ||
          (Array.isArray(data?.contracts) && data.contracts) ||
          [];

        if (!alive) return;

        setContracts(list);
        toast.success("Contracts loaded", { id: TOAST_ID });
      } catch (e) {
        // Abort is normal in dev StrictMode
        if (e?.name === "CanceledError" || e?.name === "AbortError") return;

        const msg =
          e?.response?.data?.error || e?.message || "Failed to load contracts";

        if (!alive) return;

        setContracts([]);
        setErr(msg);
        toast.error(msg, { id: TOAST_ID });
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    }

    load();

    return () => {
      alive = false;
      controller.abort(); // ✅ cancel first request in StrictMode
    };
  }, []);

  const stats = useMemo(() => {
    const total = contracts.length;
    const active = contracts.filter(
      (c) => String(c?.status || "").toLowerCase() === "active",
    ).length;
    const expired = contracts.filter(
      (c) => String(c?.status || "").toLowerCase() === "expired",
    ).length;
    return { total, active, expired };
  }, [contracts]);

  return (
    <div
      className="relative z-10 overflow-visible group w-full max-w-sm cursor-pointer"
      onClick={() => router.push("/contracts")}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && router.push("/contracts")}
    >
      {/* MAIN CARD */}
      <div className="rounded-xl border border-emerald-500/40 bg-slate-900/60 p-3 text-center transition hover:border-emerald-400">
        <h3 className="text-lg text-slate-200 font-medium">Contracts</h3>

        {loading ? (
          <h2 className="mt-1 text-xs font-semibold text-slate-200">
            Loading...
          </h2>
        ) : err ? (
          <div className="mt-2 text-xs text-red-300">{err}</div>
        ) : (
          <h2 className="mt-1 text-lg font-semibold text-slate-50">
            Total: {stats.total}
          </h2>
        )}
      </div>

      {/* HOVER DETAILS */}
      {!loading && !err && (
        <div className="pointer-events-none absolute left-1/2 top-full z-50 mt-3 w-56 -translate-x-1/2 translate-y-2 opacity-0 rounded-xl border border-slate-700 bg-slate-900 p-3 text-xs text-slate-200 shadow-xl transition-all duration-200 group-hover:opacity-100 group-hover:translate-y-0">
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Active</span>
            <span className="text-emerald-300 font-semibold">
              {stats.active}
            </span>
          </div>

          <div className="mt-2 flex items-center justify-between">
            <span className="text-slate-400">Expired</span>
            <span className="text-red-300 font-semibold">{stats.expired}</span>
          </div>
        </div>
      )}
    </div>
  );
}
