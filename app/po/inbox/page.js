"use client";

import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { AuthContext } from "../../../context/AuthContext";
import { apiGet, apiPost } from "../../../lib/api";

/* =========================
   Helpers
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

function fmtDate(v) {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

function escapeRegex(s) {
  return String(s || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/* =========================
   UI helpers
========================= */
function Chip({ active, children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl px-3 py-2 text-xs border transition active:scale-[0.99] ${
        active
          ? "border-emerald-400/60 bg-emerald-500/10 text-emerald-200"
          : "border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800"
      }`}
    >
      {children}
    </button>
  );
}

function SkeletonLine({ w = "w-full" }) {
  return <div className={`h-3 ${w} rounded bg-slate-800/70 animate-pulse`} />;
}

function TableSkeleton() {
  return (
    <div className="rounded-xl border border-slate-800 overflow-hidden">
      <div className="bg-slate-950/60 px-3 py-3">
        <SkeletonLine w="w-1/3" />
      </div>
      <div className="p-3 space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="grid grid-cols-4 gap-3">
            <SkeletonLine />
            <SkeletonLine />
            <SkeletonLine />
            <SkeletonLine w="w-1/2" />
          </div>
        ))}
      </div>
    </div>
  );
}

/* =========================================================
   ✅ Inbox for ORDERING role after swap
   Swap says:
   - SENT_TO_RP -> ORDERED is done by RESOURCE_PLANNER (RP)
   Therefore:
   - This page should be RP inbox (not PO).
   - It lists requests with status SENT_TO_RP
   - It calls POST /requests/:id/order

   Note: your GET /requests returns { data, meta } in your routes.
========================================================= */
export default function OrderingInboxPage() {
  const { user, authHeaders, loading: authLoading } = useContext(AuthContext);

  const role = useMemo(() => roleUpper(user?.role), [user?.role]);
  const isRP = role === "RESOURCE_PLANNER";
  const isAdmin = role === "SYSTEM_ADMIN";
  const canAccess = isRP || isAdmin;

  const headersReady = !!authHeaders?.["x-user-role"] && !authLoading;

  const [raw, setRaw] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  // UI controls
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("newest"); // newest | oldest | title
  const [onlyWithRecommended, setOnlyWithRecommended] = useState(true);

  const normalizeList = (resData) => {
    // supports both: array OR {data:[], meta:{}}
    if (Array.isArray(resData)) return resData;
    if (Array.isArray(resData?.data)) return resData.data;
    return [];
  };

  const load = useCallback(async () => {
    if (!headersReady) return;
    if (!user || !canAccess) return;

    const t = toast.loading("Loading inbox...");
    try {
      setErr("");
      setLoading(true);

      const res = await apiGet("/requests", {
        headers: authHeaders,
        params: { status: "SENT_TO_RP", _t: Date.now() },
      });

      setRaw(normalizeList(res?.data));
      toast.success("Inbox loaded", { id: t });
    } catch (e) {
      const msg =
        e?.response?.data?.error || e?.message || "Failed to load inbox";
      setRaw([]);
      setErr(msg);
      toast.error(msg, { id: t });
    } finally {
      setLoading(false);
    }
  }, [authHeaders, canAccess, headersReady, user]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    let rows = [...(raw || [])];

    if (onlyWithRecommended) {
      rows = rows.filter((r) => !!idStr(r?.recommendedOfferId));
    }

    const needle = q.trim().toLowerCase();
    if (needle) {
      const safe = escapeRegex(needle);
      const rx = new RegExp(safe, "i");
      rows = rows.filter((r) => {
        const hay = [
          r?.title,
          r?._id,
          r?.projectId,
          r?.projectName,
          r?.contractSupplier,
          r?.recommendedOfferId,
        ]
          .filter(Boolean)
          .join(" ");
        return rx.test(hay);
      });
    }

    const time = (v) => new Date(v || 0).getTime();
    rows.sort((a, b) => {
      if (sort === "oldest") return time(a?.sentToPoAt) - time(b?.sentToPoAt);
      if (sort === "title")
        return String(a?.title || "").localeCompare(String(b?.title || ""));
      return time(b?.sentToPoAt) - time(a?.sentToPoAt);
    });

    return rows;
  }, [onlyWithRecommended, q, raw, sort]);

  const orderNow = useCallback(
    async (r) => {
      const requestId = idStr(r?._id);
      const offerId = idStr(r?.recommendedOfferId);

      if (!requestId) return toast.error("Missing request id");
      if (!offerId) return toast.error("Missing recommendedOfferId");

      const t = toast.loading("Placing order...");
      try {
        await apiPost(
          `/requests/${encodeURIComponent(requestId)}/order`,
          { offerId },
          { headers: authHeaders },
        );
        toast.success("Ordered!", { id: t });
        // refresh list
        await load();
      } catch (e) {
        const msg =
          e?.response?.data?.error || e?.message || "Failed to place order";
        toast.error(msg, { id: t });
      }
    },
    [authHeaders, load],
  );

  if (!headersReady) {
    return <div className="p-4 text-xs text-slate-300">Loading…</div>;
  }

  if (!user) {
    return <div className="p-4 text-slate-300">Login first</div>;
  }

  if (!canAccess) {
    return (
      <div className="p-4 text-red-300">
        Only RESOURCE_PLANNER (Ordering role) or SYSTEM_ADMIN can access.
      </div>
    );
  }

  return (
    <main className="space-y-4">
      <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-3 sm:p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-sm font-semibold text-slate-100">
              Ordering Inbox
            </h1>
            <p className="text-xs text-slate-400">
              Requests waiting for ordering (status: SENT_TO_RP).
            </p>
          </div>

          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="px-3 py-2 rounded-xl border border-slate-700 text-xs text-slate-200 hover:bg-slate-800 disabled:opacity-60"
          >
            {loading ? "Loading..." : "Refresh"}
          </button>
        </div>

        {/* Controls */}
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search title, project, supplier, id..."
            className="w-full sm:w-[420px] rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 outline-none focus:border-emerald-400/60"
          />

          <div className="flex flex-wrap gap-2 items-center">
            <Chip
              active={onlyWithRecommended}
              onClick={() => setOnlyWithRecommended((v) => !v)}
            >
              {onlyWithRecommended ? "Only with recommended" : "Show all"}
            </Chip>

            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-400/60"
            >
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="title">Title A → Z</option>
            </select>
          </div>
        </div>

        {err && (
          <div className="mt-3 text-xs text-red-200 border border-red-900/40 bg-red-950/20 rounded-xl px-3 py-2">
            {err}
          </div>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <TableSkeleton />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/30">
          <table className="min-w-[1000px] w-full text-sm">
            <thead className="bg-slate-950/60 text-[11px] text-slate-400">
              <tr>
                <th className="px-3 py-2 text-left">Title</th>
                <th className="px-3 py-2 text-left">Recommended Offer</th>
                <th className="px-3 py-2 text-left">Sent At</th>
                <th className="px-3 py-2 text-right">Action</th>
              </tr>
            </thead>

            <tbody>
              {filtered.map((r) => {
                const rid = idStr(r?._id);
                const rec = idStr(r?.recommendedOfferId);

                return (
                  <tr
                    key={rid}
                    className="border-t border-slate-800 hover:bg-slate-950/30"
                  >
                    <td className="px-3 py-2 text-slate-100">
                      {r?.title || "Untitled"}
                      <div className="text-[11px] text-slate-500 break-all">
                        {rid}
                      </div>
                    </td>

                    <td className="px-3 py-2 text-slate-300">
                      {rec || "—"}
                      {!rec && (
                        <div className="text-[10px] text-amber-300 mt-0.5">
                          No recommended offer yet
                        </div>
                      )}
                    </td>

                    <td className="px-3 py-2 text-slate-300">
                      {fmtDate(r?.sentToPoAt)}
                    </td>

                    <td className="px-3 py-2">
                      <div className="flex justify-end gap-2">
                        <Link
                          href={`/requests/${encodeURIComponent(rid)}`}
                          className="text-xs px-2 py-1 rounded-lg border border-slate-700 hover:bg-slate-800"
                        >
                          View
                        </Link>

                        <button
                          type="button"
                          disabled={!rec}
                          className={`text-xs px-2 py-1 rounded-lg ${
                            rec
                              ? "bg-emerald-500 text-black hover:bg-emerald-400"
                              : "bg-slate-800 text-slate-500 cursor-not-allowed"
                          }`}
                          onClick={() => orderNow(r)}
                          title={
                            rec
                              ? "Place order using recommended offer"
                              : "No recommended offer"
                          }
                        >
                          Order
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-xs text-slate-400">
                    No requests waiting for ordering.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
