"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { createPortal } from "react-dom";

const PROJECTS_API = process.env.NEXT_PUBLIC_PROJECTS_API;

function numClass(kind, n) {
  const v = Number(n || 0);
  if (v <= 0) return "text-slate-500";
  if (kind === "published") return "text-emerald-300";
  if (kind === "draft") return "text-amber-300";
  return "text-slate-50";
}

function extractList(data) {
  return (
    (Array.isArray(data) && data) ||
    (Array.isArray(data?.data) && data.data) ||
    (Array.isArray(data?.projects) && data.projects) ||
    (Array.isArray(data?.items) && data.items) ||
    []
  );
}

function normalizeProject(raw) {
  const p = raw || {};
  const id = String(p.id || p._id || p.projectId || "").trim();
  const status =
    String(p.status || "")
      .trim()
      .toUpperCase() || "UNKNOWN";

  const isPublished =
    typeof p.isPublished === "boolean"
      ? p.isPublished
      : status === "PLANNED" || status === "ACTIVE";

  return {
    id,
    projectId: String(p.projectId || p.id || "").trim(),
    projectDescription: p.projectDescription || p.title || p.name || "",
    status,
    isPublished,
  };
}

function buildStatusCounts(projects) {
  const map = new Map();
  for (const p of projects || []) {
    const s =
      String(p?.status || "UNKNOWN")
        .trim()
        .toUpperCase() || "UNKNOWN";
    map.set(s, (map.get(s) || 0) + 1);
  }
  return Array.from(map.entries())
    .map(([status, count]) => ({ status, count }))
    .sort((a, b) => b.count - a.count);
}

function statusColor(status) {
  const s = String(status || "").toUpperCase();
  if (s === "PLANNED" || s === "ACTIVE") return "text-emerald-300";
  if (s === "OPEN") return "text-cyan-300";
  if (s === "STAFFING") return "text-purple-300";
  if (s === "DRAFT") return "text-amber-300";
  if (s === "EXPIRED") return "text-red-300";
  return "text-slate-200";
}

/* =========================
   Portal Hover Panel
========================= */
function HoverPanel({ open, anchorRect, stats }) {
  if (!open || !anchorRect) return null;

  // viewport + preferred placement (right side, fallback below)
  const pad = 12;
  const panelW = 340;
  const panelH = 320; // approximate; ok because we also clamp
  const vw = typeof window !== "undefined" ? window.innerWidth : 1200;
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;

  // Prefer right
  let left = anchorRect.right + pad;
  let top = anchorRect.top;

  // If not enough space to right, place left of card
  if (left + panelW > vw - pad) {
    left = anchorRect.left - panelW - pad;
  }

  // If still not possible, place below
  if (left < pad) {
    left = Math.min(Math.max(pad, anchorRect.left), vw - panelW - pad);
    top = anchorRect.bottom + pad;
  }

  // Clamp vertically
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
          <span className="text-xs text-slate-400">Status breakdown</span>
          <span className="text-xs text-slate-300">
            Total:{" "}
            <span className="text-slate-100 font-semibold">{stats.total}</span>
          </span>
        </div>

        <div className="mt-3 max-h-48 overflow-auto pr-1 space-y-1.5">
          {stats.statusRows.length === 0 ? (
            <div className="text-[11px] text-slate-400 py-2">
              No status data.
            </div>
          ) : (
            stats.statusRows.map((x) => (
              <div key={x.status} className="flex items-center justify-between">
                <span
                  className={`text-xs font-medium ${statusColor(x.status)}`}
                >
                  {x.status}
                </span>
                <span className="text-xs font-semibold text-slate-100">
                  {x.count}
                </span>
              </div>
            ))
          )}
        </div>

        <div className="mt-3 border-t border-slate-800 pt-3 grid grid-cols-2 gap-2">
          <div className="rounded-xl border border-slate-800 bg-slate-900/40 px-3 py-2">
            <div className="text-[10px] text-slate-500">Published</div>
            <div
              className={`mt-0.5 text-sm font-semibold ${numClass(
                "published",
                stats.published,
              )}`}
            >
              {stats.published}
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/40 px-3 py-2">
            <div className="text-[10px] text-slate-500">Draft</div>
            <div
              className={`mt-0.5 text-sm font-semibold ${numClass("draft", stats.draft)}`}
            >
              {stats.draft}
            </div>
          </div>
        </div>

        
      </div>
    </div>,
    document.body,
  );
}

export default function DashboardProjectsCard() {
  const router = useRouter();

  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // hover panel state
  const cardRef = useRef(null);
  const [hoverOpen, setHoverOpen] = useState(false);
  const [anchorRect, setAnchorRect] = useState(null);

  useEffect(() => {
    let alive = true;
    const TOAST_ID = "projects-loading";

    async function load() {
      setLoading(true);
      setErr("");
      toast.loading("Loading projects...", { id: TOAST_ID });

      try {
        if (!PROJECTS_API) throw new Error("Missing NEXT_PUBLIC_PROJECTS_API");

        const res = await axios.get(PROJECTS_API, {
          headers: { Accept: "application/json" },
          params: { _t: Date.now() },
          timeout: 15000,
        });

        const list = extractList(res?.data)
          .map(normalizeProject)
          .filter((p) => p.id || p.projectId);

        if (!alive) return;
        setProjects(list);
        toast.success("Projects loaded", { id: TOAST_ID });
      } catch (e) {
        if (!alive) return;
        const msg =
          e?.response?.data?.error ||
          e?.response?.data?.message ||
          e?.message ||
          "Failed to load projects";
        setErr(msg);
        toast.error(msg, { id: TOAST_ID });
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    }

    load();
    return () => {
      alive = false;
      toast.dismiss(TOAST_ID);
    };
  }, []);

  const stats = useMemo(() => {
    const total = projects.length;
    const published = projects.filter((p) => p.isPublished === true).length;
    const draft = total - published;
    const statusRows = buildStatusCounts(projects);
    return { total, published, draft, statusRows };
  }, [projects]);

  // keep panel positioned correctly on scroll/resize
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

  const onEnter = () => {
    const el = cardRef.current;
    if (!el) return;
    setAnchorRect(el.getBoundingClientRect());
    setHoverOpen(true);
  };

  const onLeave = () => {
    setHoverOpen(false);
  };

  return (
    <div
      ref={cardRef}
      className="relative z-10 w-full max-w-sm cursor-pointer"
      onClick={() => router.push("/projects")}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && router.push("/projects")}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      onFocus={onEnter}
      onBlur={onLeave}
    >
      <div className="rounded-xl border border-emerald-500/40 bg-slate-900/60 p-3 text-center transition hover:border-emerald-400">
        <h3 className="text-lg text-slate-200 font-medium">Projects</h3>

        {loading ? (
          <h2 className="mt-1 text-xs font-semibold text-slate-200">
            Loading...
          </h2>
        ) : err ? (
          <div className="mt-2 text-xs text-red-300">{err}</div>
        ) : (
          <h2
            className={`mt-1 text-lg font-semibold ${numClass("total", stats.total)}`}
          >
            Total: {stats.total}
          </h2>
        )}

        
      </div>

      {/* Portal hover panel (clear + no overlap) */}
      {!loading && !err && (
        <HoverPanel open={hoverOpen} anchorRect={anchorRect} stats={stats} />
      )}
    </div>
  );
}
