// app/public/offer-json/page.jsx
"use client";

import { useMemo, useState } from "react";
import toast from "react-hot-toast";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ||
  (process.env.NODE_ENV === "development" ? "http://localhost:8000" : "");

function safeStr(x) {
  return String(x ?? "").trim();
}

export default function PublicOfferJsonPage() {
  const [jsonText, setJsonText] = useState(`[
  {
    "requestId": "6979d60cbff4eab9448ea28f",
    "offerTitle": "Balanced quality & delivery",
    "providerUsername": "provider_alpha",
    "providerName": "Alpha Digital GmbH",
    "price": 11850,
    "currency": "EUR",
    "deliveryDays": 7,
    "deliveryRisk": "LOW",
    "scorePrice": 8.2,
    "scoreDelivery": 7.5,
    "scoreQuality": 8.5,
    "totalScore": 8.06,
    "evaluationSummary": "Best overall balance between price, delivery speed, and quality.",
    "createdAt": "2026-01-28T09:45:00.000Z"
  }
]`);

  const [submitting, setSubmitting] = useState(false);
  const [lastResponse, setLastResponse] = useState(null);

  // ✅ Status preview panel
  const [requestPreview, setRequestPreview] = useState(null);
  const [previewError, setPreviewError] = useState("");

  const biddingListUrl = useMemo(
    () => `${API_BASE}/api/requests/bidding`,
    [API_BASE],
  );

  const offersPostUrl = useMemo(
    () => `${API_BASE}/api/offers/public-push`,
    [API_BASE],
  );

  function parseOffersFromText(text) {
    const parsed = JSON.parse(text);

    const offersArr = Array.isArray(parsed) ? parsed : [parsed];
    if (!offersArr.length) throw new Error("Empty JSON.");

    for (const it of offersArr) {
      if (!it || typeof it !== "object" || Array.isArray(it)) {
        throw new Error("Each offer must be a JSON object.");
      }
    }

    const requestId = safeStr(offersArr?.[0]?.requestId);
    if (!requestId) throw new Error('Your JSON must include "requestId".');

    const allSame = offersArr.every((o) => safeStr(o?.requestId) === requestId);
    if (!allSame) throw new Error("All offers must have the same requestId.");

    return { parsed, offersArr, requestId };
  }

  async function fetchBiddingRequestMeta(requestId) {
    const res = await fetch(biddingListUrl, { cache: "no-store" });
    const data = await res.json().catch(() => null);

    if (!res.ok) {
      throw new Error(
        data?.error || `Failed to load bidding list (${res.status})`,
      );
    }

    const list = Array.isArray(data?.data) ? data.data : [];

    // In your /api/requests/bidding endpoint, each item has _id + status=BIDDING
    // and typically includes offersCount + maxOffers.
    const found = list.find((r) => String(r?._id) === String(requestId));

    return found || null;
  }

  async function previewRequestStatus() {
    setRequestPreview(null);
    setPreviewError("");

    let requestId = "";
    try {
      ({ requestId } = parseOffersFromText(jsonText));
    } catch (e) {
      setPreviewError(e?.message || "Invalid JSON.");
      return;
    }

    const t = toast.loading("Checking request status in BIDDING...");
    try {
      const meta = await fetchBiddingRequestMeta(requestId);
      if (!meta) {
        setRequestPreview(null);
        setPreviewError("Not found in BIDDING list.");
        toast.error("Not found in BIDDING list.", { id: t });
        return;
      }

      setRequestPreview(meta);
      setPreviewError("");
      toast.success("Request is in BIDDING ✅", { id: t });
    } catch (e) {
      const msg = e?.message || "Failed to check request.";
      setRequestPreview(null);
      setPreviewError(msg);
      toast.error(msg, { id: t });
    }
  }

  async function submit(e) {
    e.preventDefault();
    setLastResponse(null);

    let parsed, offersArr, requestId;
    try {
      ({ parsed, offersArr, requestId } = parseOffersFromText(jsonText));
    } catch (err) {
      toast.error(err?.message || "Invalid JSON.");
      return;
    }

    setSubmitting(true);
    const t = toast.loading("Validating requestId in BIDDING...");

    try {
      const meta = await fetchBiddingRequestMeta(requestId);

      if (!meta) {
        toast.error(
          "Submit blocked: requestId is not found in BIDDING requests.",
          { id: t },
        );
        setRequestPreview(null);
        setPreviewError("Not found in BIDDING list.");
        return;
      }

      // ✅ show preview panel using what we already fetched
      setRequestPreview(meta);
      setPreviewError("");

      const maxOffers = Number(meta?.maxOffers);
      const offersCount = Number(meta?.offersCount);

      // ⚠️ Frontend pre-check (best effort):
      // If maxOffers/offersCount exist, block if this submit would exceed.
      // (Backend MUST still enforce this.)
      if (
        Number.isFinite(maxOffers) &&
        maxOffers > 0 &&
        Number.isFinite(offersCount) &&
        offersCount >= 0
      ) {
        const remaining = maxOffers - offersCount;
        const submitCount = offersArr.length;

        if (remaining <= 0) {
          toast.error("Submit blocked: maxOffers already reached.", { id: t });
          return;
        }

        if (submitCount > remaining) {
          toast.error(
            `Submit blocked: only ${remaining} offer(s) remaining, but you are submitting ${submitCount}.`,
            { id: t },
          );
          return;
        }
      }

      toast.loading(
        `Request is BIDDING ✅ Submitting ${offersArr.length} offer(s)...`,
        { id: t },
      );

      const postRes = await fetch(offersPostUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed), // ✅ keep EXACT (object or array)
      });

      const postJson = await postRes.json().catch(() => null);

      if (!postRes.ok) {
        throw new Error(
          postJson?.error || `Offer submit failed (${postRes.status})`,
        );
      }

      setLastResponse(postJson);
      toast.success("Offer submitted successfully!", { id: t });
    } catch (err) {
      toast.error(err?.message || "Failed", { id: t });
    } finally {
      setSubmitting(false);
    }
  }

  const remainingSlots = useMemo(() => {
    if (!requestPreview) return null;
    const maxOffers = Number(requestPreview?.maxOffers);
    const offersCount = Number(requestPreview?.offersCount);
    if (!Number.isFinite(maxOffers) || maxOffers <= 0) return null;
    if (!Number.isFinite(offersCount) || offersCount < 0) return null;
    return Math.max(0, maxOffers - offersCount);
  }, [requestPreview]);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-8">
      <div className="mx-auto max-w-4xl space-y-4">
        <header className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4 sm:p-6">
          <h1 className="text-lg font-semibold">
            Public Offer Submit (JSON only)
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Paste offer JSON as <span className="text-slate-200">object</span>{" "}
            or <span className="text-slate-200">array</span>. Submit is allowed
            only if requestId is in{" "}
            <span className="text-slate-200">/api/requests/bidding</span>.
          </p>
          <p className="text-[11px] text-slate-500 mt-2 break-all">
            Validate: <span className="text-slate-200">{biddingListUrl}</span>
            <br />
            Post to: <span className="text-slate-200">{offersPostUrl}</span>
          </p>
        </header>

        {/* ✅ Preview panel */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4 sm:p-6">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <p className="text-sm font-semibold">Request status preview</p>
            <button
              type="button"
              onClick={previewRequestStatus}
              className="text-xs px-3 py-2 rounded-xl border border-slate-700 hover:bg-slate-800"
            >
              Check requestId
            </button>
          </div>

          {previewError ? (
            <p className="mt-2 text-sm text-red-200">{previewError}</p>
          ) : requestPreview ? (
            <div className="mt-3 grid gap-3 grid-cols-1 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
                <p className="text-[11px] text-slate-500">Request ID</p>
                <p className="text-sm font-semibold break-all">
                  {String(requestPreview?._id)}
                </p>
                <p className="mt-2 text-[11px] text-slate-500">Title</p>
                <p className="text-sm">{requestPreview?.title || "—"}</p>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
                <p className="text-[11px] text-slate-500">Bidding</p>
                <p className="text-sm">
                  Offers received:{" "}
                  <span className="font-semibold">
                    {requestPreview?.offersCount ?? "—"}
                  </span>
                </p>
                <p className="text-sm">
                  Max offers allowed:{" "}
                  <span className="font-semibold">
                    {requestPreview?.maxOffers ?? "—"}
                  </span>
                </p>
                <p className="text-sm">
                  Remaining slots:{" "}
                  <span className="font-semibold">
                    {remainingSlots == null ? "—" : remainingSlots}
                  </span>
                </p>
              </div>
            </div>
          ) : (
            <p className="mt-2 text-sm text-slate-400">
              Click <span className="text-slate-200">Check requestId</span> to
              see max offers and remaining slots.
            </p>
          )}
        </div>

        <form
          onSubmit={submit}
          className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4 sm:p-6 space-y-3"
        >
          <label className="text-xs text-slate-300">
            Offer JSON (single field)
          </label>

          <textarea
            value={jsonText}
            onChange={(e) => setJsonText(e.target.value)}
            rows={16}
            className="w-full rounded-xl border border-slate-700 bg-slate-950/40 px-3 py-2 font-mono text-[12px] text-slate-100 focus:outline-none focus:border-emerald-400"
            spellCheck={false}
          />

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={previewRequestStatus}
              className="px-5 py-2 rounded-xl bg-slate-900 text-slate-100 border border-slate-700 hover:bg-slate-800"
              disabled={submitting}
            >
              Check
            </button>

            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 rounded-xl bg-emerald-500 text-black font-semibold hover:bg-emerald-400 disabled:opacity-60"
            >
              {submitting ? "Submitting..." : "Validate & Submit"}
            </button>
          </div>
        </form>

        {lastResponse ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4 sm:p-6">
            <p className="text-sm font-semibold">Server Response</p>
            <pre className="mt-3 text-[11px] text-slate-200 overflow-auto">
              {JSON.stringify(lastResponse, null, 2)}
            </pre>
          </div>
        ) : null}
      </div>
    </main>
  );
}
