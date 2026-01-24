"use client";

import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AuthContext } from "../../context/AuthContext";
import { apiGet } from "../../lib/api";

function roleUpper(x) {
  return String(x || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_");
}

function fmtDate(v) {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

function fmtMoney(v, currency = "EUR") {
  if (v === null || v === undefined || v === "") return "—";
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  return `${n.toLocaleString()} ${currency}`;
}

/* =========================
   UI helpers (NO logic changes)
========================= */
function SkeletonLine({ w = "w-full" }) {
  return <div className={`h-3 ${w} rounded bg-slate-800/70 animate-pulse`} />;
}

function OrderCardSkeleton() {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-2">
          <SkeletonLine w="w-2/3" />
          <SkeletonLine w="w-1/3" />
        </div>
        <div className="h-9 w-24 rounded-xl bg-slate-800/70 animate-pulse" />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-3 space-y-2">
          <SkeletonLine w="w-1/2" />
          <SkeletonLine w="w-2/3" />
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-3 space-y-2">
          <SkeletonLine w="w-1/2" />
          <SkeletonLine w="w-2/3" />
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-3 space-y-2">
          <SkeletonLine w="w-1/2" />
          <SkeletonLine w="w-2/3" />
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-3 space-y-2">
          <SkeletonLine w="w-1/2" />
          <SkeletonLine w="w-2/3" />
        </div>
      </div>
    </div>
  );
}

export default function MyOrdersPage() {
  const { user, authHeaders, loading: authLoading } = useContext(AuthContext);
  const role = useMemo(() => roleUpper(user?.role), [user?.role]);
  const isPO = role === "PROCUREMENT_OFFICER";
  const headersReady = !!authHeaders?.["x-user-role"] && !authLoading;

  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    if (!headersReady) return;
    if (!isPO) return;

    try {
      setErr("");
      setLoading(true);
      const res = await apiGet("/orders/my", { headers: authHeaders });
      setList(Array.isArray(res?.data) ? res.data : []);
    } catch (e) {
      setList([]);
      setErr(e?.response?.data?.error || e?.message || "Failed to load orders");
    } finally {
      setLoading(false);
    }
  }, [authHeaders, headersReady, isPO]);

  useEffect(() => {
    load();
  }, [load]);

  if (!headersReady) {
    return <div className="p-4 text-xs text-slate-300">Loading…</div>;
  }

  if (!isPO) {
    return (
      <div className="p-4">
        <div className="text-xs text-red-400">
          Only Procurement Officer can view orders.
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-3 sm:p-4 space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-100">My Orders</h2>
          <p className="text-[11px] text-slate-400">
            Total: <span className="text-slate-200">{list.length}</span>
          </p>
        </div>

        <button
          onClick={load}
          disabled={loading}
          className="w-full sm:w-auto px-3 py-2 rounded-xl border border-slate-700 text-sm hover:bg-slate-800 disabled:opacity-60 active:scale-[0.99]"
        >
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      {err && (
        <div className="rounded-xl border border-red-900/40 bg-red-950/20 px-3 py-2 text-xs text-red-200">
          {err}
        </div>
      )}

      {/* =========================
          Mobile/Tablet: Card Grid
          Desktop: Table (kept)
          (No logic changes)
      ========================= */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <OrderCardSkeleton key={i} />
          ))}
        </div>
      ) : !loading && list.length === 0 ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4 text-xs text-slate-400">
          No orders found.
        </div>
      ) : (
        <>
          {/* Cards on small screens */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 lg:hidden">
            {list.map((o) => {
              const id = String(o?._id || "");
              return (
                <div
                  key={id}
                  className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4 hover:bg-slate-950/55 transition"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-100 truncate">
                        {o?.snapshot?.requestTitle || o?.requestId || "—"}
                      </p>
                      <p className="mt-1 text-[11px] text-slate-500 break-all">
                        {o?.requestId || "—"}
                      </p>
                    </div>

                    <Link
                      href={`/requests/${o?.requestId}`}
                      className="shrink-0 text-xs px-3 py-2 rounded-xl border border-slate-700 hover:bg-slate-800 active:scale-[0.99]"
                    >
                      View
                    </Link>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-3">
                      <p className="text-[10px] uppercase tracking-wide text-slate-500">
                        Provider
                      </p>
                      <p className="mt-1 text-sm text-slate-100 truncate">
                        {o?.providerName || o?.providerUsername || "—"}
                      </p>
                    </div>

                    <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-3">
                      <p className="text-[10px] uppercase tracking-wide text-slate-500">
                        Price
                      </p>
                      <p className="mt-1 text-sm text-slate-100">
                        {fmtMoney(o?.totalPrice, o?.currency)}
                      </p>
                    </div>

                    <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-3">
                      <p className="text-[10px] uppercase tracking-wide text-slate-500">
                        Delivery
                      </p>
                      <p className="mt-1 text-sm text-slate-100">
                        {o?.deliveryDays != null
                          ? `${o.deliveryDays} days`
                          : "—"}
                      </p>
                    </div>

                    <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-3">
                      <p className="text-[10px] uppercase tracking-wide text-slate-500">
                        Ordered At
                      </p>
                      <p className="mt-1 text-sm text-slate-100">
                        {fmtDate(o?.orderedAt)}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Table on large screens (same data, better spacing) */}
          <div className="hidden lg:block overflow-x-auto rounded-xl border border-slate-800">
            <table className="min-w-[1000px] w-full text-sm">
              <thead className="bg-slate-950/60 text-[11px] text-slate-400">
                <tr>
                  <th className="px-3 py-2 text-left">Request</th>
                  <th className="px-3 py-2 text-left">Provider</th>
                  <th className="px-3 py-2 text-left">Price</th>
                  <th className="px-3 py-2 text-left">Delivery</th>
                  <th className="px-3 py-2 text-left">Ordered At</th>
                  <th className="px-3 py-2 text-right">Action</th>
                </tr>
              </thead>

              <tbody>
                {list.map((o) => {
                  const id = String(o?._id || "");
                  return (
                    <tr
                      key={id}
                      className="border-t border-slate-800 hover:bg-slate-950/30 transition"
                    >
                      <td className="px-3 py-2 text-slate-100">
                        {o?.snapshot?.requestTitle || o?.requestId || "—"}
                        <div className="text-[11px] text-slate-500">
                          {o?.requestId}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-slate-200">
                        {o?.providerName || o?.providerUsername || "—"}
                      </td>
                      <td className="px-3 py-2 text-slate-200">
                        {fmtMoney(o?.totalPrice, o?.currency)}
                      </td>
                      <td className="px-3 py-2 text-slate-200">
                        {o?.deliveryDays != null
                          ? `${o.deliveryDays} days`
                          : "—"}
                      </td>
                      <td className="px-3 py-2 text-slate-300">
                        {fmtDate(o?.orderedAt)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Link
                          href={`/requests/${o?.requestId}`}
                          className="text-xs px-3 py-2 rounded-xl border border-slate-700 hover:bg-slate-800 active:scale-[0.99]"
                        >
                          View Request
                        </Link>
                      </td>
                    </tr>
                  );
                })}

                {!loading && list.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-3 py-6 text-xs text-slate-400"
                    >
                      No orders found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
