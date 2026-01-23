"use client";

import { useContext, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { AuthContext } from "../context/AuthContext";
import { apiGet } from "../lib/api";

function normalizeRole(raw) {
  return String(raw || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_");
}

const STATUSES = [
  { key: "DRAFT", label: "Draft" },
  { key: "IN_REVIEW", label: "In Review" },
  { key: "APPROVED_FOR_SUBMISSION", label: "Approved" },
  { key: "BIDDING", label: "Bidding" },
  { key: "BID_EVALUATION", label: "Bid Evaluation" },
  { key: "RECOMMENDED", label: "Recommended" },
  { key: "SENT_TO_PO", label: "Sent to PO" },
  { key: "ORDERED", label: "Ordered" },
  { key: "REJECTED", label: "Rejected" },
  { key: "EXPIRED", label: "Expired" },
];

function statusNumberClass(statusKey, value) {
  const n = Number(value || 0);
  if (n <= 0) return "text-slate-500";

  switch (statusKey) {
    case "DRAFT":
      return "text-slate-200";
    case "IN_REVIEW":
      return "text-sky-300";
    case "APPROVED_FOR_SUBMISSION":
      return "text-emerald-300";
    case "BIDDING":
      return "text-violet-300";
    case "BID_EVALUATION":
      return "text-amber-300";
    case "RECOMMENDED":
      return "text-emerald-300";
    case "SENT_TO_PO":
      return "text-indigo-300";
    case "ORDERED":
      return "text-green-300";
    case "REJECTED":
      return "text-rose-300";
    case "EXPIRED":
      return "text-slate-300";
    default:
      return "text-slate-200";
  }
}

export default function DashboardRequestsCard({ variant = "all" }) {
  const router = useRouter();

  // variant: "my" | "all"
  const { user, authHeaders, loading: authLoading } = useContext(AuthContext);

  const role = useMemo(() => normalizeRole(user?.role), [user?.role]);
  const isPM = role === "PROJECT_MANAGER";

  const allowed =
    variant === "my"
      ? isPM
      : role === "PROJECT_MANAGER" ||
        role === "PROCUREMENT_OFFICER" ||
        role === "RESOURCE_PLANNER" ||
        role === "SYSTEM_ADMIN";

  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState(() =>
    Object.fromEntries(STATUSES.map((s) => [s.key, 0])),
  );

  const title = variant === "my" ? "My Requests" : "All Requests";
  const href = variant === "my" ? "/requests?view=my" : "/requests";

  useEffect(() => {
    if (authLoading || !allowed) return;

    // must have role header
    if (!authHeaders?.["x-user-role"]) return;

    // "my" requires username header
    if (variant === "my" && !authHeaders?.["x-username"]) return;

    let alive = true;
    const toastId = toast.loading("Loading requests...");

    async function load() {
      try {
        const params = {};
        if (variant === "my") params.view = "my";

        const res = await apiGet("/requests", {
          params,
          headers: { ...authHeaders },
        });

        // ✅ FIX: backend returns { data, meta }
        const payload = res?.data;
        const list = Array.isArray(payload)
          ? payload
          : Array.isArray(payload?.data)
            ? payload.data
            : [];

        if (!alive) return;

        setTotal(list.length);

        const next = Object.fromEntries(STATUSES.map((s) => [s.key, 0]));
        for (const r of list) {
          const st = String(r?.status || "")
            .trim()
            .toUpperCase();
          if (next[st] != null) next[st] += 1;
        }
        setCounts(next);

        toast.success("Requests loaded", { id: toastId });
      } catch (e) {
        toast.error(e?.response?.data?.error || "Failed to load requests", {
          id: toastId,
        });
      }
    }

    load();

    return () => {
      alive = false;
      toast.dismiss(toastId);
    };
  }, [authLoading, allowed, authHeaders, variant]);

  if (!allowed) return null;

  return (
    <div
      className="relative z-10 overflow-visible group w-full max-w-sm cursor-pointer"
      onClick={() => router.push(href)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && router.push(href)}
    >
      {/* MAIN CARD */}
      <div className="rounded-xl border border-emerald-500/40 bg-slate-900/60 p-3 text-center transition hover:border-emerald-400">
        <div className="text-lg font-semibold text-slate-200">{title}</div>
        <div className="mt-1 text-lg font-bold text-slate-50">
          Total: {total}
        </div>
      </div>

      {/* HOVER PANEL */}
      <div className="pointer-events-none absolute left-0 right-0 top-full z-20 mt-3 opacity-0 translate-y-1 scale-95 transition-all duration-200 group-hover:opacity-100 group-hover:translate-y-0 group-hover:scale-100">
        <div className="rounded-2xl border border-slate-800 bg-slate-950/95 p-4 shadow-xl">
          <div className="space-y-2">
            {STATUSES.map((s) => {
              const val = counts[s.key] || 0;
              return (
                <div
                  key={s.key}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="text-slate-400">{s.label}</span>
                  <span
                    className={`font-semibold tabular-nums ${statusNumberClass(
                      s.key,
                      val,
                    )}`}
                    title={val > 0 ? "Has items" : "No items"}
                  >
                    {val}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
