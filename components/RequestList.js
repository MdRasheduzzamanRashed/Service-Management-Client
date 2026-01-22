"use client";

import Link from "next/link";
import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthContext } from "../context/AuthContext";
import { apiGet, apiPost } from "../lib/api";

/* =========================
   Utils
========================= */
function normalizeRole(raw) {
  return String(raw || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_");
}
function normalizeUsername(raw) {
  return String(raw || "")
    .trim()
    .toLowerCase();
}
function normalizeId(raw) {
  if (!raw) return "";
  if (typeof raw === "string") return raw;
  if (raw?.$oid) return String(raw.$oid);
  try {
    return String(raw);
  } catch {
    return "";
  }
}
function fmtDate(v) {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString();
}

/* =========================
   UI
========================= */
function StatusBadge({ status }) {
  const s = String(status || "").toUpperCase();

  const cls =
    s === "DRAFT"
      ? "bg-slate-900 border-slate-700 text-slate-300"
      : s === "IN_REVIEW"
        ? "bg-blue-950 border-blue-700 text-blue-300"
        : s === "APPROVED_FOR_SUBMISSION"
          ? "bg-emerald-950 border-emerald-700 text-emerald-300"
          : s === "BIDDING"
            ? "bg-purple-950 border-purple-700 text-purple-300"
            : s === "BID_EVALUATION"
              ? "bg-amber-950 border-amber-700 text-amber-300"
              : s === "RECOMMENDED"
                ? "bg-teal-950 border-teal-700 text-teal-300"
                : s === "SENT_TO_PO"
                  ? "bg-indigo-950 border-indigo-700 text-indigo-300"
                  : s === "ORDERED"
                    ? "bg-green-950 border-green-700 text-green-300"
                    : s === "REJECTED"
                      ? "bg-red-950 border-red-700 text-red-300"
                      : s === "EXPIRED"
                        ? "bg-zinc-950 border-zinc-700 text-zinc-300"
                        : "bg-slate-900 border-slate-700 text-slate-300";

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] border ${cls}`}
    >
      {s || "—"}
    </span>
  );
}

/* =========================
   Offers Modal (FIXED)
========================= */
function scoreOffer(o) {
  const price = Number(o?.price ?? 1e12);
  const days = Number(o?.deliveryDays ?? 1e6);
  return price * 0.7 + days * 0.3;
}

function OffersModal({ reqDoc, authHeaders, role, onClose, onChanged }) {
  const requestId = useMemo(() => normalizeId(reqDoc?._id), [reqDoc]);

  // ✅ KEY: keep a local request state (server truth)
  const [request, setRequest] = useState(reqDoc || null);

  const [offers, setOffers] = useState([]);
  const [loadingOffers, setLoadingOffers] = useState(false);
  const [loadingReq, setLoadingReq] = useState(false);
  const [err, setErr] = useState("");

  const canRecommend = role === "RESOURCE_PLANNER";
  const canSendToPO = role === "PROJECT_MANAGER";
  const canOrder = role === "PROCUREMENT_OFFICER";

  const requestStatus = useMemo(
    () => String(request?.status || "").toUpperCase(),
    [request?.status],
  );

  const recommendedOfferId = useMemo(
    () => String(request?.recommendedOfferId || "").trim(),
    [request?.recommendedOfferId],
  );

  // ✅ always refresh request from server
  const loadRequest = useCallback(async () => {
    if (!requestId) return;
    try {
      setLoadingReq(true);
      const r = await apiGet(`/requests/${requestId}`, {
        headers: authHeaders,
      });
      setRequest(r?.data || null);
    } catch (e) {
      // keep old request if fetch fails
    } finally {
      setLoadingReq(false);
    }
  }, [authHeaders, requestId]);

  const loadOffers = useCallback(async () => {
    if (!requestId) return;
    try {
      setErr("");
      setLoadingOffers(true);
      const res = await apiGet("/offers", {
        params: { requestId },
        headers: authHeaders,
      });
      setOffers(Array.isArray(res?.data) ? res.data : []);
    } catch (e) {
      setOffers([]);
      setErr(e?.response?.data?.error || e?.message || "Failed to load offers");
    } finally {
      setLoadingOffers(false);
    }
  }, [authHeaders, requestId]);

  useEffect(() => {
    setRequest(reqDoc || null);
    loadRequest();
    loadOffers();
  }, [reqDoc, loadRequest, loadOffers]);

  const bestAuto = useMemo(() => {
    const arr = (offers || [])
      .slice()
      .sort((a, b) => scoreOffer(a) - scoreOffer(b));
    return arr[0] || null;
  }, [offers]);

  async function recommend(offerId) {
    try {
      setErr("");
      // ✅ IMPORTANT: backend should return updated request (recommendedOfferId + status)
      const res = await apiPost(
        `/requests/${requestId}/rp-recommend-offer`,
        { offerId },
        { headers: authHeaders },
      );

      // ✅ Prefer server payload if you return it, otherwise re-fetch
      const updatedReq = res?.data?.request;
      const updatedOffers = res?.data?.offers;

      if (updatedReq) setRequest(updatedReq);
      if (Array.isArray(updatedOffers)) setOffers(updatedOffers);

      if (!updatedReq) await loadRequest();
      if (!Array.isArray(updatedOffers)) await loadOffers();

      // notify parent
      onChanged?.(updatedReq || null);
    } catch (e) {
      setErr(e?.response?.data?.error || e?.message || "Recommend failed");
    }
  }

  async function sendToPO() {
    try {
      setErr("");
      const res = await apiPost(
        `/requests/${requestId}/send-to-po`,
        {},
        { headers: authHeaders },
      );

      const updatedReq = res?.data?.request;
      if (updatedReq) setRequest(updatedReq);
      else await loadRequest();

      onChanged?.(updatedReq || null);
    } catch (e) {
      setErr(e?.response?.data?.error || e?.message || "Send to PO failed");
    }
  }

  async function placeOrder() {
    try {
      setErr("");

      // ✅ order should use recommendedOfferId (fresh) if exists
      const offerId = String(recommendedOfferId || bestAuto?._id || "").trim();
      if (!offerId) {
        setErr("No offer to order (missing recommended offer).");
        return;
      }

      const res = await apiPost(
        `/requests/${requestId}/order`,
        { offerId },
        { headers: authHeaders },
      );

      const updatedReq = res?.data?.request;
      if (updatedReq) setRequest(updatedReq);
      else await loadRequest();

      onChanged?.(updatedReq || null);
    } catch (e) {
      setErr(e?.response?.data?.error || e?.message || "Order failed");
    }
  }

  const disabledSendToPO = requestStatus !== "RECOMMENDED";
  const disabledOrder =
    requestStatus !== "SENT_TO_PO" || (!recommendedOfferId && !bestAuto?._id);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl rounded-2xl border border-slate-800 bg-slate-950 p-4 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
              Offers
              <StatusBadge status={requestStatus} />
              {(loadingReq || loadingOffers) && (
                <span className="text-[11px] text-slate-400">(syncing…)</span>
              )}
            </h3>
            <p className="text-xs text-slate-400">
              {request?.title || "Untitled"} ·{" "}
              <span className="text-slate-300">Request ID:</span>{" "}
              <span className="text-slate-200">{requestId || "—"}</span>
            </p>
            <p className="text-[11px] text-slate-500 mt-1">
              Total offers:{" "}
              <span className="text-slate-200">{offers.length}</span>
              {request?.maxOffers ? (
                <>
                  {" "}
                  / MaxOffers:{" "}
                  <span className="text-slate-200">{request.maxOffers}</span>
                </>
              ) : null}
            </p>
            {recommendedOfferId && (
              <p className="text-[11px] text-slate-500 mt-1">
                Recommended Offer ID:{" "}
                <span className="text-slate-200">{recommendedOfferId}</span>
              </p>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                loadRequest();
                loadOffers();
              }}
              className="px-3 py-2 rounded-xl border border-slate-700 text-xs text-slate-200 hover:bg-slate-800"
            >
              Refresh
            </button>
            <button
              onClick={onClose}
              className="px-3 py-2 rounded-xl border border-slate-700 text-xs text-slate-200 hover:bg-slate-800"
            >
              Close
            </button>
          </div>
        </div>

        {err && <div className="text-xs text-red-300">{err}</div>}

        {/* Action bar */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-slate-800 bg-slate-900/30 p-3">
          <div className="text-xs text-slate-300">
            <span className="text-slate-400">Tip:</span> Best offer auto-score
            is{" "}
            <span className="text-slate-200">
              {bestAuto
                ? `${bestAuto.providerUsername} (score ${scoreOffer(bestAuto).toFixed(1)})`
                : "—"}
            </span>
          </div>

          <div className="flex gap-2 flex-wrap justify-end">
            {canSendToPO && (
              <button
                onClick={sendToPO}
                disabled={disabledSendToPO}
                className="px-3 py-2 rounded-xl bg-indigo-500 text-black text-xs disabled:opacity-50"
                title="PM: RECOMMENDED -> SENT_TO_PO"
              >
                Send to PO
              </button>
            )}

            {canOrder && (
              <button
                onClick={placeOrder}
                disabled={disabledOrder}
                className="px-3 py-2 rounded-xl bg-emerald-500 text-black text-xs disabled:opacity-50"
                title="PO: SENT_TO_PO -> ORDERED"
              >
                Place Order
              </button>
            )}
          </div>
        </div>

        {/* Offers table */}
        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="min-w-[900px] w-full text-sm">
            <thead className="bg-slate-950/60 text-[11px] text-slate-400">
              <tr>
                <th className="px-3 py-2 text-left">Provider</th>
                <th className="px-3 py-2 text-left">Price</th>
                <th className="px-3 py-2 text-left">Delivery Days</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-left">Created</th>
                <th className="px-3 py-2 text-right">Action</th>
              </tr>
            </thead>

            <tbody>
              {offers.map((o) => {
                const oid = normalizeId(o?._id);
                const isRec =
                  recommendedOfferId &&
                  String(oid) === String(recommendedOfferId);

                return (
                  <tr
                    key={oid || Math.random()}
                    className="border-t border-slate-800 hover:bg-slate-950/30"
                  >
                    <td className="px-3 py-2 text-slate-100">
                      {o?.providerName || o?.providerUsername || "—"}
                      {isRec ? (
                        <span className="ml-2 text-[10px] px-2 py-0.5 rounded-full border border-teal-700/40 bg-teal-950/30 text-teal-200">
                          Recommended
                        </span>
                      ) : null}
                    </td>

                    <td className="px-3 py-2 text-slate-300">
                      {o?.price != null
                        ? `${o.price} ${o.currency || "EUR"}`
                        : "—"}
                    </td>

                    <td className="px-3 py-2 text-slate-300">
                      {o?.deliveryDays ?? "—"}
                    </td>

                    <td className="px-3 py-2">
                      <span className="text-[11px] px-2 py-0.5 rounded-full border border-slate-700 bg-slate-900 text-slate-200">
                        {String(o?.status || "").toUpperCase() || "—"}
                      </span>
                    </td>

                    <td className="px-3 py-2 text-slate-300">
                      {fmtDate(o?.createdAt)}
                    </td>

                    <td className="px-3 py-2 text-right">
                      {canRecommend ? (
                        <button
                          className="px-2 py-1 rounded-lg bg-emerald-500 text-black text-xs hover:bg-emerald-400 disabled:opacity-50"
                          onClick={() => recommend(oid)}
                          disabled={!oid || requestStatus !== "BID_EVALUATION"}
                          title="RP: Recommend this offer"
                        >
                          Recommend
                        </button>
                      ) : (
                        <span className="text-xs text-slate-500">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}

              {!loadingOffers && offers.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-xs text-slate-400">
                    No offers found for this request.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <p className="text-[11px] text-slate-500">
          Uses{" "}
          <span className="text-slate-300">GET /api/offers?requestId=...</span>{" "}
          and actions{" "}
          <span className="text-slate-300">/api/requests/:id/...</span>.
        </p>
      </div>
    </div>
  );
}

/* =========================
   Main Component
========================= */
export default function RequestList({ view = "all" }) {
  const router = useRouter();
  const { user, authHeaders, loading: authLoading } = useContext(AuthContext);

  const role = useMemo(() => normalizeRole(user?.role), [user?.role]);
  const username = useMemo(
    () => normalizeUsername(user?.username),
    [user?.username],
  );

  const isPM = role === "PROJECT_MANAGER";
  const canSee =
    role === "PROJECT_MANAGER" ||
    role === "PROCUREMENT_OFFICER" ||
    role === "RESOURCE_PLANNER" ||
    role === "SYSTEM_ADMIN";

  const headersReady = !!authHeaders?.["x-user-role"];
  const usernameReady = !!authHeaders?.["x-username"];

  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const [offersOpen, setOffersOpen] = useState(false);
  const [activeReq, setActiveReq] = useState(null);

  const title = useMemo(() => {
    if (view === "my") return "My Requests";
    if (view === "review") return "Requests In Review";
    return "All Requests";
  }, [view]);

  const load = useCallback(async () => {
    if (!canSee) return;
    if (!headersReady) return;

    if (view === "my" && (!isPM || !usernameReady)) {
      setList([]);
      setErr(
        !isPM
          ? "Only Project Manager can view My Requests."
          : "Missing x-username. Logout/login again.",
      );
      return;
    }

    try {
      setErr("");
      setLoading(true);

      const params = {};
      if (view === "my") params.view = "my";
      if (view === "review") params.status = "IN_REVIEW";

      const res = await apiGet("/requests", { headers: authHeaders, params });
      setList(Array.isArray(res?.data) ? res.data : []);
    } catch (e) {
      setList([]);
      setErr(
        e?.response?.data?.error || e?.message || "Failed to load requests",
      );
    } finally {
      setLoading(false);
    }
  }, [authHeaders, canSee, headersReady, isPM, usernameReady, view]);

  useEffect(() => {
    if (authLoading) return;
    load();
  }, [authLoading, load]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return (list || []).filter((r) => {
      const s = String(r?.status || "").toUpperCase();
      const okStatus = statusFilter === "ALL" ? true : s === statusFilter;

      const okQuery = !query
        ? true
        : [
            r?.title,
            r?.projectId,
            r?.projectName,
            r?.contractSupplier,
            r?.createdBy,
            r?.type,
            r?.performanceLocation,
          ]
            .filter(Boolean)
            .some((x) => String(x).toLowerCase().includes(query));

      return okStatus && okQuery;
    });
  }, [list, q, statusFilter]);

  if (authLoading)
    return <div className="p-4 text-slate-300 text-sm">Loading session...</div>;

  if (!canSee) {
    return (
      <div className="p-4">
        <p className="text-xs text-red-400">Not allowed to view requests.</p>
      </div>
    );
  }

  if (!headersReady) {
    return (
      <div className="p-4">
        <p className="text-xs text-amber-300">
          Missing auth header x-user-role. Logout/login again.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4 space-y-4">
      {/* header + controls */}
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-100">{title}</h2>
          <p className="text-[11px] text-slate-400">
            Total: <span className="text-slate-200">{filtered.length}</span>
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search title, project, supplier, createdBy..."
            className="w-full sm:w-72 border border-slate-700 rounded-xl px-3 py-2 bg-slate-950 text-sm focus:outline-none focus:border-emerald-400"
          />

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border border-slate-700 rounded-xl px-3 py-2 bg-slate-950 text-sm focus:outline-none focus:border-emerald-400"
          >
            <option value="ALL">All Status</option>
            <option value="DRAFT">DRAFT</option>
            <option value="IN_REVIEW">IN_REVIEW</option>
            <option value="APPROVED_FOR_SUBMISSION">
              APPROVED_FOR_SUBMISSION
            </option>
            <option value="BIDDING">BIDDING</option>
            <option value="BID_EVALUATION">BID_EVALUATION</option>
            <option value="RECOMMENDED">RECOMMENDED</option>
            <option value="SENT_TO_PO">SENT_TO_PO</option>
            <option value="ORDERED">ORDERED</option>
            <option value="REJECTED">REJECTED</option>
            <option value="EXPIRED">EXPIRED</option>
          </select>

          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="px-3 py-2 rounded-xl border border-slate-700 text-sm hover:bg-slate-800 disabled:opacity-60"
          >
            {loading ? "Loading..." : "Refresh"}
          </button>
        </div>
      </div>

      {err && <div className="text-xs text-red-300">{err}</div>}

      {/* table */}
      <div className="overflow-x-auto rounded-xl border border-slate-800">
        <table className="w-full text-sm">
          <thead className="bg-slate-950/60">
            <tr className="text-center text-slate-400">
              <th className="px-3 py-2">Title</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">Project</th>
              <th className="px-3 py-2">Supplier</th>
              <th className="px-3 py-2">Created By</th>
              <th className="px-3 py-2">Created</th>
              <th className="px-3 py-2 text-right">Action</th>
            </tr>
          </thead>

          <tbody>
            {filtered.map((r) => {
              const id = normalizeId(r._id || r.id);
              const status = String(r?.status || "").toUpperCase();
              const createdBy = normalizeUsername(r?.createdBy);

              const owner =
                isPM && username && createdBy && username === createdBy;
              const canEdit = owner && status === "DRAFT";

              return (
                <tr
                  key={id || Math.random()}
                  className="border-t border-slate-800 hover:bg-slate-950/30 cursor-pointer"
                  onClick={() => id && router.push(`/requests/${id}`)}
                >
                  <td className="px-3 py-2 text-slate-100 max-w-[320px] truncate">
                    {r.title || "Untitled"}
                  </td>

                  <td className="px-3 py-2">
                    <StatusBadge status={status} />
                  </td>

                  <td className="px-3 py-2 text-slate-300">{r.type || "—"}</td>

                  <td className="px-3 py-2 text-slate-300">
                    {r.projectId ? `${r.projectId}` : r.projectName || "—"}
                  </td>

                  <td className="px-3 py-2 text-slate-300">
                    {r.contractSupplier || "—"}
                  </td>

                  <td className="px-3 py-2 text-slate-300">
                    {r.createdBy || "—"}
                  </td>

                  <td className="px-3 py-2 text-slate-300">
                    {fmtDate(r.createdAt)}
                  </td>

                  <td className="px-3 py-2 text-right">
                    <div
                      className="flex flex-wrap justify-end gap-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        className="text-xs px-2 py-1 rounded-lg border border-slate-700 hover:bg-slate-800"
                        onClick={() => {
                          setActiveReq(r);
                          setOffersOpen(true);
                        }}
                      >
                        Offers
                      </button>

                      <Link
                        href={id ? `/requests/${id}` : "/requests"}
                        className="text-xs px-2 py-1 rounded-lg border border-slate-700 hover:bg-slate-800"
                      >
                        View
                      </Link>

                      {canEdit && (
                        <Link
                          href={`/requests/${id}/edit`}
                          className="text-xs px-2 py-1 rounded-lg bg-emerald-500 text-black hover:bg-emerald-400"
                        >
                          Edit
                        </Link>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}

            {!loading && filtered.length === 0 && (
              <tr>
                <td className="px-3 py-5 text-slate-400 text-xs" colSpan={8}>
                  No requests found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Offers modal */}
      {offersOpen && activeReq && (
        <OffersModal
          reqDoc={activeReq}
          authHeaders={authHeaders}
          role={role}
          onClose={() => {
            setOffersOpen(false);
            setActiveReq(null);
          }}
          onChanged={(updatedReq) => {
            // update row state quickly (optional)
            if (updatedReq?._id) setActiveReq(updatedReq);
            load(); // refresh list always
          }}
        />
      )}
    </div>
  );
}
