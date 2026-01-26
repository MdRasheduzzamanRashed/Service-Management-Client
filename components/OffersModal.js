"use client";

import { useEffect, useMemo, useState, useContext, useCallback } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { AuthContext } from "../context/AuthContext";
import { apiGet, apiPost } from "../lib/api";

/* =========================
   Helpers
========================= */
function roleUpper(x) {
  return String(x || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_");
}

function fmtMoney(v, currency = "EUR") {
  if (v === null || v === undefined || v === "") return "—";
  const num = Number(v);
  if (!Number.isFinite(num)) return "—";
  return `${num.toLocaleString()} ${currency}`;
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

function fmtScore(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  return n.toFixed(0);
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

function statusBadgeClass(status) {
  const s = String(status || "").toUpperCase();
  const base =
    "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] border";
  if (s === "BIDDING")
    return `${base} border-amber-500/40 text-amber-300 bg-amber-500/10`;
  if (s === "BID_EVALUATION")
    return `${base} border-sky-500/40 text-sky-300 bg-sky-500/10`;
  if (s === "RECOMMENDED")
    return `${base} border-emerald-500/40 text-emerald-300 bg-emerald-500/10`;
  if (s === "SENT_TO_PO")
    return `${base} border-indigo-500/40 text-indigo-300 bg-indigo-500/10`;
  if (s === "ORDERED")
    return `${base} border-green-500/40 text-green-300 bg-green-500/10`;
  if (s === "REJECTED")
    return `${base} border-red-500/40 text-red-300 bg-red-500/10`;
  if (s === "EXPIRED")
    return `${base} border-slate-600 text-slate-200 bg-slate-900`;
  return `${base} border-slate-700 text-slate-300 bg-slate-900`;
}

/* =========================
   OffersModal
========================= */
export default function OffersModal({ reqDoc, onClose, onUpdated }) {
  const { user, authHeaders } = useContext(AuthContext);
  const role = roleUpper(user?.role);

  const requestId = idStr(reqDoc?._id);

  const [offers, setOffers] = useState([]);
  const [req, setReq] = useState(reqDoc || null);
  const [loading, setLoading] = useState(false);
  const [acting, setActing] = useState(false);
  const [err, setErr] = useState("");
  const [selectedOfferId, setSelectedOfferId] = useState("");

  // ✅ SWAP FIX:
  // - PO recommends offer (BID_EVALUATION -> RECOMMENDED)
  // - RP orders (SENT_TO_PO -> ORDERED)
  const canRecommend = role === "PROCUREMENT_OFFICER";
  const canOrder = role === "RESOURCE_PLANNER";

  const requestStatus = useMemo(() => roleUpper(req?.status), [req?.status]);
  const recommendedOfferId = useMemo(
    () => idStr(req?.recommendedOfferId),
    [req?.recommendedOfferId],
  );

  const loadAll = useCallback(async () => {
    if (!requestId) return;

    const toastId = toast.loading("Loading offers...");

    try {
      setErr("");
      setLoading(true);

      const [reqRes, offersRes] = await Promise.all([
        apiGet(`/requests/${encodeURIComponent(requestId)}`, {
          headers: authHeaders,
          params: { _t: Date.now() },
        }),
        apiGet(`/offers?requestId=${encodeURIComponent(requestId)}`, {
          headers: authHeaders,
          params: { _t: Date.now() },
        }),
      ]);

      const freshReq = reqRes?.data || null;

      const list = Array.isArray(offersRes?.data)
        ? offersRes.data
        : Array.isArray(offersRes?.data?.data)
          ? offersRes.data.data
          : [];

      setReq(freshReq);
      setOffers(list);

      // keep selection stable
      const recId = idStr(freshReq?.recommendedOfferId);
      const fallback = idStr(list?.[0]?._id);
      setSelectedOfferId((prev) => prev || recId || fallback || "");

      toast.success("Offers loaded", { id: toastId });
    } catch (e) {
      const msg =
        e?.response?.data?.error || e?.message || "Failed to load offers";
      setErr(msg);
      toast.error(msg, { id: toastId });
    } finally {
      setLoading(false);
      toast.dismiss(toastId);
    }
  }, [authHeaders, requestId]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const selectedOffer = useMemo(() => {
    return offers.find((o) => idStr(o?._id) === idStr(selectedOfferId)) || null;
  }, [offers, selectedOfferId]);

  const statusBadge = useMemo(
    () => statusBadgeClass(requestStatus),
    [requestStatus],
  );

  const canOpenEvaluation =
    role === "PROCUREMENT_OFFICER" || role === "SYSTEM_ADMIN";

  const showRecommendButton =
    canRecommend && requestStatus === "BID_EVALUATION" && !!selectedOfferId;

  const showOrderButton =
    canOrder &&
    requestStatus === "SENT_TO_PO" &&
    !!(recommendedOfferId || selectedOfferId);

  const handleRecommend = useCallback(async () => {
    if (!requestId) return;
    if (!selectedOfferId) return;

    const t = toast.loading("Recommending offer...");
    setActing(true);
    setErr("");

    try {
      // ✅ backend supports /po-recommend-offer (and legacy /rp-recommend-offer if you add it)
      const res = await apiPost(
        `/requests/${encodeURIComponent(requestId)}/po-recommend-offer`,
        { offerId: selectedOfferId },
        { headers: authHeaders },
      );

      const freshReq = res?.data?.request || null;
      const freshOffers = Array.isArray(res?.data?.offers)
        ? res.data.offers
        : offers;

      setReq(freshReq);
      setOffers(freshOffers);

      const rec = idStr(freshReq?.recommendedOfferId) || selectedOfferId;
      setSelectedOfferId(rec);

      toast.success("Offer recommended", { id: t });

      if (typeof onUpdated === "function") {
        onUpdated({ request: freshReq, offers: freshOffers });
      }
    } catch (e) {
      const msg =
        e?.response?.data?.error || e?.message || "Failed to recommend offer";
      setErr(msg);
      toast.error(msg, { id: t });
    } finally {
      setActing(false);
      toast.dismiss(t);
    }
  }, [authHeaders, offers, onUpdated, requestId, selectedOfferId]);

  const handleOrder = useCallback(async () => {
    if (!requestId) return;

    const offerIdToUse = recommendedOfferId || selectedOfferId;
    if (!offerIdToUse) return;

    const t = toast.loading("Placing order...");
    setActing(true);
    setErr("");

    try {
      const res = await apiPost(
        `/requests/${encodeURIComponent(requestId)}/order`,
        { offerId: offerIdToUse },
        { headers: authHeaders },
      );

      const freshReq = res?.data?.request || null;
      if (freshReq) setReq(freshReq);

      toast.success("Order placed", { id: t });

      if (typeof onUpdated === "function") {
        onUpdated({ request: freshReq || req, offers });
      }
    } catch (e) {
      const msg =
        e?.response?.data?.error || e?.message || "Failed to place order";
      setErr(msg);
      toast.error(msg, { id: t });
    } finally {
      setActing(false);
      toast.dismiss(t);
    }
  }, [
    authHeaders,
    offers,
    onUpdated,
    recommendedOfferId,
    requestId,
    req,
    selectedOfferId,
  ]);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="w-full max-w-6xl rounded-2xl border border-slate-800 bg-slate-950 p-4 space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-slate-100">
                Offers for: {req?.title || reqDoc?.title || "Untitled"}
              </h3>
              <span className={statusBadge}>{requestStatus || "—"}</span>
            </div>

            <p className="text-[11px] text-slate-400">
              Request ID: <span className="text-slate-300">{requestId}</span>
            </p>

            <p className="text-[11px] text-slate-500">
              Recommended Offer ID:{" "}
              <span className="text-slate-300">
                {recommendedOfferId || "—"}
              </span>
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap justify-end">
            {canOpenEvaluation && requestId && (
              <Link
                href={`/requests/${encodeURIComponent(requestId)}/evaluation`}
                className="px-3 py-2 rounded-xl bg-emerald-500 text-black text-xs font-semibold hover:bg-emerald-400"
              >
                Evaluation
              </Link>
            )}

            {showRecommendButton && (
              <button
                onClick={handleRecommend}
                disabled={acting || loading}
                className="px-3 py-2 rounded-xl bg-sky-500 text-black text-xs font-semibold hover:bg-sky-400 disabled:opacity-60"
                type="button"
                title="PO recommends the selected offer"
              >
                {acting ? "Working..." : "Recommend Offer"}
              </button>
            )}

            {showOrderButton && (
              <button
                onClick={handleOrder}
                disabled={acting || loading}
                className="px-3 py-2 rounded-xl bg-indigo-500 text-black text-xs font-semibold hover:bg-indigo-400 disabled:opacity-60"
                type="button"
                title="RP places the order"
              >
                {acting ? "Working..." : "Place Order"}
              </button>
            )}

            <button
              onClick={loadAll}
              className="px-3 py-2 rounded-xl border border-slate-700 text-xs text-slate-200 hover:bg-slate-900 disabled:opacity-60"
              type="button"
              disabled={loading || acting}
            >
              {loading ? "Loading..." : "Refresh"}
            </button>

            <button
              onClick={onClose}
              className="px-3 py-2 rounded-xl border border-slate-700 text-xs text-slate-200 hover:bg-slate-900"
              type="button"
              disabled={acting}
            >
              Close
            </button>
          </div>
        </div>

        {err && (
          <div className="text-xs text-red-400 border border-red-500/30 bg-red-500/10 rounded-xl px-3 py-2">
            {err}
          </div>
        )}

        {/* Body */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          {/* Offers list */}
          <div className="lg:col-span-2 rounded-2xl border border-slate-800 overflow-hidden">
            <div className="bg-slate-950/60 px-3 py-2 flex items-center justify-between gap-2 flex-wrap">
              <p className="text-xs text-slate-300">
                Available offers:{" "}
                <span className="text-slate-100 font-semibold">
                  {offers.length}
                </span>
              </p>

              {/* ✅ updated flow text */}
              <p className="text-[11px] text-slate-500">
                PO evaluates → PO recommends → PM sends → RP orders
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-[1100px] w-full text-sm">
                <thead className="bg-slate-950/60 text-[11px] text-slate-400">
                  <tr>
                    <th className="px-3 py-2 text-left">Select</th>
                    <th className="px-3 py-2 text-left">Provider</th>
                    <th className="px-3 py-2 text-left">Price</th>
                    <th className="px-3 py-2 text-left">Delivery</th>
                    <th className="px-3 py-2 text-left">Tech</th>
                    <th className="px-3 py-2 text-left">Commercial</th>
                    <th className="px-3 py-2 text-left">Risk</th>
                    <th className="px-3 py-2 text-left">Recommended</th>
                  </tr>
                </thead>

                <tbody>
                  {offers.map((o) => {
                    const oid = idStr(o?._id);
                    const isSel = oid === idStr(selectedOfferId);
                    const isRecommended =
                      recommendedOfferId && oid === recommendedOfferId;

                    return (
                      <tr
                        key={oid}
                        className={`border-t border-slate-800 hover:bg-slate-950/30 ${
                          isSel ? "bg-slate-950/40" : ""
                        }`}
                      >
                        <td className="px-3 py-2">
                          <input
                            type="radio"
                            name="selectedOffer"
                            checked={isSel}
                            onChange={() => setSelectedOfferId(oid)}
                            aria-label="Select offer"
                          />
                        </td>

                        <td className="px-3 py-2 text-slate-100">
                          {o?.providerName || o?.providerUsername || "—"}
                        </td>

                        <td className="px-3 py-2 text-slate-200">
                          {fmtMoney(o?.price, o?.currency)}
                        </td>

                        <td className="px-3 py-2 text-slate-200">
                          {o?.deliveryDays ?? "—"}
                        </td>

                        <td className="px-3 py-2 text-slate-200">
                          {fmtScore(o?.scorecard?.technicalScore)}
                        </td>

                        <td className="px-3 py-2 text-slate-200">
                          {fmtScore(o?.scorecard?.commercialScore)}
                        </td>

                        <td className="px-3 py-2">
                          <span
                            className={riskBadge(o?.scorecard?.deliveryRisk)}
                          >
                            {String(
                              o?.scorecard?.deliveryRisk || "—",
                            ).toUpperCase()}
                          </span>
                        </td>

                        <td className="px-3 py-2">
                          {isRecommended ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] border border-emerald-500/40 text-emerald-300 bg-emerald-500/10">
                              RECOMMENDED
                            </span>
                          ) : (
                            <span className="text-[11px] text-slate-500">
                              —
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}

                  {!loading && offers.length === 0 && (
                    <tr>
                      <td
                        colSpan={8}
                        className="px-3 py-6 text-xs text-slate-400"
                      >
                        No offers available yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Right panel */}
          <div className="rounded-2xl border border-slate-800 p-3 space-y-3 bg-slate-950">
            <h4 className="text-sm font-semibold text-slate-100">
              Selected Offer
            </h4>

            {!selectedOffer ? (
              <p className="text-xs text-slate-400">
                Select an offer to see details.
              </p>
            ) : (
              <div className="space-y-3">
                <div className="text-xs text-slate-400">
                  Provider:
                  <div className="text-slate-100 font-medium">
                    {selectedOffer?.providerName ||
                      selectedOffer?.providerUsername ||
                      "—"}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-2">
                    <div className="text-[10px] text-slate-500">Price</div>
                    <div className="text-xs text-slate-100 font-semibold">
                      {fmtMoney(selectedOffer?.price, selectedOffer?.currency)}
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-2">
                    <div className="text-[10px] text-slate-500">Delivery</div>
                    <div className="text-xs text-slate-100 font-semibold">
                      {selectedOffer?.deliveryDays ?? "—"} days
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-2">
                    <div className="text-[10px] text-slate-500">Tech Score</div>
                    <div className="text-xs text-slate-100 font-semibold">
                      {fmtScore(selectedOffer?.scorecard?.technicalScore)}
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-2">
                    <div className="text-[10px] text-slate-500">
                      Commercial Score
                    </div>
                    <div className="text-xs text-slate-100 font-semibold">
                      {fmtScore(selectedOffer?.scorecard?.commercialScore)}
                    </div>
                  </div>
                </div>

                <div className="text-xs text-slate-400">
                  Delivery Risk:
                  <div className="mt-1">
                    <span
                      className={riskBadge(
                        selectedOffer?.scorecard?.deliveryRisk,
                      )}
                    >
                      {String(
                        selectedOffer?.scorecard?.deliveryRisk || "—",
                      ).toUpperCase()}
                    </span>
                  </div>
                </div>

                {selectedOffer?.notes && (
                  <div className="text-xs text-slate-400">
                    Notes:
                    <div className="mt-1 text-slate-200 whitespace-pre-wrap">
                      {selectedOffer.notes}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="pt-2 border-t border-slate-800 space-y-1">
              <p className="text-[11px] text-slate-500">
                Your role: <span className="text-slate-300">{role || "—"}</span>
              </p>

              <p className="text-[11px] text-slate-500">
                You can{" "}
                <span className="text-slate-200">
                  {canRecommend
                    ? "recommend (PO)"
                    : canOrder
                      ? "order (RP)"
                      : "view"}
                </span>{" "}
                based on current status.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
