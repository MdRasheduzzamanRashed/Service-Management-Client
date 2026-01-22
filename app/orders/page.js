"use client";

import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AuthContext } from "../../context/AuthContext";
import { apiGet } from "../../lib/api";

function roleUpper(x) {
  return String(x || "").trim().toUpperCase().replace(/\s+/g, "_");
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

  if (!headersReady) return <div className="p-4 text-xs text-slate-300">Loading…</div>;

  if (!isPO) {
    return (
      <div className="p-4">
        <div className="text-xs text-red-400">Only Procurement Officer can view orders.</div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4 space-y-4">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-sm font-semibold text-slate-100">My Orders</h2>
          <p className="text-[11px] text-slate-400">
            Total: <span className="text-slate-200">{list.length}</span>
          </p>
        </div>

        <button
          onClick={load}
          disabled={loading}
          className="px-3 py-2 rounded-xl border border-slate-700 text-sm hover:bg-slate-800 disabled:opacity-60"
        >
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      {err && <div className="text-xs text-red-300">{err}</div>}

      <div className="overflow-x-auto rounded-xl border border-slate-800">
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
                <tr key={id} className="border-t border-slate-800 hover:bg-slate-950/30">
                  <td className="px-3 py-2 text-slate-100">
                    {o?.snapshot?.requestTitle || o?.requestId || "—"}
                    <div className="text-[11px] text-slate-500">{o?.requestId}</div>
                  </td>
                  <td className="px-3 py-2 text-slate-200">
                    {o?.providerName || o?.providerUsername || "—"}
                  </td>
                  <td className="px-3 py-2 text-slate-200">
                    {fmtMoney(o?.totalPrice, o?.currency)}
                  </td>
                  <td className="px-3 py-2 text-slate-200">
                    {o?.deliveryDays != null ? `${o.deliveryDays} days` : "—"}
                  </td>
                  <td className="px-3 py-2 text-slate-300">
                    {fmtDate(o?.orderedAt)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Link
                      href={`/requests/${o?.requestId}`}
                      className="text-xs px-2 py-1 rounded-lg border border-slate-700 hover:bg-slate-800"
                    >
                      View Request
                    </Link>
                  </td>
                </tr>
              );
            })}

            {!loading && list.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-xs text-slate-400">
                  No orders found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
