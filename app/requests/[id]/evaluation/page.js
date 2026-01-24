"use client";

import { useContext, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { AuthContext } from "../../../../context/AuthContext";
import { apiGet, apiPost } from "../../../../lib/api";

/* =========================
   Utils
========================= */
function roleUpper(x) {
  return String(x || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_");
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

function clamp0to10(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(10, v));
}

function fmtMoney(v, currency = "EUR") {
  const num = Number(v);
  if (!Number.isFinite(num)) return "—";
  return `${num.toLocaleString()} ${currency}`;
}

/* =========================
   Offer Adapter (matches your offer JSON)
   Your offer example uses:
   - vendor.companyName
   - vendor.vendorId / vendor.contactEmail
   - commercials.costing.totalAfterDiscount
   - commercials.currency
   - scorecard.deliveryRisk
========================= */
function getProviderName(o) {
  return (
    o?.providerName || o?.vendor?.companyName || o?.vendor?.contactPerson || "—"
  );
}

function getProviderUsername(o) {
  return (
    o?.providerUsername ||
    o?.vendor?.vendorId ||
    (o?.vendor?.contactEmail ? o.vendor.contactEmail.split("@")[0] : "") ||
    ""
  );
}

function getCurrency(o) {
  return o?.currency || o?.commercials?.currency || "EUR";
}

function getPrice(o) {
  if (o?.price != null) return o.price;

  const costing = o?.commercials?.costing;
  const v =
    costing?.totalAfterDiscount ??
    costing?.totalBeforeDiscount ??
    costing?.total ??
    null;

  const num = Number(v);
  return Number.isFinite(num) ? num : null;
}

function getDeliveryRisk(o) {
  const v = String(
    o?.deliveryRisk || o?.scorecard?.deliveryRisk || "",
  ).toUpperCase();
  return v || "—";
}

function DeliveryRiskPill({ risk }) {
  const r = String(risk || "—").toUpperCase();

  const cls =
    r === "LOW"
      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
      : r === "MEDIUM"
        ? "border-amber-500/40 bg-amber-500/10 text-amber-200"
        : r === "HIGH"
          ? "border-red-500/40 bg-red-500/10 text-red-200"
          : "border-slate-700 bg-slate-900 text-slate-200";

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] border ${cls}`}
      title="Delivery risk (from offer.scorecard.deliveryRisk)"
    >
      {r}
    </span>
  );
}

export default function RPEvaluationPage() {
  const router = useRouter();
  const params = useParams();
  const requestId = String(params?.id || "").trim();

  const { user, authHeaders } = useContext(AuthContext);
  const role = useMemo(() => roleUpper(user?.role), [user?.role]);

  const [reqDoc, setReqDoc] = useState(null);
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);

  const [savedEval, setSavedEval] = useState(null);

  // weights
  const [wPrice, setWPrice] = useState(0.6);
  const [wDelivery, setWDelivery] = useState(0.25);
  const [wQuality, setWQuality] = useState(0.15);

  const [comment, setComment] = useState("");
  const [recommendedOfferId, setRecommendedOfferId] = useState("");

  // { offerId: {price, delivery, quality, notes} }
  const [scores, setScores] = useState({});

  const canUse = role === "RESOURCE_PLANNER";
  const status = useMemo(() => roleUpper(reqDoc?.status), [reqDoc?.status]);

  function computeTotalScore(offerId) {
    const s = scores[offerId] || {};
    const price = clamp0to10(s.price);
    const delivery = clamp0to10(s.delivery);
    const quality = clamp0to10(s.quality);

    // normalize weights
    const sum = Number(wPrice) + Number(wDelivery) + Number(wQuality) || 1;
    const wp = Number(wPrice) / sum;
    const wd = Number(wDelivery) / sum;
    const wq = Number(wQuality) / sum;

    return price * wp + delivery * wd + quality * wq;
  }

  const ranked = useMemo(() => {
    const rows = (offers || []).map((o) => {
      const oid = idStr(o?._id);
      return { offer: o, offerId: oid, total: computeTotalScore(oid) };
    });
    rows.sort((a, b) => b.total - a.total);
    return rows;
  }, [offers, scores, wPrice, wDelivery, wQuality]);

  async function loadAll() {
    if (!requestId) return;
    setLoading(true);

    try {
      // ✅ offers endpoint in your backend:
      // GET /api/offers/by-request/:requestId
      const [reqRes, offersRes, evalRes] = await Promise.all([
        apiGet(`/requests/${encodeURIComponent(requestId)}`, {
          headers: authHeaders,
        }),
        apiGet(`/offers/by-request/${encodeURIComponent(requestId)}`, {
          headers: authHeaders,
        }),
        apiGet(`/rp-evaluations/${encodeURIComponent(requestId)}`, {
          headers: authHeaders,
        }),
      ]);

      const r = reqRes?.data || null;

      // backend returns { data: offers }
      const list = Array.isArray(offersRes?.data?.data)
        ? offersRes.data.data
        : [];

      const ev = evalRes?.data || null;

      setReqDoc(r);
      setOffers(list);
      setSavedEval(ev);

      // hydrate from saved evaluation
      if (ev?.weights) {
        setWPrice(Number(ev.weights.price ?? 0.6));
        setWDelivery(Number(ev.weights.delivery ?? 0.25));
        setWQuality(Number(ev.weights.quality ?? 0.15));
      }

      if (typeof ev?.comment === "string") setComment(ev.comment);
      if (ev?.recommendedOfferId)
        setRecommendedOfferId(String(ev.recommendedOfferId));

      if (Array.isArray(ev?.offers) && ev.offers.length) {
        const next = {};
        for (const row of ev.offers) {
          const oid = String(row.offerId || "").trim();
          if (!oid) continue;
          next[oid] = {
            price: clamp0to10(row.scorePrice),
            delivery: clamp0to10(row.scoreDelivery),
            quality: clamp0to10(row.scoreQuality),
            notes: row.notes || "",
          };
        }
        setScores(next);
      } else {
        // init empty scores for offers
        const next = {};
        for (const o of list) {
          const oid = idStr(o?._id);
          next[oid] = { price: 0, delivery: 0, quality: 0, notes: "" };
        }
        setScores(next);
      }
    } catch (e) {
      toast.error(
        e?.response?.data?.error || e?.message || "Failed to load data",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestId]);

  async function saveEvaluation() {
    const t = toast.loading("Saving evaluation...");
    try {
      const payload = {
        weights: { price: wPrice, delivery: wDelivery, quality: wQuality },
        comment,
        recommendedOfferId: recommendedOfferId || "",
        offers: (offers || []).map((o) => {
          const oid = idStr(o?._id);
          const s = scores[oid] || {};
          return {
            offerId: oid,

            // store normalized vendor identity for reporting
            providerUsername: getProviderUsername(o) || "",
            providerName: getProviderName(o) || "",

            // store normalized commercial fields
            price: getPrice(o),
            currency: getCurrency(o),

            // you asked for deliveryRisk
            deliveryRisk: getDeliveryRisk(o),

            // your current offers may not have deliveryDays; keep if you add later
            deliveryDays: o?.deliveryDays ?? null,

            // RP scoring
            scorePrice: clamp0to10(s.price),
            scoreDelivery: clamp0to10(s.delivery),
            scoreQuality: clamp0to10(s.quality),
            totalScore: Number(computeTotalScore(oid).toFixed(4)),
            notes: s.notes || "",
          };
        }),
      };

      const res = await apiPost(`/rp-evaluations/${requestId}`, payload, {
        headers: authHeaders,
      });

      setSavedEval(res?.data?.data || null);
      toast.success("Evaluation saved", { id: t });
    } catch (e) {
      toast.error(e?.response?.data?.error || e?.message || "Save failed", {
        id: t,
      });
    }
  }

  async function recommendNow() {
    if (!recommendedOfferId) {
      toast.error("Select a recommended offer first");
      return;
    }

    // Save evaluation first
    await saveEvaluation();

    const t = toast.loading("Recommending offer...");
    try {
      await apiPost(
        `/requests/${requestId}/rp-recommend-offer`,
        { offerId: recommendedOfferId },
        { headers: authHeaders },
      );

      toast.success("Offer recommended! Request is now RECOMMENDED.", {
        id: t,
      });

      await loadAll();
      router.push(`/requests/${requestId}`);
    } catch (e) {
      toast.error(
        e?.response?.data?.error || e?.message || "Recommend failed",
        { id: t },
      );
    }
  }

  if (!canUse) {
    return (
      <div className="p-4 rounded-2xl border border-slate-800 bg-slate-900/30">
        <p className="text-sm text-red-300">
          Only RESOURCE_PLANNER can access this page.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-4 text-slate-300 text-sm">Loading evaluation...</div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold text-slate-100">
              RP Evaluation
            </h1>

            <p className="text-xs text-slate-400 mt-1">
              Request:{" "}
              <span className="text-slate-200">
                {reqDoc?.title || "Untitled"}
              </span>
            </p>

            <p className="text-xs text-slate-500">
              Status: <span className="text-slate-200">{status || "—"}</span> ·
              ID: <span className="text-slate-300">{requestId}</span>
            </p>

            {status !== "BID_EVALUATION" && (
              <p className="text-xs text-amber-300 mt-2">
                This request is not in BID_EVALUATION. You can still review, but
                recommending may be blocked by workflow.
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-2 justify-end">
            <button
              onClick={loadAll}
              className="px-3 py-2 rounded-xl border border-slate-700 text-xs text-slate-200 hover:bg-slate-800"
              type="button"
            >
              Refresh
            </button>

            <button
              onClick={saveEvaluation}
              className="px-3 py-2 rounded-xl bg-sky-500 text-black text-xs font-semibold hover:bg-sky-400"
              type="button"
            >
              Save Evaluation
            </button>

            <button
              onClick={recommendNow}
              disabled={!recommendedOfferId || status !== "BID_EVALUATION"}
              className="px-3 py-2 rounded-xl bg-emerald-500 text-black text-xs font-semibold hover:bg-emerald-400 disabled:opacity-50"
              type="button"
              title={
                status === "BID_EVALUATION"
                  ? "Recommend selected offer"
                  : "Only BID_EVALUATION can be recommended"
              }
            >
              Recommend Offer
            </button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
          <WeightCard
            label="Price Weight"
            value={wPrice}
            onChange={setWPrice}
          />
          <WeightCard
            label="Delivery Weight"
            value={wDelivery}
            onChange={setWDelivery}
          />
          <WeightCard
            label="Quality Weight"
            value={wQuality}
            onChange={setWQuality}
          />
        </div>

        <div className="mt-4">
          <label className="text-xs text-slate-400">RP Comment</label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
            className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-emerald-400"
            placeholder="Write summary: why you choose recommended offer..."
          />
        </div>

        {savedEval?.updatedAt && (
          <p className="text-[11px] text-slate-500 mt-2">
            Last saved:{" "}
            <span className="text-slate-300">
              {new Date(savedEval.updatedAt).toLocaleString()}
            </span>
          </p>
        )}
      </div>

      {/* Ranking */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/40 overflow-hidden">
        <div className="px-4 py-3 flex items-center justify-between bg-slate-950/50">
          <p className="text-sm font-semibold text-slate-100">Offers Ranking</p>
          <p className="text-xs text-slate-400">
            Total offers: {offers.length}
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[1200px] w-full text-sm">
            <thead className="bg-slate-950/50 text-[11px] text-slate-400">
              <tr>
                <th className="px-3 py-2 text-left">Choose</th>
                <th className="px-3 py-2 text-left">Provider</th>
                <th className="px-3 py-2 text-left">Price</th>
                <th className="px-3 py-2 text-left">Delivery Risk</th>
                <th className="px-3 py-2 text-left">Score (0-10)</th>
                <th className="px-3 py-2 text-left">Notes</th>
                <th className="px-3 py-2 text-left">Total</th>
              </tr>
            </thead>

            <tbody>
              {ranked.map(({ offer, offerId, total }) => {
                const s = scores[offerId] || {
                  price: 0,
                  delivery: 0,
                  quality: 0,
                  notes: "",
                };

                const isRec =
                  recommendedOfferId &&
                  String(recommendedOfferId) === String(offerId);

                const providerName = getProviderName(offer);
                const providerUsername = getProviderUsername(offer);

                const price = getPrice(offer);
                const currency = getCurrency(offer);

                const risk = getDeliveryRisk(offer);

                return (
                  <tr
                    key={offerId}
                    className="border-t border-slate-800 hover:bg-slate-950/30"
                  >
                    <td className="px-3 py-2">
                      <input
                        type="radio"
                        name="recommended"
                        checked={isRec}
                        onChange={() => setRecommendedOfferId(offerId)}
                      />
                    </td>

                    <td className="px-3 py-2 text-slate-100">
                      {providerName}
                      {isRec && (
                        <span className="ml-2 text-[10px] px-2 py-0.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 text-emerald-200">
                          Recommended
                        </span>
                      )}
                      <div className="text-[11px] text-slate-500">
                        {providerUsername ? `@${providerUsername}` : ""}
                      </div>
                    </td>

                    <td className="px-3 py-2 text-slate-300">
                      {price != null ? fmtMoney(price, currency) : "—"}
                    </td>

                    <td className="px-3 py-2">
                      <DeliveryRiskPill risk={risk} />
                    </td>

                    <td className="px-3 py-2">
                      <div className="grid grid-cols-3 gap-2 min-w-[330px]">
                        <ScoreInput
                          label="Price"
                          value={s.price}
                          onChange={(v) =>
                            setScores((prev) => ({
                              ...prev,
                              [offerId]: { ...(prev[offerId] || {}), price: v },
                            }))
                          }
                        />
                        <ScoreInput
                          label="Delivery"
                          value={s.delivery}
                          onChange={(v) =>
                            setScores((prev) => ({
                              ...prev,
                              [offerId]: {
                                ...(prev[offerId] || {}),
                                delivery: v,
                              },
                            }))
                          }
                        />
                        <ScoreInput
                          label="Quality"
                          value={s.quality}
                          onChange={(v) =>
                            setScores((prev) => ({
                              ...prev,
                              [offerId]: {
                                ...(prev[offerId] || {}),
                                quality: v,
                              },
                            }))
                          }
                        />
                      </div>
                    </td>

                    <td className="px-3 py-2">
                      <input
                        value={s.notes || ""}
                        onChange={(e) =>
                          setScores((prev) => ({
                            ...prev,
                            [offerId]: {
                              ...(prev[offerId] || {}),
                              notes: e.target.value,
                            },
                          }))
                        }
                        className="w-[320px] max-w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-100 focus:outline-none focus:border-emerald-400"
                        placeholder="Reason, risk, compliance notes..."
                      />
                    </td>

                    <td className="px-3 py-2 text-slate-100 font-semibold tabular-nums">
                      {total.toFixed(2)}
                    </td>
                  </tr>
                );
              })}

              {offers.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-xs text-slate-400">
                    No offers found for this request.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="px-4 py-3 text-[11px] text-slate-500 bg-slate-950/40">
          Uses:{" "}
          <span className="text-slate-300">
            GET /api/offers/by-request/:requestId
          </span>{" "}
          and{" "}
          <span className="text-slate-300">/api/rp-evaluations/:requestId</span>
        </div>
      </div>
    </div>
  );
}

/* =========================
   UI bits
========================= */
function WeightCard({ label, value, onChange }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950 p-3">
      <div className="text-xs text-slate-400">{label}</div>
      <div className="mt-2 flex items-center gap-2">
        <input
          type="number"
          step="0.05"
          min="0"
          max="1"
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-24 rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-slate-100 focus:outline-none focus:border-emerald-400"
        />
        <span className="text-[11px] text-slate-500">
          (Tip: total weights auto-normalized)
        </span>
      </div>
    </div>
  );
}

function ScoreInput({ label, value, onChange }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950 px-2 py-1.5">
      <div className="text-[10px] text-slate-400">{label}</div>
      <input
        type="number"
        min="0"
        max="10"
        step="0.5"
        value={value}
        onChange={(e) =>
          onChange(Math.max(0, Math.min(10, Number(e.target.value))))
        }
        className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-100 focus:outline-none focus:border-emerald-400"
      />
    </div>
  );
}
