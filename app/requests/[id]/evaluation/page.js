"use client";

import { useContext, useEffect, useMemo, useState, useCallback } from "react";
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

function safeNum(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/* =========================
   Offer Adapter
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

function getSupplierScorecard(o) {
  const tech = o?.scorecard?.technicalScore;
  const comm = o?.scorecard?.commercialScore;
  const risk = o?.scorecard?.deliveryRisk;

  const techTxt = Number.isFinite(Number(tech))
    ? `TS: ${Number(tech).toFixed(0)}`
    : "TS: —";
  const commTxt = Number.isFinite(Number(comm))
    ? `CS: ${Number(comm).toFixed(0)}`
    : "CS: —";

  const riskTxt = risk != null ? `DR: ${risk}` : "DR: —";

  return { techTxt, commTxt, riskTxt };
}

/* =========================
   API response adapters
========================= */
function extractOffers(payload) {
  // apiGet returns axios response => { data: ... }
  const root = payload?.data;

  if (Array.isArray(root)) return root;
  if (Array.isArray(root?.data)) return root.data;
  if (Array.isArray(root?.offers)) return root.offers;

  // your offers endpoint sometimes returns { data: { data:[...] } }
  if (Array.isArray(root?.data?.data)) return root.data.data;

  return [];
}

/* =========================================================
   ✅ PO Evaluation Page
========================================================= */
export default function POEvaluationPage() {
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

  const canUse = role === "PROCUREMENT_OFFICER" || role === "SYSTEM_ADMIN";
  const status = useMemo(() => roleUpper(reqDoc?.status), [reqDoc?.status]);

  const headersReady = !!authHeaders?.["x-user-role"];

  function computeTotalScore(offerId) {
    const s = scores[offerId] || {};
    const price = clamp0to10(s.price);
    const delivery = clamp0to10(s.delivery);
    const quality = clamp0to10(s.quality);

    const sum = safeNum(wPrice) + safeNum(wDelivery) + safeNum(wQuality) || 1;
    const wp = safeNum(wPrice) / sum;
    const wd = safeNum(wDelivery) / sum;
    const wq = safeNum(wQuality) / sum;

    return price * wp + delivery * wd + quality * wq;
  }

  const ranked = useMemo(() => {
    const rows = (offers || []).map((o) => {
      const oid = idStr(o?._id) || idStr(o?.id);
      return { offer: o, offerId: oid, total: computeTotalScore(oid) };
    });
    rows.sort((a, b) => b.total - a.total);
    return rows;
  }, [offers, scores, wPrice, wDelivery, wQuality]);

  const loadAll = useCallback(async () => {
    if (!requestId) return;
    if (!headersReady) return;

    setLoading(true);

    try {
      const [reqRes, offersRes, evalRes] = await Promise.all([
        apiGet(`/requests/${encodeURIComponent(requestId)}`, {
          headers: authHeaders,
        }),
        apiGet(`/offers/by-request/${encodeURIComponent(requestId)}`, {
          headers: authHeaders,
        }),
        apiGet(`/po-evaluations/po/${encodeURIComponent(requestId)}`, {
          headers: authHeaders,
        }),
      ]);

      const r = reqRes?.data || null;
      const list = extractOffers(offersRes);

      const ev = evalRes?.data || null;

      setReqDoc(r);
      setOffers(list);
      setSavedEval(ev);

      // hydrate weights / comment / recommended / scores
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
        const next = {};
        for (const o of list) {
          const oid = idStr(o?._id) || idStr(o?.id);
          if (!oid) continue;
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
  }, [authHeaders, headersReady, requestId]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const setScoreField = (offerId, field, value) => {
    setScores((prev) => ({
      ...prev,
      [offerId]: {
        ...(prev[offerId] || { price: 0, delivery: 0, quality: 0, notes: "" }),
        [field]: value,
      },
    }));
  };

  async function saveEvaluation() {
    const t = toast.loading("Saving evaluation...");
    try {
      const payload = {
        weights: { price: wPrice, delivery: wDelivery, quality: wQuality },
        comment,
        recommendedOfferId: recommendedOfferId || "",
        offers: (offers || []).map((o) => {
          const oid = idStr(o?._id) || idStr(o?.id);
          const s = scores[oid] || {};
          return {
            offerId: oid,
            providerUsername: getProviderUsername(o) || "",
            providerName: getProviderName(o) || "",
            price: getPrice(o),
            currency: getCurrency(o),
            supplierScorecard: getSupplierScorecard(o),
            deliveryDays: o?.deliveryDays ?? null,
            scorePrice: clamp0to10(s.price),
            scoreDelivery: clamp0to10(s.delivery),
            scoreQuality: clamp0to10(s.quality),
            totalScore: Number(computeTotalScore(oid).toFixed(4)),
            notes: s.notes || "",
          };
        }),
      };

      const res = await apiPost(`/po-evaluations/po/${requestId}`, payload, {
        headers: authHeaders,
      });

      // some servers return {data:{...}}, others return direct doc
      setSavedEval(res?.data?.data || res?.data || null);
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

    if (status !== "BID_EVALUATION") {
      toast.error("Only BID_EVALUATION can be recommended");
      return;
    }

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

  /* =========================
     Guards
  ========================= */
  if (!headersReady) {
    return (
      <div className="p-4 rounded-2xl border border-slate-800 bg-slate-900/30">
        <p className="text-sm text-amber-300">Loading session…</p>
      </div>
    );
  }

  if (!canUse) {
    return (
      <div className="p-4 rounded-2xl border border-slate-800 bg-slate-900/30">
        <p className="text-sm text-red-300">
          Only PROCUREMENT_OFFICER or SYSTEM_ADMIN can access this page.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-4 text-slate-300 text-sm">Loading evaluation...</div>
    );
  }

  /* =========================
     UI
  ========================= */
  const reqTitle =
    reqDoc?.title ||
    reqDoc?.projectName ||
    reqDoc?.projectId ||
    `Request ${requestId}`;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-base font-semibold text-slate-100 truncate">
              PO Evaluation
            </h1>
            <p className="mt-1 text-xs text-slate-400 break-all">
              Request: <span className="text-slate-200">{requestId}</span>
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Title: <span className="text-slate-200">{reqTitle}</span>
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Status: <span className="text-slate-200">{status || "—"}</span>
              {savedEval ? (
                <span className="ml-2 text-[11px] text-emerald-300">
                  (Saved)
                </span>
              ) : (
                <span className="ml-2 text-[11px] text-slate-500">
                  (Not saved yet)
                </span>
              )}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => router.push(`/requests/${requestId}`)}
              className="w-full sm:w-auto text-xs px-3 py-2 rounded-xl border border-slate-700 hover:bg-slate-800"
            >
              ← Back
            </button>

            <button
              type="button"
              onClick={saveEvaluation}
              className="w-full sm:w-auto text-xs px-3 py-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/15"
            >
              Save
            </button>

            <button
              type="button"
              onClick={recommendNow}
              disabled={status !== "BID_EVALUATION"}
              className="w-full sm:w-auto text-xs px-3 py-2 rounded-xl bg-emerald-500 text-black font-semibold hover:bg-emerald-400 disabled:opacity-60"
              title={
                status !== "BID_EVALUATION"
                  ? "Only BID_EVALUATION can be recommended"
                  : "Recommend selected offer"
              }
            >
              Recommend
            </button>
          </div>
        </div>
      </div>

      {/* Weights */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <WeightCard label="Price Weight" value={wPrice} onChange={setWPrice} />
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

      {/* Comment + Recommended */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="lg:col-span-2 rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
          <h3 className="text-sm font-semibold text-slate-100">Comment</h3>
          <p className="mt-1 text-[11px] text-slate-500">
            Add your evaluation notes (optional).
          </p>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={5}
            className="mt-3 w-full rounded-xl border border-slate-700 bg-slate-950/40 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 outline-none focus:border-emerald-400/60"
            placeholder="Write your notes…"
          />
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
          <h3 className="text-sm font-semibold text-slate-100">
            Recommended Offer
          </h3>
          <p className="mt-1 text-[11px] text-slate-500">
            Select one offer to recommend.
          </p>

          <select
            value={recommendedOfferId}
            onChange={(e) => setRecommendedOfferId(e.target.value)}
            className="mt-3 w-full rounded-xl border border-slate-700 bg-slate-950/40 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-400/60"
          >
            <option value="">-- Select --</option>
            {ranked.map((r) => {
              const o = r.offer;
              const oid = r.offerId;
              const name = getProviderName(o);
              const price = getPrice(o);
              const currency = getCurrency(o);
              return (
                <option key={oid} value={oid}>
                  {name} — {price != null ? fmtMoney(price, currency) : "—"} —{" "}
                  Total {r.total.toFixed(2)}
                </option>
              );
            })}
          </select>

          <div className="mt-3 rounded-xl border border-slate-800 bg-slate-950/30 p-3">
            <p className="text-[11px] text-slate-500">Tip</p>
            <p className="text-xs text-slate-300">
              You can also choose by clicking “Recommend” on a card below.
            </p>
          </div>
        </div>
      </div>

      {/* Offers */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h3 className="text-sm font-semibold text-slate-100">Offers</h3>
            <p className="mt-1 text-[11px] text-slate-500">
              Score each offer (0–10). Total score is computed from weights.
            </p>
          </div>

          <button
            type="button"
            onClick={loadAll}
            className="text-xs px-3 py-2 rounded-xl border border-slate-700 hover:bg-slate-800"
          >
            Refresh
          </button>
        </div>

        {ranked.length === 0 ? (
          <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/30 p-4 text-sm text-slate-300">
            No offers found for this request.
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-3">
            {ranked.map(({ offer: o, offerId, total }, idx) => {
              const s = scores[offerId] || {
                price: 0,
                delivery: 0,
                quality: 0,
                notes: "",
              };

              const providerName = getProviderName(o);
              const providerUsername = getProviderUsername(o);
              const currency = getCurrency(o);
              const price = getPrice(o);
              const sc = getSupplierScorecard(o);

              const isRec = recommendedOfferId === offerId;

              return (
                <div
                  key={offerId}
                  className={`rounded-2xl border p-4 bg-slate-950/35 ${
                    isRec
                      ? "border-emerald-400/60"
                      : "border-slate-800 hover:border-slate-700"
                  } transition`}
                >
                  {/* Card header */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs rounded-lg border border-slate-700 bg-slate-950/30 px-2 py-1 text-slate-200">
                          Rank #{idx + 1}
                        </span>
                        {isRec ? (
                          <span className="text-xs rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-emerald-200">
                            Recommended
                          </span>
                        ) : null}
                      </div>

                      <p className="mt-2 text-sm font-semibold text-slate-100 truncate">
                        {providerName}
                      </p>
                      <p className="mt-1 text-[11px] text-slate-500 break-all">
                        {providerUsername ? `@${providerUsername}` : "—"}
                      </p>

                      <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-slate-400">
                        <span className="rounded-lg border border-slate-800 bg-slate-950/30 px-2 py-1">
                          {sc.techTxt}
                        </span>
                        <span className="rounded-lg border border-slate-800 bg-slate-950/30 px-2 py-1">
                          {sc.commTxt}
                        </span>
                        <span className="rounded-lg border border-slate-800 bg-slate-950/30 px-2 py-1">
                          {sc.riskTxt}
                        </span>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-[11px] text-slate-500">Price</div>
                      <div className="text-sm font-semibold text-slate-100">
                        {price != null ? fmtMoney(price, currency) : "—"}
                      </div>

                      <div className="mt-2 text-[11px] text-slate-500">
                        Total Score
                      </div>
                      <div className="text-base font-bold text-emerald-200">
                        {total.toFixed(2)}
                      </div>
                    </div>
                  </div>

                  {/* Score inputs */}
                  <div className="mt-4 grid grid-cols-3 gap-2">
                    <ScoreInput
                      label="Price (0–10)"
                      value={s.price}
                      onChange={(v) => setScoreField(offerId, "price", v)}
                    />
                    <ScoreInput
                      label="Delivery (0–10)"
                      value={s.delivery}
                      onChange={(v) => setScoreField(offerId, "delivery", v)}
                    />
                    <ScoreInput
                      label="Quality (0–10)"
                      value={s.quality}
                      onChange={(v) => setScoreField(offerId, "quality", v)}
                    />
                  </div>

                  {/* Notes */}
                  <div className="mt-3">
                    <label className="text-[11px] text-slate-400">Notes</label>
                    <textarea
                      value={s.notes || ""}
                      onChange={(e) =>
                        setScoreField(offerId, "notes", e.target.value)
                      }
                      rows={3}
                      className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950/40 px-3 py-2 text-xs text-slate-100 placeholder:text-slate-600 outline-none focus:border-emerald-400/60"
                      placeholder="Optional notes about this provider…"
                    />
                  </div>

                  {/* Actions */}
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <div className="text-[11px] text-slate-500">
                      Delivery days:{" "}
                      <span className="text-slate-200">
                        {o?.deliveryDays != null ? String(o.deliveryDays) : "—"}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => setRecommendedOfferId(offerId)}
                      className={`text-xs px-3 py-2 rounded-xl border transition active:scale-[0.99] ${
                        isRec
                          ? "border-emerald-400/60 bg-emerald-500/10 text-emerald-200"
                          : "border-slate-700 hover:bg-slate-800 text-slate-200"
                      }`}
                      title="Set as recommended"
                    >
                      {isRec ? "Selected" : "Recommend"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Bottom actions */}
      <div className="flex flex-col sm:flex-row gap-2 justify-end">
        <button
          type="button"
          onClick={saveEvaluation}
          className="w-full sm:w-auto text-xs px-4 py-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/15"
        >
          Save Evaluation
        </button>
        <button
          type="button"
          onClick={recommendNow}
          disabled={status !== "BID_EVALUATION"}
          className="w-full sm:w-auto text-xs px-4 py-2 rounded-xl bg-emerald-500 text-black font-semibold hover:bg-emerald-400 disabled:opacity-60"
        >
          Recommend Now
        </button>
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
