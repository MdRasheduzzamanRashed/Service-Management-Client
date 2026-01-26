"use client";

import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AuthContext } from "../../context/AuthContext";
import { apiGet } from "../../lib/api";

/* =========================
   Helpers
========================= */
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
   UI helpers
========================= */
function SkeletonLine({ w = "w-full" }) {
  return <div className={`h-3 ${w} rounded bg-slate-800/70 animate-pulse`} />;
}

function OrderCardSkeleton() {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4 space-y-3">
      <SkeletonLine w="w-2/3" />
      <SkeletonLine w="w-1/3" />

      <div className="grid grid-cols-2 gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-slate-800 bg-slate-950/50 p-3 space-y-2"
          >
            <SkeletonLine w="w-1/2" />
            <SkeletonLine w="w-2/3" />
          </div>
        ))}
      </div>
    </div>
  );
}

function Chip({ active, children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl px-3 py-2 text-xs border transition active:scale-[0.99] ${
        active
          ? "border-emerald-400/60 bg-emerald-500/10 text-emerald-200"
          : "border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800"
      }`}
    >
      {children}
    </button>
  );
}

function StatPill({ label, value }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className="mt-0.5 text-sm font-semibold text-slate-100">{value}</div>
    </div>
  );
}

/* =========================================================
   OrdersPage
   ✅ Swapped responsibilities:
   - Ordering role is RESOURCE_PLANNER (RP)
   - Admin can view everything
   Endpoints used:
   - GET /orders/my  (for "My Orders")
   - GET /orders     (for "All Orders")
========================================================= */
export default function OrdersPage() {
  const { user, authHeaders, loading: authLoading } = useContext(AuthContext);

  const role = useMemo(() => roleUpper(user?.role), [user?.role]);
  const isRP = role === "RESOURCE_PLANNER";
  const isAdmin = role === "SYSTEM_ADMIN";

  const headersReady = !!authHeaders?.["x-user-role"] && !authLoading;
  const canViewOrders = isRP || isAdmin;

  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const [tab, setTab] = useState("my"); // my | all
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("newest");

  // If not admin, force "my" tab (admins can see both)
  useEffect(() => {
    if (canViewOrders && !isAdmin) setTab("my");
  }, [canViewOrders, isAdmin]);

  const load = useCallback(async () => {
    if (!headersReady) return;
    if (!canViewOrders) return;

    try {
      setErr("");
      setLoading(true);

      const endpoint = tab === "all" ? "/orders" : "/orders/my";
      const res = await apiGet(endpoint, {
        headers: authHeaders,
        params: { _t: Date.now() },
      });

      setList(Array.isArray(res?.data) ? res.data : []);
    } catch (e) {
      setList([]);
      setErr(e?.response?.data?.error || e?.message || "Failed to load orders");
    } finally {
      setLoading(false);
    }
  }, [authHeaders, headersReady, canViewOrders, tab]);

  useEffect(() => {
    load();
  }, [load]);

  const stats = useMemo(() => {
    const total = list.length;
    let sum = 0;
    let count = 0;
    let fastest = null;

    for (const o of list) {
      const p = Number(o?.totalPrice);
      const d = Number(o?.deliveryDays);

      if (Number.isFinite(p)) {
        sum += p;
        count++;
      }
      if (Number.isFinite(d)) {
        fastest = fastest == null ? d : Math.min(fastest, d);
      }
    }

    return {
      total,
      avgPrice: count
        ? fmtMoney(sum / count, list?.[0]?.currency || "EUR")
        : "—",
      fastest: fastest == null ? "—" : `${fastest} days`,
    };
  }, [list]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let rows = [...list];

    if (needle) {
      rows = rows.filter((o) => {
        const hay = [
          o?.snapshot?.requestTitle,
          o?.requestId,
          o?.providerName,
          o?.providerUsername,
          o?.orderId,
          o?._id,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return hay.includes(needle);
      });
    }

    const num = (v) => {
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    };
    const time = (v) => new Date(v || 0).getTime();

    rows.sort((a, b) => {
      if (sort === "oldest") return time(a?.orderedAt) - time(b?.orderedAt);
      if (sort === "price_high")
        return (num(b?.totalPrice) ?? -1) - (num(a?.totalPrice) ?? -1);
      if (sort === "price_low")
        return (num(a?.totalPrice) ?? 1e18) - (num(b?.totalPrice) ?? 1e18);
      if (sort === "delivery_fast")
        return (num(a?.deliveryDays) ?? 1e18) - (num(b?.deliveryDays) ?? 1e18);
      if (sort === "delivery_slow")
        return (num(b?.deliveryDays) ?? -1) - (num(a?.deliveryDays) ?? -1);
      return time(b?.orderedAt) - time(a?.orderedAt);
    });

    return rows;
  }, [list, q, sort]);

  if (!headersReady) {
    return <div className="p-4 text-xs text-slate-300">Loading…</div>;
  }

  if (!canViewOrders) {
    return (
      <div className="p-4 text-xs text-red-400">
        Only Resource Planner (Ordering role) or System Admin can view orders.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-3 sm:p-4 space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-100">Orders</h2>
          <p className="text-[11px] text-slate-400">
            Showing {filtered.length} / {list.length}
          </p>
        </div>

        <button
          onClick={load}
          disabled={loading}
          className="px-3 py-2 rounded-xl border border-slate-700 text-sm hover:bg-slate-800 disabled:opacity-60"
          type="button"
        >
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        <Chip active={tab === "my"} onClick={() => setTab("my")}>
          My Orders
        </Chip>

        {/* ✅ only admin can see All Orders */}
        {isAdmin && (
          <Chip active={tab === "all"} onClick={() => setTab("all")}>
            All Orders
          </Chip>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <StatPill label="Total Orders" value={stats.total} />
        <StatPill label="Avg Price" value={stats.avgPrice} />
        <StatPill label="Fastest Delivery" value={stats.fastest} />
      </div>

      {/* Search + Sort */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search request, provider, title..."
          className="w-full sm:w-[420px] rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 outline-none focus:border-emerald-400/60"
        />

        <select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          className="w-full sm:w-64 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-400/60"
        >
          <option value="newest">Newest</option>
          <option value="oldest">Oldest</option>
          <option value="price_high">Price High → Low</option>
          <option value="price_low">Price Low → High</option>
          <option value="delivery_fast">Fast Delivery</option>
          <option value="delivery_slow">Slow Delivery</option>
        </select>
      </div>

      {err && (
        <div className="rounded-xl border border-red-900/40 bg-red-950/20 px-3 py-2 text-xs text-red-200">
          {err}
        </div>
      )}

      {/* Cards */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <OrderCardSkeleton key={i} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4 text-xs text-slate-400">
          No orders found.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtered.map((o) => {
            const id = String(o?._id || "");

            return (
              <div
                key={id}
                className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4 hover:bg-slate-950/55 transition"
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-100 truncate">
                      {o?.snapshot?.requestTitle || o?.requestId || "—"}
                    </p>
                    <p className="mt-1 text-[11px] text-slate-500 break-all">
                      Request: {o?.requestId || "—"}
                    </p>
                  </div>

                  {/* If you have an /orders/[id] page, change this link */}
                  <Link
                    href={`/requests/${encodeURIComponent(o?.requestId || "")}`}
                    className="text-xs px-3 py-2 rounded-xl border border-slate-700 hover:bg-slate-800"
                  >
                    View
                  </Link>
                </div>

                {/* Body */}
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-3">
                    <p className="text-[10px] text-slate-500">Provider</p>
                    <p className="mt-1 text-sm text-slate-100 truncate">
                      {o?.providerName || o?.providerUsername || "—"}
                    </p>
                  </div>

                  <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-3">
                    <p className="text-[10px] text-slate-500">Price</p>
                    <p className="mt-1 text-sm text-slate-100">
                      {fmtMoney(o?.totalPrice, o?.currency)}
                    </p>
                  </div>

                  <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-3">
                    <p className="text-[10px] text-slate-500">Delivery</p>
                    <p className="mt-1 text-sm text-slate-100">
                      {o?.deliveryDays != null ? `${o.deliveryDays} days` : "—"}
                    </p>
                  </div>

                  <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-3">
                    <p className="text-[10px] text-slate-500">Ordered At</p>
                    <p className="mt-1 text-sm text-slate-100">
                      {fmtDate(o?.orderedAt)}
                    </p>
                  </div>
                </div>

                {/* Footer */}
                <div className="mt-3 pt-3 border-t border-slate-800 text-[11px] text-slate-500">
                  Ordered by:{" "}
                  <span className="text-slate-300">{o?.orderedBy || "—"}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
