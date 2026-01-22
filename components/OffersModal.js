"use client";

import { useEffect, useMemo, useState, useContext, useCallback } from "react";
import toast from "react-hot-toast";
import { AuthContext } from "../context/AuthContext";
import { apiGet, apiPost } from "../lib/api";

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

export default function OffersModal({ reqDoc, onClose, onChanged }) {
  const { user, authHeaders } = useContext(AuthContext);
  const role = roleUpper(user?.role);

  const requestId = idStr(reqDoc?._id);

  const [offers, setOffers] = useState([]);
  const [req, setReq] = useState(reqDoc || null); // ✅ local request state
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [selectedOfferId, setSelectedOfferId] = useState("");

  const canRecommend = role === "RESOURCE_PLANNER";
  const canSendToPO = role === "PROJECT_MANAGER";
  const canOrder = role === "PROCUREMENT_OFFICER";

  const requestStatus = useMemo(() => roleUpper(req?.status), [req?.status]);
  const recommendedOfferId = useMemo(
    () => idStr(req?.recommendedOfferId),
    [req?.recommendedOfferId],
  );

  const loadAll = useCallback(async () => {
    if (!requestId) return;
    try {
      setErr("");
      setLoading(true);

      // ✅ fetch request + offers (so status + recommendedOfferId is always fresh)
      const [reqRes, offersRes] = await Promise.all([
        apiGet(`/requests/${encodeURIComponent(requestId)}`, {
          headers: authHeaders,
        }),
        apiGet(`/offers?requestId=${encodeURIComponent(requestId)}`, {
          headers: authHeaders,
        }),
      ]);

      const freshReq = reqRes?.data || null;
      const list = Array.isArray(offersRes?.data) ? offersRes.data : [];

      setReq(freshReq);
      setOffers(list);

      // ✅ pick recommendedOfferId if present, otherwise first
      const recId = idStr(freshReq?.recommendedOfferId);
      setSelectedOfferId(recId || idStr(list?.[0]?._id) || "");
    } catch (e) {
      setErr(e?.response?.data?.error || e?.message || "Failed to load offers");
    } finally {
      setLoading(false);
    }
  }, [authHeaders, requestId]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const selectedOffer = useMemo(() => {
    return offers.find((o) => idStr(o?._id) === idStr(selectedOfferId)) || null;
  }, [offers, selectedOfferId]);

  async function recommendOffer(offerId) {
    const t = toast.loading("Recommending offer...");
    try {
      await apiPost(
        `/requests/${requestId}/rp-recommend-offer`,
        { offerId: idStr(offerId) },
        { headers: authHeaders },
      );

      toast.success("Offer recommended!", { id: t });

      // ✅ reload request + offers so recommendedOfferId + status updates
      await loadAll();

      // ✅ refresh parent list if needed
      onChanged?.();
    } catch (e) {
      toast.error(e?.response?.data?.error || "Recommend failed", { id: t });
    }
  }

  async function sendToPO() {
    const t = toast.loading("Sending to PO...");
    try {
      await apiPost(
        `/requests/${requestId}/send-to-po`,
        {},
        { headers: authHeaders },
      );
      toast.success("Sent to PO!", { id: t });
      await loadAll();
      onChanged?.();
    } catch (e) {
      toast.error(e?.response?.data?.error || "Send failed", { id: t });
    }
  }

  async function placeOrder() {
    const t = toast.loading("Checking request...");
    try {
      const reqRes = await apiGet(`/requests/${requestId}`, {
        headers: authHeaders,
      });
      const freshReq = reqRes?.data || null;
      const freshStatus = roleUpper(freshReq?.status);

      if (freshStatus !== "SENT_TO_PO") {
        toast.error(`Request status is ${freshStatus}, not SENT_TO_PO`, {
          id: t,
        });
        return;
      }

      const offerId = String(
        freshReq?.recommendedOfferId || selectedOfferId || "",
      );
      if (!offerId) {
        toast.error("No recommended offer found", { id: t });
        return;
      }

      await apiPost(
        `/requests/${requestId}/order`,
        { offerId },
        { headers: authHeaders },
      );

      toast.success("Order placed!", { id: t });
      onChanged?.();
    } catch (e) {
      toast.error(e?.response?.data?.error || "Order failed", { id: t });
    }
  }



  const statusBadge = useMemo(() => {
    const s = requestStatus || "—";
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
    return `${base} border-slate-700 text-slate-300 bg-slate-900`;
  }, [requestStatus]);

  const pmCanSendNow =
    canSendToPO && requestStatus === "RECOMMENDED" && !!recommendedOfferId;

  const poCanOrderNow =
    canOrder && requestStatus === "SENT_TO_PO" && !!recommendedOfferId;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="w-full max-w-5xl rounded-2xl border border-slate-800 bg-slate-950 p-4 space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-slate-100">
                Offers for: {req?.title || reqDoc?.title || "Untitled"}
              </h3>
              <span className={statusBadge}>{requestStatus}</span>
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

          <div className="flex items-center gap-2">
            <button
              onClick={loadAll}
              className="px-3 py-2 rounded-xl border border-slate-700 text-xs text-slate-200 hover:bg-slate-900"
            >
              {loading ? "Loading..." : "Refresh"}
            </button>
            <button
              onClick={onClose}
              className="px-3 py-2 rounded-xl border border-slate-700 text-xs text-slate-200 hover:bg-slate-900"
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
            <div className="bg-slate-950/60 px-3 py-2 flex items-center justify-between">
              <p className="text-xs text-slate-300">
                Available offers:{" "}
                <span className="text-slate-100 font-semibold">
                  {offers.length}
                </span>
                {Number(req?.maxOffers ?? reqDoc?.maxOffers ?? 0) > 0 ? (
                  <>
                    {" "}
                    /{" "}
                    <span className="text-slate-100 font-semibold">
                      {req?.maxOffers ?? reqDoc?.maxOffers}
                    </span>
                  </>
                ) : null}
              </p>
              <p className="text-[11px] text-slate-500">
                RP recommends → PM sends → PO orders
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-[900px] w-full text-sm">
                <thead className="bg-slate-950/60 text-[11px] text-slate-400">
                  <tr>
                    <th className="px-3 py-2 text-left">Select</th>
                    <th className="px-3 py-2 text-left">Provider</th>
                    <th className="px-3 py-2 text-left">Price</th>
                    <th className="px-3 py-2 text-left">Delivery Days</th>
                    <th className="px-3 py-2 text-left">Recommended</th>
                    <th className="px-3 py-2 text-right">Action</th>
                  </tr>
                </thead>

                <tbody>
                  {offers.map((o) => {
                    const oid = idStr(o._id);
                    const isSel = oid === idStr(selectedOfferId);

                    // ✅ recommended is based on request.recommendedOfferId
                    const isRecommended =
                      recommendedOfferId && oid === recommendedOfferId;

                    return (
                      <tr
                        key={oid || Math.random()}
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
                          />
                        </td>

                        <td className="px-3 py-2 text-slate-100">
                          {o.providerName || o.providerUsername || "—"}
                          <div className="text-[11px] text-slate-500">
                            {o.providerUsername ? `@${o.providerUsername}` : ""}
                          </div>
                        </td>

                        <td className="px-3 py-2 text-slate-200">
                          {fmtMoney(o.price, o.currency)}
                        </td>

                        <td className="px-3 py-2 text-slate-200">
                          {o.deliveryDays ?? "—"}
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

                        <td className="px-3 py-2 text-right">
                          {canRecommend ? (
                            <button
                              onClick={() => recommendOffer(oid)}
                              disabled={
                                requestStatus !== "BID_EVALUATION" &&
                                requestStatus !== "BIDDING"
                              }
                              className="px-3 py-1.5 rounded-lg bg-emerald-500 text-black text-xs hover:bg-emerald-400 disabled:opacity-50"
                            >
                              Recommend
                            </button>
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
                        colSpan={6}
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
              <div className="space-y-2">
                <div className="text-xs text-slate-400">
                  Provider:
                  <div className="text-slate-100 font-medium">
                    {selectedOffer.providerName ||
                      selectedOffer.providerUsername ||
                      "—"}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-2">
                    <div className="text-[11px] text-slate-400">Price</div>
                    <div className="text-sm text-slate-100">
                      {fmtMoney(selectedOffer.price, selectedOffer.currency)}
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-2">
                    <div className="text-[11px] text-slate-400">Delivery</div>
                    <div className="text-sm text-slate-100">
                      {selectedOffer.deliveryDays ?? "—"} days
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="pt-2 border-t border-slate-800 space-y-2">
              <p className="text-[11px] text-slate-500">
                Your role: <span className="text-slate-300">{role || "—"}</span>
              </p>

              {/* PM action */}
              {canSendToPO && (
                <button
                  onClick={sendToPO}
                  disabled={!pmCanSendNow}
                  className="w-full px-3 py-2 rounded-xl bg-indigo-500 text-black text-sm font-medium hover:bg-indigo-400 disabled:opacity-50"
                  title={
                    pmCanSendNow
                      ? "Send recommended offer to PO"
                      : "Requires RECOMMENDED status + recommendedOfferId"
                  }
                >
                  Send to PO
                </button>
              )}

              {/* PO action */}
              {canOrder && (
                <button
                  onClick={placeOrder}
                  disabled={!poCanOrderNow}
                  className="w-full px-3 py-2 rounded-xl bg-emerald-500 text-black text-sm font-medium hover:bg-emerald-400 disabled:opacity-50"
                  title={
                    poCanOrderNow
                      ? "Place order for the recommended offer"
                      : "Requires SENT_TO_PO status + recommendedOfferId"
                  }
                >
                  Place Order (Recommended)
                </button>
              )}

              {canOrder && recommendedOfferId && (
                <div className="text-[11px] text-slate-400">
                  PO will order:{" "}
                  <span className="text-slate-200">{recommendedOfferId}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
