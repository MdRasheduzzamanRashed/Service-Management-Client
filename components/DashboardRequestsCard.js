"use client";

import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { createPortal } from "react-dom";
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
  { key: "SENT_TO_RP", label: "Sent to PO" },
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
    case "SENT_TO_RP":
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

/* =========================
   Portal Hover Panel
========================= */
function HoverPanel({ open, anchorRect, title, total, counts }) {
  if (!open || !anchorRect) return null;

  const pad = 12;
  const panelW = 360;
  const panelH = 380; // approximate
  const vw = typeof window !== "undefined" ? window.innerWidth : 1200;
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;

  // prefer right side
  let left = anchorRect.right + pad;
  let top = anchorRect.top;

  // fallback: left side
  if (left + panelW > vw - pad) {
    left = anchorRect.left - panelW - pad;
  }

  // fallback: below
  if (left < pad) {
    left = Math.min(Math.max(pad, anchorRect.left), vw - panelW - pad);
    top = anchorRect.bottom + pad;
  }

  // clamp vertically
  if (top + panelH > vh - pad) {
    top = Math.max(pad, vh - panelH - pad);
  }

  const style = {
    position: "fixed",
    left,
    top,
    width: panelW,
    zIndex: 99999,
  };

  return createPortal(
    <div style={style}>
      <div className="rounded-2xl border border-slate-700 bg-slate-950/98 shadow-2xl backdrop-blur px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="text-xs text-slate-400">
            {title} · Status breakdown
          </div>
          <div className="text-xs text-slate-300">
            Total: <span className="text-slate-100 font-semibold">{total}</span>
          </div>
        </div>

        <div className="mt-3 max-h-64 overflow-auto pr-1 space-y-2">
          {STATUSES.map((s) => {
            const val = counts?.[s.key] || 0;
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
                >
                  {val}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>,
    document.body,
  );
}

export default function DashboardRequestsCard({ variant = "all" }) {
  const router = useRouter();

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

  // hover state
  const cardRef = useRef(null);
  const [hoverOpen, setHoverOpen] = useState(false);
  const [anchorRect, setAnchorRect] = useState(null);

  useEffect(() => {
    if (authLoading || !allowed) return;

    if (!authHeaders?.["x-user-role"]) return;
    if (variant === "my" && !authHeaders?.["x-username"]) return;

    let alive = true;
    const TOAST_ID = `requests-${variant}-loading`;

    toast.loading("Loading requests...", { id: TOAST_ID });

    async function load() {
      try {
        const params = {};
        if (variant === "my") params.view = "my";

        const res = await apiGet("/requests", {
          params,
          headers: { ...authHeaders },
        });

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

        toast.success("Requests loaded", { id: TOAST_ID });
      } catch (e) {
        toast.error(e?.response?.data?.error || "Failed to load requests", {
          id: TOAST_ID,
        });
      }
    }

    load();

    return () => {
      alive = false;
      toast.dismiss(TOAST_ID);
    };
  }, [authLoading, allowed, authHeaders, variant]);

  // update rect while open (scroll/resize)
  useEffect(() => {
    if (!hoverOpen) return;

    const update = () => {
      const el = cardRef.current;
      if (!el) return;
      setAnchorRect(el.getBoundingClientRect());
    };

    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);

    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [hoverOpen]);

  const openHover = () => {
    const el = cardRef.current;
    if (!el) return;
    setAnchorRect(el.getBoundingClientRect());
    setHoverOpen(true);
  };
  const closeHover = () => setHoverOpen(false);

  if (!allowed) return null;

  return (
    <div
      ref={cardRef}
      className="relative z-10 w-full max-w-sm cursor-pointer"
      onClick={() => router.push(href)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && router.push(href)}
      onMouseEnter={openHover}
      onMouseLeave={closeHover}
      onFocus={openHover}
      onBlur={closeHover}
    >
      {/* MAIN CARD */}
      <div className="rounded-xl border border-emerald-500/40 bg-slate-900/60 p-3 text-center transition hover:border-emerald-400">
        <div className="text-lg font-semibold text-slate-200">{title}</div>
        <div className="mt-1 text-lg font-bold text-slate-50">
          Total: {total}
        </div>
      </div>

      {/* PORTAL HOVER */}
      <HoverPanel
        open={hoverOpen}
        anchorRect={anchorRect}
        title={title}
        total={total}
        counts={counts}
      />
    </div>
  );
}
