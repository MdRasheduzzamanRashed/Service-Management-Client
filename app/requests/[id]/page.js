"use client";

import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { AuthContext } from "../../../context/AuthContext";
import { apiGet, apiPost } from "../../../lib/api";

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
function fmtDate(v) {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

function StatusBadge({ status }) {
  const s = String(status || "").toUpperCase();
  const cls =
    s === "DRAFT"
      ? "bg-slate-800 border-slate-700 text-slate-200"
      : s === "IN_REVIEW"
        ? "bg-blue-950/40 border-blue-800/40 text-blue-200"
        : s === "APPROVED_FOR_SUBMISSION"
          ? "bg-emerald-950/30 border-emerald-800/40 text-emerald-200"
          : s === "BIDDING"
            ? "bg-purple-950/40 border-purple-800/40 text-purple-200"
            : s === "BID_EVALUATION"
              ? "bg-amber-950/40 border-amber-800/40 text-amber-200"
              : s === "RECOMMENDED"
                ? "bg-emerald-950/40 border-emerald-800/40 text-emerald-200"
                : s === "SENT_TO_PO"
                  ? "bg-indigo-950/40 border-indigo-800/40 text-indigo-200"
                  : s === "ORDERED"
                    ? "bg-emerald-950/40 border-emerald-800/40 text-emerald-200"
                    : s === "REJECTED"
                      ? "bg-red-950/40 border-red-800/40 text-red-200"
                      : s === "EXPIRED"
                        ? "bg-slate-950/40 border-slate-700 text-slate-300"
                        : "bg-slate-900 border-slate-700 text-slate-200";

  return (
    <span
      className={`inline-flex px-2 py-0.5 rounded-full text-[11px] border ${cls}`}
    >
      {s || "—"}
    </span>
  );
}


function Timeline({ steps }) {
  return (
    <div className="space-y-2">
      {steps.map((s, idx) => (
        <div key={idx} className="flex items-start gap-3">
          <div className="mt-1 h-2.5 w-2.5 rounded-full bg-slate-600" />
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm text-slate-100 font-medium">
                {s.title}
              </span>
              {s.badge && <StatusBadge status={s.badge} />}
              <span className="text-[11px] text-slate-400">
                {s.time || "—"}
              </span>
            </div>
            {s.note && (
              <div className="text-[12px] text-slate-300 mt-0.5">{s.note}</div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function RequestDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { user, authHeaders, loading: authLoading } = useContext(AuthContext);

  const role = useMemo(() => normalizeRole(user?.role), [user?.role]);
  const username = useMemo(
    () => normalizeUsername(user?.username),
    [user?.username],
  );

  const isPM = role === "PROJECT_MANAGER";
  const isRP = role === "RESOURCE_PLANNER";

  const [req, setReq] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const [actionLoading, setActionLoading] = useState(false);
  const [actionMsg, setActionMsg] = useState("");
  const lockRef = useRef(false);

  const headersReady = !!authHeaders?.["x-user-role"] && !authLoading;

  const load = useCallback(async () => {
    if (!id || !headersReady) return;
    try {
      setLoading(true);
      setErr("");
      const res = await apiGet(`/requests/${id}`, { headers: authHeaders });
      setReq(res?.data || null);
    } catch (e) {
      setReq(null);
      setErr(
        e?.response?.data?.error || e?.message || "Failed to load request",
      );
    } finally {
      setLoading(false);
    }
  }, [id, headersReady, authHeaders]);

  useEffect(() => {
    load();
  }, [load]);

  const status = useMemo(
    () => String(req?.status || "").toUpperCase(),
    [req?.status],
  );
  const isExpired = status === "EXPIRED";

  const isOwner = useMemo(() => {
    if (!isPM) return false;
    return normalizeUsername(req?.createdBy) === username;
  }, [isPM, req?.createdBy, username]);

  // ✅ action availability (your workflow)
  const canEdit = isOwner && status === "DRAFT";
  const canSubmitForReview = isOwner && status === "DRAFT";
  const canSubmitForBidding = isOwner && status === "APPROVED_FOR_SUBMISSION";
  const canRpApprove = isRP && status === "IN_REVIEW";
  const canRpReject = isRP && status === "IN_REVIEW";

  // ✅ EXPIRED: disable everything automatically (except reactivate for owner PM)
  const actionsDisabled = actionLoading || isExpired;
  const canReactivate = isOwner && isExpired;

  const runAction = useCallback(
    async ({ url, body, okMsg }) => {
      if (!id || !headersReady) return;
      if (lockRef.current) return;

      lockRef.current = true;
      setActionMsg("");
      setActionLoading(true);

      try {
        await apiPost(url, body || {}, { headers: authHeaders });
        await load();
        setActionMsg(okMsg || "Done.");
      } catch (e) {
        setActionMsg(e?.response?.data?.error || e?.message || "Action failed");
      } finally {
        setActionLoading(false);
        lockRef.current = false;
      }
    },
    [id, headersReady, authHeaders, load],
  );

const timelineSteps = useMemo(() => {
  if (!req) return [];
  const steps = [];
  const st = String(req.status || "").toUpperCase();

  steps.push({
    title: "Created",
    badge: "DRAFT",
    time: fmtDate(req.createdAt),
    note: req.createdBy ? `Created by ${req.createdBy}` : "",
  });

  if (req.submittedAt) {
    steps.push({
      title: "Submitted for review",
      badge: "IN_REVIEW",
      time: fmtDate(req.submittedAt),
      note: req.submittedBy ? `Submitted by ${req.submittedBy}` : "",
    });
  }

  if (req.rpApprovedAt) {
    steps.push({
      title: "Approved by Resource Planner",
      badge: "APPROVED_FOR_SUBMISSION",
      time: fmtDate(req.rpApprovedAt),
      note: req.rpApprovedBy ? `Approved by ${req.rpApprovedBy}` : "",
    });
  }

  if (req.rpRejectedAt) {
    steps.push({
      title: "Rejected by Resource Planner",
      badge: "REJECTED",
      time: fmtDate(req.rpRejectedAt),
      note: req.rpRejectReason ? `Reason: ${req.rpRejectReason}` : "",
    });
  }

  if (req.biddingStartedAt) {
    steps.push({
      title: "Bidding started",
      badge: "BIDDING",
      time: fmtDate(req.biddingStartedAt),
      note: req.biddingStartedBy ? `Started by ${req.biddingStartedBy}` : "",
    });
  }

  // ✅ BID_EVALUATION
  if (req.bidEvaluationAt) {
    steps.push({
      title: "Bidding completed",
      badge: "BID_EVALUATION",
      time: fmtDate(req.bidEvaluationAt),
      note:
        req.offersCount != null && req.maxOffers != null
          ? `Offers collected: ${req.offersCount}/${req.maxOffers}`
          : "Moved to evaluation stage.",
    });
  } else if (st === "BID_EVALUATION") {
    steps.push({
      title: "Bidding completed",
      badge: "BID_EVALUATION",
      time: "—",
      note: "Moved to evaluation stage.",
    });
  }

  // ✅ RECOMMENDED
  if (req.recommendedAt) {
    steps.push({
      title: "Offer recommended by Resource Planner",
      badge: "RECOMMENDED",
      time: fmtDate(req.recommendedAt),
      note: [
        req.recommendedBy ? `Recommended by ${req.recommendedBy}` : "",
        req.recommendedOfferId ? `Offer ID: ${req.recommendedOfferId}` : "",
      ]
        .filter(Boolean)
        .join(" · "),
    });
  } else if (st === "RECOMMENDED") {
    steps.push({
      title: "Offer recommended by Resource Planner",
      badge: "RECOMMENDED",
      time: "—",
      note: req.recommendedOfferId ? `Offer ID: ${req.recommendedOfferId}` : "",
    });
  }

  // ✅ SENT_TO_PO
  if (req.sentToPoAt) {
    steps.push({
      title: "Sent to Procurement Officer",
      badge: "SENT_TO_PO",
      time: fmtDate(req.sentToPoAt),
      note: req.sentToPoBy ? `Sent by ${req.sentToPoBy}` : "",
    });
  } else if (st === "SENT_TO_PO") {
    steps.push({
      title: "Sent to Procurement Officer",
      badge: "SENT_TO_PO",
      time: "—",
      note: "",
    });
  }

  // ✅ ORDERED
  if (req.orderedAt) {
    steps.push({
      title: "Order placed",
      badge: "ORDERED",
      time: fmtDate(req.orderedAt),
      note: [
        req.orderedBy ? `Ordered by ${req.orderedBy}` : "",
        req.orderId ? `Order ID: ${req.orderId}` : "",
      ]
        .filter(Boolean)
        .join(" · "),
    });
  } else if (st === "ORDERED") {
    steps.push({
      title: "Order placed",
      badge: "ORDERED",
      time: "—",
      note: req.orderId ? `Order ID: ${req.orderId}` : "",
    });
  }

  // ✅ EXPIRED + REACTIVATED stays same
  if (req.expiredAt) {
    steps.push({
      title: "Expired",
      badge: "EXPIRED",
      time: fmtDate(req.expiredAt),
      note: "Bidding cycle completed.",
    });
  } else if (!req.expiredAt && st === "EXPIRED") {
    steps.push({
      title: "Expired",
      badge: "EXPIRED",
      time: "—",
      note: "Bidding cycle completed.",
    });
  }

  if (req.reactivatedAt) {
    steps.push({
      title: "Reactivated",
      badge: "DRAFT",
      time: fmtDate(req.reactivatedAt),
      note: req.reactivatedBy ? `Reactivated by ${req.reactivatedBy}` : "",
    });
  }

  return steps;
}, [req]);


  if (!headersReady) {
    return <div className="p-4 text-xs text-amber-300">Loading session…</div>;
  }
  if (loading) {
    return <div className="p-4 text-xs text-slate-300">Loading request…</div>;
  }
  if (!req) {
    return (
      <div className="p-4 space-y-3">
        <p className="text-xs text-red-400">{err || "Request not found"}</p>
        <button
          onClick={() => router.back()}
          className="text-xs px-3 py-1.5 border border-slate-700 rounded-lg"
          type="button"
        >
          Go back
        </button>
      </div>
    );
  }

  return (
    <main className="space-y-6">
      {/* HEADER */}
      <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4 space-y-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <h1 className="text-lg font-semibold text-slate-100 truncate">
              {req.title || "Untitled"}
            </h1>
            <div className="mt-1 flex items-center gap-2 text-xs flex-wrap">
              <StatusBadge status={req.status} />
              <span className="text-slate-400">
                Created {fmtDate(req.createdAt)}{" "}
                {req.createdBy ? `by ${req.createdBy}` : ""}
              </span>
            </div>

            {isExpired && (
              <div className="mt-2 text-[12px] text-amber-200">
                This request is <b>EXPIRED</b>. Actions are disabled.
                {canReactivate ? " You can reactivate it." : ""}
              </div>
            )}
          </div>

          <div className="flex gap-2">
            {canEdit && (
              <Link
                href={`/requests/${id}/edit`}
                className="px-3 py-1.5 rounded-lg bg-emerald-500 text-black text-xs hover:bg-emerald-400"
              >
                Edit
              </Link>
            )}

            <button
              onClick={() => router.back()}
              className="px-3 py-1.5 rounded-lg border border-slate-700 text-xs"
              type="button"
            >
              Back
            </button>
          </div>
        </div>

        {/* WORKFLOW ACTIONS */}
        <div className="flex flex-wrap gap-2">
          {canSubmitForReview && (
            <button
              type="button"
              disabled={actionsDisabled}
              onClick={() =>
                runAction({
                  url: `/requests/${id}/submit-for-review`,
                  okMsg: "Submitted for review.",
                })
              }
              className="px-3 py-1.5 text-xs rounded-full bg-blue-500 text-black hover:bg-blue-400 disabled:opacity-60"
            >
              PM: Submit for Review
            </button>
          )}

          {canRpApprove && (
            <button
              type="button"
              disabled={actionsDisabled}
              onClick={() =>
                runAction({
                  url: `/requests/${id}/rp-approve`,
                  okMsg: "Approved for submission.",
                })
              }
              className="px-3 py-1.5 text-xs rounded-full bg-emerald-500 text-black hover:bg-emerald-400 disabled:opacity-60"
            >
              RP: Approve
            </button>
          )}

          {canRpReject && (
            <button
              type="button"
              disabled={actionsDisabled}
              onClick={() => {
                const reason = prompt("Reject reason?", "Not suitable") || "";
                runAction({
                  url: `/requests/${id}/rp-reject`,
                  body: { reason },
                  okMsg: "Rejected.",
                });
              }}
              className="px-3 py-1.5 text-xs rounded-full bg-red-500 text-black hover:bg-red-400 disabled:opacity-60"
            >
              RP: Reject
            </button>
          )}

          {canSubmitForBidding && (
            <button
              type="button"
              disabled={actionsDisabled}
              onClick={() =>
                runAction({
                  url: `/requests/${id}/submit-for-bidding`,
                  okMsg: "Moved to BIDDING.",
                })
              }
              className="px-3 py-1.5 text-xs rounded-full bg-purple-500 text-black hover:bg-purple-400 disabled:opacity-60"
            >
              PM: Submit for Bidding
            </button>
          )}

          {canReactivate && (
            <button
              type="button"
              disabled={actionLoading}
              onClick={() =>
                runAction({
                  url: `/requests/${id}/reactivate`,
                  okMsg: "Reactivated to DRAFT.",
                })
              }
              className="px-3 py-1.5 text-xs rounded-full bg-amber-400 text-black hover:bg-amber-300 disabled:opacity-60"
            >
              PM: Reactivate
            </button>
          )}
        </div>

        {actionMsg && (
          <div className="text-[12px] text-emerald-200">{actionMsg}</div>
        )}
      </section>

      {/* TIMELINE */}
      <Section title="Status Timeline">
        <Timeline steps={timelineSteps} />
      </Section>

      {/* BASIC INFO */}
      <Section title="General Information">
        <Info label="Type" value={req.type} />
        <Info label="Project" value={req.projectName || req.projectId} />
        <Info label="Supplier" value={req.contractSupplier} />
        <Info label="Performance Location" value={req.performanceLocation} />
        <Info label="Start Date" value={req.startDate} />
        <Info label="End Date" value={req.endDate} />
        <Info label="Bidding Cycle (days)" value={req.biddingCycleDays} />
        <Info label="Max Offers" value={req.maxOffers} />
        <Info label="Max Accepted Offers" value={req.maxAcceptedOffers} />
      </Section>

      {/* ROLES */}
      <Section title="Requested Roles">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border border-slate-800 rounded-xl">
            <thead className="bg-slate-950/60 text-[11px] text-slate-400">
              <tr>
                <th className="px-3 py-2">Role</th>
                <th className="px-3 py-2">Domain</th>
                <th className="px-3 py-2">Technology</th>
                <th className="px-3 py-2">Experience</th>
                <th className="px-3 py-2">Man Days</th>
                <th className="px-3 py-2">Onsite Days</th>
              </tr>
            </thead>
            <tbody>
              {(req.roles || []).map((r, i) => (
                <tr key={i} className="border-t border-slate-800">
                  <td className="px-3 py-2">{r.roleName || "—"}</td>
                  <td className="px-3 py-2">{r.domain || "—"}</td>
                  <td className="px-3 py-2">{r.technology || "—"}</td>
                  <td className="px-3 py-2">{r.experienceLevel || "—"}</td>
                  <td className="px-3 py-2">{r.manDays ?? "—"}</td>
                  <td className="px-3 py-2">{r.onsiteDays ?? "—"}</td>
                </tr>
              ))}
              {(!req.roles || req.roles.length === 0) && (
                <tr>
                  <td className="px-3 py-3 text-xs text-slate-400" colSpan={6}>
                    No roles found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Section>

      {/* REQUIREMENTS */}
      <Section title="Requirements">
        <Info
          label="Required Languages"
          value={(req.requiredLanguages || []).join(", ")}
        />
        <Info
          label="Must Have"
          value={(req.mustHaveCriteria || []).join(", ")}
        />
        <Info
          label="Nice To Have"
          value={(req.niceToHaveCriteria || []).join(", ")}
        />
      </Section>

      {/* DESCRIPTION */}
      <Section title="Task Description">
        <p className="text-sm text-slate-300 whitespace-pre-line">
          {req.taskDescription || "—"}
        </p>
      </Section>

      <Section title="Further Information">
        <p className="text-sm text-slate-300 whitespace-pre-line">
          {req.furtherInformation || "—"}
        </p>
      </Section>
    </main>
  );
}

/* ---------------- helpers ---------------- */

function Section({ title, children }) {
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4 space-y-3">
      <h2 className="text-sm font-semibold text-slate-100">{title}</h2>
      <div className="grid gap-2">{children}</div>
    </section>
  );
}

function Info({ label, value }) {
  return (
    <div className="grid grid-cols-3 gap-3 text-sm">
      <span className="text-slate-400">{label}</span>
      <span className="col-span-2 text-slate-200">{value || "—"}</span>
    </div>
  );
}
