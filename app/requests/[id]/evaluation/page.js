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

        // ✅ FIX #1: use explicit /po route (matches your server)
        apiGet(`/po-evaluations/po/${encodeURIComponent(requestId)}`, {
          headers: authHeaders,
        }),
      ]);

      const r = reqRes?.data || null;

      const list = Array.isArray(offersRes?.data?.data)
        ? offersRes.data.data
        : [];

      const ev = evalRes?.data || null;

      setReqDoc(r);
      setOffers(list);
      setSavedEval(ev);

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
  }, [authHeaders, headersReady, requestId]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

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

      // ✅ FIX #1: post to /po route too
      const res = await apiPost(`/po-evaluations/po/${requestId}`, payload, {
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

    if (status !== "BID_EVALUATION") {
      toast.error("Only BID_EVALUATION can be recommended");
      return;
    }

    await saveEvaluation();

    const t = toast.loading("Recommending offer...");
    try {
      // ✅ FIX #2: match your backend route name (currently rp-recommend-offer)
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
          Only PROCUREMENT_OFFICER can access this page.
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
      {/* ... YOUR UI BELOW UNCHANGED ... */}
      {/* keep the rest exactly as you wrote */}
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
