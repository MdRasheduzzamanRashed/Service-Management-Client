"use client";

import { useCallback, useEffect, useMemo, useState, useContext } from "react";
import toast from "react-hot-toast";
import { apiGet } from "../lib/api";
import { AuthContext } from "../context/AuthContext";

/* =========================
   Helpers
========================= */
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

function fmtMoney(v, currency = "EUR") {
  if (v === null || v === undefined || v === "") return "—";
  const num = Number(v);
  if (!Number.isFinite(num)) return "—";
  return `${num.toLocaleString()} ${currency}`;
}

function fmtDays(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  return `${n} day${n === 1 ? "" : "s"}`;
}

function riskBadge(risk) {
  const r = String(risk || "").toUpperCase();
  const base =
    "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] border";
  if (r === "LOW")
    return `${base} border-emerald-500/40 text-emerald-300 bg-emerald-500/10`;
  if (r === "MEDIUM")
    return `${base} border-amber-500/40 text-amber-300 bg-amber-500/10`;
  if (r === "HIGH")
    return `${base} border-red-500/40 text-red-300 bg-red-500/10`;
  return `${base} border-slate-700 text-slate-300 bg-slate-900`;
}

/**
 * ✅ OffersList
 * - Uses correct API: GET /offers?requestId=...
 * - Supports both response shapes:
 *   - res.data = [...]
 *   - res.data = { data: [...] }
 * - Uses authHeaders if your apiGet needs them
 * - Nice UI + loading state + refresh
 */
export default function OffersList({ requestId }) {
  const { authHeaders } = useContext(AuthContext);

  const rid = useMemo(() => idStr(requestId), [requestId]);

  const [offers, setOffers] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!rid) return;

    const t = toast.loading("Loading offers...");
    setLoading(true);
    setError("");

    try {
      // ✅ match your backend: /offers?requestId=...
      const res = await apiGet(`/offers?requestId=${encodeURIComponent(rid)}`, {
        headers: authHeaders,
        params: { _t: Date.now() },
      });

      const raw = res?.data;
      const list = Array.isArray(raw)
        ? raw
        : Array.isArray(raw?.data)
          ? raw.data
          : [];

      setOffers(list);
      toast.success("Offers loaded", { id: t });
    } catch (err) {
      const msg =
        err?.response?.data?.error || err?.message || "Error loading offers";
      setError(msg);
      toast.error(msg, { id: t });
    } finally {
      setLoading(false);
      toast.dismiss(t);
    }
  }, [authHeaders, rid]);

  useEffect(() => {
    if (rid) load();
  }, [rid, load]);

  if (!rid) return null;

  if (error) {
    return (
      <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2">
        <p className="text-xs text-red-300">{error}</p>
        <button
          type="button"
          onClick={load}
          className="mt-2 text-xs px-3 py-2 rounded-lg border border-slate-700 hover:bg-slate-900 text-slate-200"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="text-sm font-semibold text-slate-100">
          Supplier Offers
        </h3>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="text-xs px-3 py-2 rounded-lg border border-slate-700 hover:bg-slate-900 text-slate-200 disabled:opacity-60"
        >
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      <div className="space-y-2">
        {offers.map((o) => {
          const oid = idStr(o?._id);
          const provider = o?.providerName || o?.providerUsername || "—";

          return (
            <div
              key={oid || provider}
              className="border border-slate-800 rounded-xl px-3 py-2 text-xs bg-slate-900/70"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-slate-100 truncate">
                    {provider}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Offer ID:{" "}
                    <span className="text-slate-300">{oid || "—"}</span>
                  </p>
                </div>

                <div className="text-right shrink-0">
                  <p className="text-slate-100 font-semibold">
                    {fmtMoney(o?.price, o?.currency)}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    {o?.deliveryDays !== undefined && o?.deliveryDays !== null
                      ? fmtDays(o?.deliveryDays)
                      : "—"}
                  </p>
                </div>
              </div>

              {/* Optional scorecard */}
              {o?.scorecard && (
                <div className="mt-2 flex items-center gap-2 flex-wrap">
                  <span className="text-[11px] text-slate-400">
                    Tech:{" "}
                    <span className="text-slate-200">
                      {Number.isFinite(Number(o?.scorecard?.technicalScore))
                        ? Number(o.scorecard.technicalScore).toFixed(0)
                        : "—"}
                    </span>
                  </span>
                  <span className="text-[11px] text-slate-400">
                    Commercial:{" "}
                    <span className="text-slate-200">
                      {Number.isFinite(Number(o?.scorecard?.commercialScore))
                        ? Number(o.scorecard.commercialScore).toFixed(0)
                        : "—"}
                    </span>
                  </span>
                  <span className={riskBadge(o?.scorecard?.deliveryRisk)}>
                    {String(o?.scorecard?.deliveryRisk || "—").toUpperCase()}
                  </span>
                </div>
              )}

              {o?.notes && (
                <p className="text-[11px] text-slate-300 mt-2 whitespace-pre-wrap">
                  {o.notes}
                </p>
              )}
            </div>
          );
        })}

        {!loading && offers.length === 0 && (
          <p className="text-xs text-slate-400">No offers yet.</p>
        )}
      </div>
    </div>
  );
}
