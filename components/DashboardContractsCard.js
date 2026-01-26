"use client";

import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

const CONTRACTS_API = process.env.NEXT_PUBLIC_CONTRACTS_API;
const TOAST_ID = "contracts-loading";

/* =========================
   Helpers
========================= */
function extractList(payload) {
  return (
    (Array.isArray(payload) && payload) ||
    (Array.isArray(payload?.data) && payload.data) ||
    (Array.isArray(payload?.contracts) && payload.contracts) ||
    (Array.isArray(payload?.items) && payload.items) ||
    []
  );
}

function idStr(x) {
  if (!x) return "";
  if (typeof x === "string") return x;
  if (x?.$oid) return String(x.$oid);
  try {
    return String(x);
  } catch {
    return "";
  }
}

function toTime(v) {
  if (!v) return null;
  const t = new Date(v).getTime();
  return Number.isFinite(t) ? t : null;
}

function computeStatus(c) {
  // 1) use API status if available
  const raw = String(c?.status || "")
    .trim()
    .toUpperCase();
  if (raw) return raw;

  // 2) if approvedAt exists, treat as APPROVED
  const approvedAt = c?.workflow?.finalApproval?.approvedAt;
  if (approvedAt) return "APPROVED";

  // 3) derive from endDate if exists
  const end = toTime(c?.endDate);
  if (end != null) return end < Date.now() ? "EXPIRED" : "ACTIVE";

  return "UNKNOWN";
}

function normalizeContract(raw) {
  const c = raw || {};
  const id =
    idStr(c?.id) ||
    idStr(c?._id) ||
    idStr(c?.contractId) ||
    idStr(c?.referenceNumber);

  return {
    id,
    title:
      c?.title ||
      c?.contractTitle ||
      c?.name ||
      c?.referenceNumber ||
      c?.contractId ||
      "Untitled",
    supplier:
      c?.supplier ||
      c?.supplierName ||
      c?.workflow?.coordinator?.selectedOffer?.provider?.name ||
      "",
    status: computeStatus(c),
  };
}

function buildStatusCounts(items) {
  const m = new Map();
  for (const it of items || []) {
    const s =
      String(it?.status || "UNKNOWN")
        .trim()
        .toUpperCase() || "UNKNOWN";
    m.set(s, (m.get(s) || 0) + 1);
  }
  return Array.from(m.entries())
    .map(([status, count]) => ({ status, count }))
    .sort((a, b) => b.count - a.count);
}

function statusColor(status) {
  const s = String(status || "").toUpperCase();
  if (s === "ACTIVE") return "text-emerald-300";
  if (s === "APPROVED") return "text-teal-300";
  if (s === "EXPIRED") return "text-red-300";
  if (s === "DRAFT") return "text-amber-300";
  if (s.includes("REVIEW")) return "text-sky-300";
  if (s.includes("BID")) return "text-violet-300";
  if (s.includes("REJECT")) return "text-rose-300";
  return "text-slate-200";
}

function errToMsg(e) {
  if (!e) return "Failed to load contracts";
  const data = e?.response?.data;
  if (typeof data === "string" && data.trim()) return data;
  if (data?.message) return String(data.message);
  if (data?.error) return String(data.error);
  if (e?.message) return String(e.message);
  return "Failed to load contracts";
}

/* =========================
   Component
========================= */
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
      toast.loading("Loading contracts...", { id: TOAST_ID });

      try {
        if (!CONTRACTS_API)
          throw new Error("Missing NEXT_PUBLIC_CONTRACTS_API");

        const res = await axios.get(CONTRACTS_API, {
          headers: { Accept: "application/json" },
          params: { _t: Date.now() },
          timeout: 15000,
          signal: controller.signal,
        });

        const list = extractList(res?.data)
          .map(normalizeContract)
          .filter((c) => c.id);

        if (!alive) return;
        setContracts(list);
        toast.success("Contracts loaded", { id: TOAST_ID });
      } catch (e) {
        if (e?.name === "CanceledError" || e?.name === "AbortError") return;
        const msg = errToMsg(e);
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
      controller.abort();
      toast.dismiss(TOAST_ID);
    };
  }, []);

  const stats = useMemo(() => {
    const total = contracts.length;
    const statusRows = buildStatusCounts(contracts);
    return { total, statusRows };
  }, [contracts]);

  return (
    <div
      className="relative z-30 overflow-visible group w-full max-w-sm cursor-pointer"
      onClick={() => router.push("/contracts")}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && router.push("/contracts")}
    >
      {/* MAIN CARD */}
      <div className="rounded-xl border border-emerald-500/40 bg-slate-900/60 p-4 text-center transition hover:border-emerald-400">
        <h3 className="text-lg text-slate-200 font-medium">Contracts</h3>

        {loading ? (
          <div className="mt-2 text-xs font-semibold text-slate-200">
            Loading...
          </div>
        ) : err ? (
          <div className="mt-2 text-xs text-red-300 break-words">{err}</div>
        ) : (
          <>
            <div className="mt-1 text-lg font-semibold text-slate-50">
              Total: {stats.total}
            </div>
          </>
        )}
      </div>

      {/* HOVER: ✅ dynamic statuses from API */}
      {!loading && !err && (
        <div className="absolute left-1/2 top-full z-[999] mt-3 w-[92vw] max-w-sm -translate-x-1/2 opacity-0 translate-y-1 scale-95 transition-all duration-200 group-hover:opacity-100 group-hover:translate-y-0 group-hover:scale-100">
          {/* Arrow */}
          <div className="mx-auto h-3 w-3 rotate-45 border-l border-t border-slate-800 bg-slate-950/95" />

          <div className="rounded-2xl border border-slate-800 bg-slate-950/95 p-4 shadow-2xl">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-slate-400">Status breakdown</span>
              <span className="text-xs text-slate-400">
                Total: <span className="text-slate-200">{stats.total}</span>
              </span>
            </div>

            {stats.statusRows.length === 0 ? (
              <div className="text-[11px] text-slate-400 py-2">
                No status data.
              </div>
            ) : (
              <div className="space-y-2">
                {stats.statusRows.map((x) => (
                  <div
                    key={x.status}
                    className="flex items-center justify-between"
                  >
                    <span
                      className={`text-sm font-medium ${statusColor(x.status)}`}
                    >
                      {x.status}
                    </span>
                    <span className="text-sm font-semibold text-slate-100 tabular-nums">
                      {x.count}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
