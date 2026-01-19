"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  useEffect,
  useState,
  useContext,
  useRef,
  useCallback,
  useMemo,
} from "react";
import OffersList from "../../../components/OffersList";
import { AuthContext } from "../../../context/AuthContext";
import { apiDelete, apiGet, apiPost } from "../../../lib/api";

// external system
const EXTERNAL_INTERNAL_PROJECTS_BASE = "https://internal-projects.example.com";

// ✅ normalize Mongo ObjectId values (string or { $oid })
function oidToString(v) {
  if (!v) return "";
  if (typeof v === "string") return v;
  if (typeof v === "object" && v.$oid) return String(v.$oid);
  return String(v);
}

export default function RequestDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id;

  const { user, authHeaders, loading: authLoading } = useContext(AuthContext);

  const [req, setReq] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [actionLoading, setActionLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState("");

  const actionLockRef = useRef(false);
  const [offersReloadKey, setOffersReloadKey] = useState(0);

  // ✅ do not call APIs until headers exist
  const headersReady = useMemo(() => {
    return (
      !!authHeaders?.["x-user-id"] &&
      !!authHeaders?.["x-user-role"] &&
      !authLoading
    );
  }, [authHeaders, authLoading]);

  const load = useCallback(async () => {
    if (!id) return;
    if (!headersReady) return;

    setError("");
    setLoading(true);

    try {
      const res = await apiGet(`/requests/${id}`, {
        headers: authHeaders,
      });
      const data = res.data || null;
      setReq(data);
      if (!data) setError("Request not found");
    } catch (err) {
      setReq(null);
      setError(err?.response?.data?.error || "Error loading request");
    } finally {
      setLoading(false);
    }
  }, [id, headersReady, authHeaders]);

  useEffect(() => {
    load();
  }, [load]);

  const isOwnerPM = useMemo(() => {
    const myId = oidToString(user?._id);
    const createdBy = oidToString(req?.createdBy);

    return (
      user?.role === "ProjectManager" &&
      !!myId &&
      !!createdBy &&
      myId === createdBy
    );
  }, [user, req]);

  const canEdit = isOwnerPM && req?.status === "Draft";
  const canDelete = isOwnerPM && req?.status === "Draft";
  const canSubmit = isOwnerPM;

  const canProcurement = user?.role === "ProcurementOfficer";
  const canSystem = user?.role === "System";

  const externalViewUrl = useMemo(() => {
    if (!req) return "";
    if (req.externalViewUrl) return req.externalViewUrl;

    if (req.externalId) {
      return `${EXTERNAL_INTERNAL_PROJECTS_BASE}/projects/${req.externalId}`;
    }

    return `${EXTERNAL_INTERNAL_PROJECTS_BASE}/search?query=${encodeURIComponent(
      req.title || ""
    )}`;
  }, [req]);

  const runAction = useCallback(
    async ({ url, body = {}, successMessage }) => {
      if (!id) return;
      if (!headersReady) return;

      if (actionLockRef.current) return;
      actionLockRef.current = true;

      setActionMessage("");
      setActionLoading(true);

      try {
        await apiPost(url, body, { headers: authHeaders });
        await load();
        setOffersReloadKey((k) => k + 1);
        setActionMessage(successMessage || "Action completed.");
      } catch (err) {
        setActionMessage(err?.response?.data?.error || "Action failed");
      } finally {
        setActionLoading(false);
        actionLockRef.current = false;
      }
    },
    [id, headersReady, authHeaders, load]
  );

  const handleDelete = useCallback(async () => {
    if (!id || !canDelete) return;
    if (!headersReady) return;

    if (!confirm("Delete this request? This cannot be undone.")) return;

    if (actionLockRef.current) return;
    actionLockRef.current = true;

    setActionLoading(true);
    setActionMessage("");

    try {
      await apiDelete(`/requests/${id}`, {
        headers: authHeaders,
      });

      setActionMessage("Deleted successfully.");

      // ✅ FIX: go back to your list page
      router.push("/requests");
    } catch (err) {
      setActionMessage(err?.response?.data?.error || "Delete failed");
    } finally {
      setActionLoading(false);
      actionLockRef.current = false;
    }
  }, [id, canDelete, headersReady, authHeaders, router]);

  if (!id) {
    return (
      <main className="p-4">
        <p className="text-xs text-red-400">Missing request id.</p>
      </main>
    );
  }

  if (!headersReady) {
    return (
      <main className="p-4">
        <p className="text-xs text-amber-300">
          Missing auth headers. Please login again.
        </p>
      </main>
    );
  }

  if (!req) {
    return (
      <main>
        {error ? (
          <p className="text-xs text-red-400 p-4">{error}</p>
        ) : (
          <p className="text-xs text-slate-300 p-4">Loading request...</p>
        )}

        <div className="p-4">
          <button
            type="button"
            onClick={load}
            className="px-3 py-1.5 text-xs rounded-lg border border-slate-700 text-slate-200 hover:bg-slate-800"
          >
            Retry
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="space-y-5">
      {/* HEADER */}
      <section className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4 space-y-2">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-lg font-semibold">{req.title}</h2>

            <p className="text-xs text-slate-400">
              Status:{" "}
              <span className="px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700">
                {req.status}
              </span>
            </p>

            {req.submissionWindowOpen && (
              <p className="text-[11px] text-emerald-300 mt-1">
                Supplier submission window is currently OPEN.
              </p>
            )}

            {!isOwnerPM && user?.role === "ProjectManager" && (
              <p className="text-[11px] text-amber-300 mt-1">
                This is not your request. You can only open it in the external
                Internal Projects system.
              </p>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={load}
              disabled={loading}
              className="px-3 py-1.5 text-xs rounded-lg border border-slate-700 text-slate-200 hover:bg-slate-800 disabled:opacity-60"
            >
              {loading ? "Refreshing..." : "Refresh"}
            </button>

            {isOwnerPM ? (
              <>
                <Link
                  href={`/requests/${id}`}
                  className="px-3 py-1.5 text-xs rounded-lg border border-slate-700 text-slate-200 hover:bg-slate-800"
                >
                  View
                </Link>

                {canEdit && (
                  <Link
                    href={`/requests/${id}/edit`}
                    className="px-3 py-1.5 text-xs rounded-lg bg-emerald-500 text-black hover:bg-emerald-400"
                  >
                    Edit
                  </Link>
                )}

                {canDelete && (
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={actionLoading}
                    className="px-3 py-1.5 text-xs rounded-lg bg-red-500 text-black hover:bg-red-400 disabled:opacity-60"
                  >
                    Delete
                  </button>
                )}
              </>
            ) : (
              <a
                href={externalViewUrl}
                target="_blank"
                rel="noreferrer"
                className="px-3 py-1.5 text-xs rounded-lg bg-indigo-500 text-black hover:bg-indigo-400"
              >
                Open in Internal Projects
              </a>
            )}
          </div>
        </div>

        {error && <p className="text-xs text-red-400">{error}</p>}
      </section>

      {/* WORKFLOW ACTIONS */}
      <section className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4 space-y-2">
        <h3 className="text-sm font-semibold">Workflow Actions</h3>

        <div className="flex flex-wrap gap-2">
          {canSubmit && (
            <button
              type="button"
              disabled={actionLoading}
              onClick={() =>
                runAction({
                  url: `/requests/${id}/submit`,
                  body: {},
                  successMessage: "Submitted to Procurement for review.",
                })
              }
              className="px-3 py-1.5 text-xs rounded-full bg-blue-500 text-black hover:bg-blue-400 disabled:opacity-60"
            >
              {actionLoading ? "Working..." : "PM: Submit to Procurement"}
            </button>
          )}

          {canProcurement && (
            <button
              type="button"
              disabled={actionLoading}
              onClick={() =>
                runAction({
                  url: `/requests/${id}/procurement-review`,
                  body: { approve: true, comments: "OK" },
                  successMessage:
                    "Procurement approved and submission window opened.",
                })
              }
              className="px-3 py-1.5 text-xs rounded-full bg-emerald-500 text-black hover:bg-emerald-400 disabled:opacity-60"
            >
              {actionLoading
                ? "Working..."
                : "Procurement: Approve & Open Window"}
            </button>
          )}

          {canSystem && (
            <button
              type="button"
              disabled={actionLoading}
              onClick={() =>
                runAction({
                  url: `/requests/${id}/close-window`,
                  body: {},
                  successMessage:
                    "Submission window closed. Ready for evaluation.",
                })
              }
              className="px-3 py-1.5 text-xs rounded-full bg-amber-400 text-black hover:bg-amber-300 disabled:opacity-60"
            >
              {actionLoading ? "Working..." : "System: Close Submission Window"}
            </button>
          )}
        </div>

        {actionMessage && (
          <p className="text-[11px] text-emerald-300 mt-2">{actionMessage}</p>
        )}
      </section>

      {/* OFFERS */}
      <section className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4">
        <OffersList key={offersReloadKey} requestId={id} />
      </section>
    </main>
  );
}
