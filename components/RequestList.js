"use client";

import Link from "next/link";
import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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

function getErrMsg(e) {
  return (
    e?.response?.data?.error ||
    e?.response?.data?.message ||
    e?.message ||
    "Request failed"
  );
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function isRetryableError(err) {
  if (!err?.response) return true;
  const s = err.response.status;
  return s >= 500;
}

async function fetchWithRetry(fn, { retries = 2, baseDelay = 400 } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn(attempt);
    } catch (e) {
      lastErr = e;
      if (e?.name === "CanceledError" || e?.code === "ERR_CANCELED") throw e;
      if (!isRetryableError(e) || attempt === retries) throw e;
      await sleep(baseDelay * Math.pow(2, attempt));
    }
  }
  throw lastErr;
}

/* =========================
   UI: Status Badge
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
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] justify-center border ${cls}`}
    >
      {s || "—"}
    </span>
  );
}

/* =========================
   Offers Modal
   ✅ FIXED:
   - requestId memo depends on reqDoc?._id (not whole object)
   - offers response parsing supports array OR {data: []}
   - Action column REMOVED
   - Evaluate button uses requestStatus + requestId (correct)
========================= */
function scoreOffer(o) {
  const price = Number(o?.price ?? 1e12);
  const days = Number(o?.deliveryDays ?? 1e6);
  return price * 0.7 + days * 0.3;
}

function OffersModal({ reqDoc, authHeaders, role, onClose, onChanged }) {
  const requestId = useMemo(() => normalizeId(reqDoc?._id), [reqDoc?._id]);

  const [request, setRequest] = useState(reqDoc || null);
  const [offers, setOffers] = useState([]);

  const [loadingOffers, setLoadingOffers] = useState(false);
  const [loadingReq, setLoadingReq] = useState(false);
  const [err, setErr] = useState("");

  const requestStatus = useMemo(
    () => String(request?.status || "").toUpperCase(),
    [request?.status],
  );

  const recommendedOfferId = useMemo(
    () => normalizeId(request?.recommendedOfferId),
    [request?.recommendedOfferId],
  );

  const canRecommend = role === "RESOURCE_PLANNER";
  const canSendToPO = role === "PROJECT_MANAGER";
  const canOrder = role === "PROCUREMENT_OFFICER";

  const canEvaluate =
    role === "RESOURCE_PLANNER" && requestStatus === "BID_EVALUATION";

  const bestAuto = useMemo(() => {
    const arr = (offers || [])
      .slice()
      .sort((a, b) => scoreOffer(a) - scoreOffer(b));
    return arr[0] || null;
  }, [offers]);

  const disabledSendToPO = requestStatus !== "RECOMMENDED";
  const disabledOrder =
    requestStatus !== "SENT_TO_PO" || (!recommendedOfferId && !bestAuto?._id);

  const offersAbortRef = useRef(null);
  const reqAbortRef = useRef(null);

  const loadRequest = useCallback(async () => {
    if (!requestId) return;

    reqAbortRef.current?.abort();
    const ac = new AbortController();
    reqAbortRef.current = ac;

    try {
      setLoadingReq(true);
      const r = await fetchWithRetry(
        () =>
          apiGet(`/requests/${encodeURIComponent(requestId)}`, {
            headers: { ...authHeaders },
            params: { _t: Date.now() },
            signal: ac.signal,
          }),
        { retries: 1 },
      );
      setRequest(r?.data || null);
    } catch (e) {
      if (e?.name === "CanceledError" || e?.code === "ERR_CANCELED") return;
      setErr(getErrMsg(e));
    } finally {
      setLoadingReq(false);
    }
  }, [authHeaders, requestId]);

  const loadOffers = useCallback(async () => {
    if (!requestId) return;

    offersAbortRef.current?.abort();
    const ac = new AbortController();
    offersAbortRef.current = ac;

    try {
      setErr("");
      setLoadingOffers(true);

      const res = await fetchWithRetry(
        () =>
          apiGet("/offers", {
            params: { requestId, _t: Date.now() },
            headers: { ...authHeaders },
            signal: ac.signal,
          }),
        { retries: 2, baseDelay: 450 },
      );

      // ✅ robust parse (array OR {data: []})
      const payload = res?.data;
      const rows = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.data)
          ? payload.data
          : [];

      setOffers(rows);
    } catch (e) {
      if (e?.name === "CanceledError" || e?.code === "ERR_CANCELED") return;
      setOffers([]);
      setErr(getErrMsg(e));
    } finally {
      setLoadingOffers(false);
    }
  }, [authHeaders, requestId]);

  useEffect(() => {
    setRequest(reqDoc || null);
    loadRequest();
    loadOffers();

    return () => {
      offersAbortRef.current?.abort();
      reqAbortRef.current?.abort();
    };
  }, [reqDoc, loadOffers, loadRequest]);

  async function recommend(offerId) {
    try {
      setErr("");
      const res = await apiPost(
        `/requests/${encodeURIComponent(requestId)}/rp-recommend-offer`,
        { offerId },
        {
          headers: { ...authHeaders },
          params: { _t: Date.now() },
        },
      );

      const updatedReq = res?.data?.request;
      const updatedOffers = res?.data?.offers;

      if (updatedReq) setRequest(updatedReq);
      if (Array.isArray(updatedOffers)) setOffers(updatedOffers);

      if (!updatedReq) await loadRequest();
      if (!Array.isArray(updatedOffers)) await loadOffers();

      onChanged?.(updatedReq || null);
    } catch (e) {
      setErr(getErrMsg(e));
    }
  }

  async function sendToPO() {
    try {
      setErr("");
      const res = await apiPost(
        `/requests/${encodeURIComponent(requestId)}/send-to-po`,
        {},
        {
          headers: { ...authHeaders },
          params: { _t: Date.now() },
        },
      );

      const updatedReq = res?.data?.request;
      if (updatedReq) setRequest(updatedReq);
      else await loadRequest();

      onChanged?.(updatedReq || null);
    } catch (e) {
      setErr(getErrMsg(e));
    }
  }

  async function placeOrder() {
    try {
      setErr("");

      const offerId = String(recommendedOfferId || bestAuto?._id || "").trim();
      if (!offerId) {
        setErr("No offer to order (missing recommended offer).");
        return;
      }

      const res = await apiPost(
        `/requests/${encodeURIComponent(requestId)}/order`,
        { offerId },
        {
          headers: { ...authHeaders },
          params: { _t: Date.now() },
        },
      );

      const updatedReq = res?.data?.request;
      if (updatedReq) setRequest(updatedReq);
      else await loadRequest();

      onChanged?.(updatedReq || null);
    } catch (e) {
      setErr(getErrMsg(e));
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="w-full max-w-5xl rounded-2xl border border-slate-800 bg-slate-950 p-4 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
              Offers <StatusBadge status={requestStatus} />
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
            {canSendToPO && (
              <button
                onClick={sendToPO}
                disabled={disabledSendToPO}
                className="px-3 py-2 rounded-xl bg-indigo-500 text-black text-xs disabled:opacity-50"
                type="button"
              >
                Send to PO
              </button>
            )}

            {canOrder && (
              <button
                onClick={placeOrder}
                disabled={disabledOrder}
                className="px-3 py-2 rounded-xl bg-emerald-500 text-black text-xs disabled:opacity-50"
                type="button"
              >
                Place Order
              </button>
            )}

            {canEvaluate ? (
              <Link
                href={`/requests/${encodeURIComponent(requestId)}/evaluation`}
                className="px-3 py-2 rounded-xl bg-emerald-500 text-black text-xs font-semibold hover:bg-emerald-400"
              >
                Evaluate
              </Link>
            ) : null}

            <button
              onClick={() => {
                loadRequest();
                loadOffers();
              }}
              className="px-3 py-2 rounded-xl border border-slate-700 text-xs text-slate-200 hover:bg-slate-800"
              type="button"
            >
              Refresh
            </button>

            <button
              onClick={onClose}
              className="px-3 py-2 rounded-xl border border-slate-700 text-xs text-slate-200 hover:bg-slate-800"
              type="button"
            >
              Close
            </button>
          </div>
        </div>

        {err && (
          <div className="rounded-xl border border-red-900/50 bg-red-950/30 px-3 py-2 text-xs text-red-200">
            {err}
          </div>
        )}

        {/* =========================
   Offers: Card Grid (all devices)
========================= */}
        {!loadingOffers && (!offers || offers.length === 0) && (
          <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4 text-xs text-slate-400">
            No offers found for this request.
          </div>
        )}

        {loadingOffers && (
          <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4 text-xs text-slate-400">
            Loading offers...
          </div>
        )}

        {!!offers?.length && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {(offers || []).map((o) => {
              const oid = normalizeId(o?._id);
              const isRec = recommendedOfferId && oid === recommendedOfferId;

              return (
                <div
                  key={
                    oid ||
                    `${o?.vendor?.companyName}-${o?.roles.length}-${o?.scorecard?.deliveryRisk}-${o?.scorecard?.technicalScore}-${o?.scorecard?.commercialScore}-${o?.scorecard?.overallScore}`
                  }
                  className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4 hover:bg-slate-950/55 transition"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-100 truncate">
                        {o?.vendor?.companyName || "—"}
                      </p>

                      <p className="text-[11px] text-slate-500 mt-0.5 break-words">
                        Offer ID:{" "}
                        <span className="text-slate-300 break-all">
                          {oid || "—"}
                        </span>
                      </p>
                    </div>

                    {isRec ? (
                      <span className="shrink-0 text-[10px] px-2 py-0.5 rounded-full border border-teal-700/40 bg-teal-950/30 text-teal-200">
                        Recommended
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-2">
                      <p className="text-[10px] text-slate-500">For</p>
                      <p className="text-xs text-slate-200">
                        {o?.roles.length || "—"}
                      </p>
                    </div>

                    <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-2">
                      <p className="text-[10px] text-slate-500">
                        Delivery Risk
                      </p>
                      <p className="text-xs text-slate-200">
                        {o?.scorecard?.deliveryRisk ?? "—"}
                      </p>
                    </div>

                    <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-2">
                      <p className="text-[10px] text-slate-500">Technical</p>
                      <p className="text-xs text-slate-200">
                        {o?.scorecard?.technicalScore || "—"}
                      </p>
                    </div>

                    <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-2">
                      <p className="text-[10px] text-slate-500">Commercial</p>
                      <p className="text-xs text-slate-200">
                        {o?.scorecard?.commercialScore || "—"}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 rounded-xl border border-slate-800 bg-slate-950/50 p-3 flex items-center justify-between">
                    <p className="text-[11px] text-slate-500">Overall Score</p>
                    <p className="text-sm font-semibold text-slate-100">
                      {o?.scorecard?.overallScore || "—"}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/* =========================
   RequestList (unchanged)
========================= */
export default function RequestList({ view = "all" }) {
  const router = useRouter();
  const { user, authHeaders, loading: authLoading } = useContext(AuthContext);

  const role = useMemo(() => normalizeRole(user?.role), [user?.role]);

  const headerUsername = useMemo(
    () =>
      normalizeUsername(
        authHeaders?.["x-username"] || user?.username || user?.displayUsername,
      ),
    [authHeaders, user?.username, user?.displayUsername],
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
  const [refreshing, setRefreshing] = useState(false);
  const [err, setErr] = useState("");
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null);

  const [q, setQ] = useState("");
  const [qDebounced, setQDebounced] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const [offersOpen, setOffersOpen] = useState(false);
  const [activeReq, setActiveReq] = useState(null);

  const abortRef = useRef(null);

  useEffect(() => {
    const t = setTimeout(() => setQDebounced(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]);

  const title = useMemo(() => {
    if (view === "my") return "My Requests";
    if (view === "review") return "Requests In Review";
    return "All Requests";
  }, [view]);

  const buildParams = useCallback(() => {
    const params = {};
    if (view === "my") params.view = "my";
    if (view === "review") params.status = "IN_REVIEW";
    if (qDebounced) params.q = qDebounced;
    return params;
  }, [view, qDebounced]);

  const load = useCallback(
    async ({ isManual = false } = {}) => {
      if (!canSee) return;

      if (!headersReady) {
        setList([]);
        setErr("Missing auth header x-user-role. Logout/login again.");
        return;
      }

      if (view === "my" && (!isPM || !usernameReady)) {
        setList([]);
        setErr(
          !isPM
            ? "Only Project Manager can view My Requests."
            : "Missing x-username. Logout/login again.",
        );
        return;
      }

      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;

      try {
        setErr("");
        if (isManual) setRefreshing(true);
        else setLoading(true);

        const params = buildParams();

        const res = await fetchWithRetry(
          () =>
            apiGet("/requests", {
              headers: { ...authHeaders },
              params: { ...params, _t: Date.now() },
              signal: ac.signal,
            }),
          { retries: 2, baseDelay: 450 },
        );

        const payload = res?.data;
        const rows = Array.isArray(payload)
          ? payload
          : Array.isArray(payload?.data)
            ? payload.data
            : [];

        setList(rows);
        setLastUpdatedAt(new Date());
      } catch (e) {
        if (e?.name === "CanceledError" || e?.code === "ERR_CANCELED") return;
        setList([]);
        setErr(getErrMsg(e));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [authHeaders, buildParams, canSee, headersReady, isPM, usernameReady, view],
  );

  useEffect(() => {
    if (authLoading) return;
    load({ isManual: false });
    return () => abortRef.current?.abort();
  }, [authLoading, load]);

  const filtered = useMemo(() => {
    const query = (qDebounced || "").toLowerCase();

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
  }, [list, qDebounced, statusFilter]);

  if (authLoading) {
    return <div className="p-4 text-slate-300 text-sm">Loading session...</div>;
  }

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
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-100">{title}</h2>

          <p className="text-[11px] text-slate-400">
            Total: <span className="text-slate-200">{filtered.length}</span>
            {lastUpdatedAt ? (
              <>
                {" "}
                · Updated:{" "}
                <span className="text-slate-300">
                  {lastUpdatedAt.toLocaleTimeString()}
                </span>
              </>
            ) : null}
          </p>

          {view === "my" && isPM && (
            <p className="text-[11px] text-slate-500">
              Username:{" "}
              <span className="text-slate-300">{headerUsername || "—"}</span>
            </p>
          )}
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
            onClick={() => load({ isManual: true })}
            disabled={loading || refreshing}
            className="px-3 py-2 rounded-xl border border-slate-700 text-sm hover:bg-slate-800 disabled:opacity-60"
          >
            {refreshing ? "Refreshing..." : loading ? "Loading..." : "Refresh"}
          </button>
        </div>
      </div>

      {err && (
        <div className="rounded-xl border border-red-900/50 bg-red-950/30 px-3 py-2 text-xs text-red-200">
          {err}
        </div>
      )}

      {/* =========================
   Requests: Card Grid (all devices)
========================= */}
      {!loading && (!filtered || filtered.length === 0) && (
        <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4 text-xs text-slate-400">
          No requests found.
        </div>
      )}

      {loading && (
        <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4 text-xs text-slate-400">
          Loading requests...
        </div>
      )}

      {!!filtered?.length && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {(filtered || []).map((r) => {
            const id = normalizeId(r._id || r.id);
            const status = String(r?.status || "").toUpperCase();
            const createdBy = normalizeUsername(r?.createdBy);

            const owner =
              isPM &&
              headerUsername &&
              createdBy &&
              headerUsername === createdBy;
            const canEdit = owner && status === "DRAFT";

            return (
              <div
                key={id || `${r?.title}-${r?.createdAt}`}
                className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4 hover:bg-slate-950/55 transition cursor-pointer"
                onClick={() => id && router.push(`/requests/${id}`)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-100 truncate">
                      {r.title || "Untitled"}
                    </p>

                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <StatusBadge status={status} />
                      <span className="text-[11px] text-slate-500">
                        {r.type || "—"}
                      </span>
                    </div>
                  </div>

                  <div className="text-right">
                    <p className="text-[11px] text-slate-500">Created</p>
                    <p className="text-xs text-slate-200">
                      {fmtDate(r.createdAt)}
                    </p>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-2">
                    <p className="text-[10px] text-slate-500">Project</p>
                    <p className="text-xs text-slate-200 truncate">
                      {r.projectId ? `${r.projectId}` : r.projectName || "—"}
                    </p>
                  </div>

                  <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-2">
                    <p className="text-[10px] text-slate-500">Supplier</p>
                    <p className="text-xs text-slate-200 truncate">
                      {r.contractSupplier || "—"}
                    </p>
                  </div>

                  <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-2 col-span-2">
                    <p className="text-[10px] text-slate-500">Created By</p>
                    <p className="text-xs text-slate-200 truncate">
                      {r.createdBy || "—"}
                    </p>
                  </div>
                </div>

                <div
                  className="mt-4 flex flex-wrap gap-2 justify-end"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    className="text-xs px-3 py-2 rounded-xl border border-slate-700 hover:bg-slate-800"
                    onClick={() => {
                      setActiveReq(r);
                      setOffersOpen(true);
                    }}
                  >
                    Offers
                  </button>

                  <Link
                    href={id ? `/requests/${id}` : "/requests"}
                    className="text-xs px-3 py-2 rounded-xl border border-slate-700 hover:bg-slate-800"
                  >
                    View
                  </Link>

                  {role === "RESOURCE_PLANNER" &&
                    status === "BID_EVALUATION" && (
                      <Link
                        href={`/requests/${id}/evaluation`}
                        className="text-xs px-3 py-2 rounded-xl bg-emerald-500 text-black hover:bg-emerald-400"
                      >
                        Evaluate
                      </Link>
                    )}

                  {canEdit && (
                    <Link
                      href={`/requests/${id}/edit`}
                      className="text-xs px-3 py-2 rounded-xl bg-emerald-500 text-black hover:bg-emerald-400"
                    >
                      Edit
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

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
            if (updatedReq?._id) setActiveReq(updatedReq);
            load({ isManual: true });
          }}
        />
      )}
    </div>
  );
}
