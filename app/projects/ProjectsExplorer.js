"use client";

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";

function toDateText(v) {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleDateString("en-GB", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

function asArray(v) {
  if (!v) return [];
  if (Array.isArray(v)) return v;
  return [v];
}

// XML -> object converter output varies. This makes sure we handle:
// selectedSkills: { selectedSkills: ["Ethereum","Web3.js"] } OR ["Ethereum"] OR "Ethereum"
function pickList(obj, key) {
  const val = obj?.[key];
  if (!val) return [];
  if (Array.isArray(val)) return val;
  if (typeof val === "object") {
    const inner = val?.[key];
    return asArray(inner).filter(Boolean);
  }
  return [val].filter(Boolean);
}

function joinList(items, max = 3) {
  const list = asArray(items).filter(Boolean).map(String);
  if (list.length === 0) return "—";
  const shown = list.slice(0, max);
  const rest = list.length - shown.length;
  return rest > 0 ? `${shown.join(", ")} +${rest}` : shown.join(", ");
}

function StatusBadge({ status, isPublished }) {
  const s = String(status || "")
    .trim()
    .toLowerCase();

  const base =
    "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold border";

  if (s === "active")
    return (
      <span
        className={`${base} border-emerald-400/40 text-emerald-300 bg-emerald-500/10`}
      >
        Active
      </span>
    );

  if (s === "expired")
    return (
      <span className={`${base} border-red-400/40 text-red-300 bg-red-500/10`}>
        Expired
      </span>
    );

  // If status empty, use publish state
  if (s === "" || s === "—") {
    return isPublished ? (
      <span
        className={`${base} border-emerald-400/40 text-emerald-300 bg-emerald-500/10`}
      >
        Published
      </span>
    ) : (
      <span
        className={`${base} border-yellow-400/40 text-yellow-300 bg-yellow-500/10`}
      >
        Draft
      </span>
    );
  }

  return (
    <span
      className={`${base} border-slate-500/40 text-slate-300 bg-slate-500/10`}
    >
      {status || "Unknown"}
    </span>
  );
}

function Field({ label, children }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-3">
      <div className="text-[11px] uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className="mt-1 text-sm text-slate-100 break-words">{children}</div>
    </div>
  );
}

// ✅ Show ONLY role names (requiredRole) — not full role objects
function RolesChips({ roles }) {
  // roles can be: { roles: { requiredRole: ... } } OR { roles: [ ... ] } OR array
  const root = roles?.roles ?? roles;
  const items = Array.isArray(root) ? root : root ? [root] : [];

  const names = items
    .map((r) => r?.requiredRole || r?.role || r?.name)
    .filter(Boolean)
    .map(String);

  if (names.length === 0) return <span className="text-slate-400">—</span>;

  return (
    <div className="flex flex-wrap gap-2">
      {names.map((n, i) => (
        <span
          key={`${n}-${i}`}
          className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-200"
        >
          {n}
        </span>
      ))}
    </div>
  );
}

/* =========================
   UI: Skeletons (UI only)
========================= */
function SkeletonLine({ w = "w-full" }) {
  return <div className={`h-3 ${w} rounded bg-slate-800/70 animate-pulse`} />;
}

function ProjectCardSkeleton() {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-2">
          <SkeletonLine w="w-1/3" />
          <SkeletonLine w="w-3/4" />
        </div>
        <div className="h-5 w-20 rounded-full bg-slate-800/70 animate-pulse" />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3 space-y-2">
          <SkeletonLine w="w-1/2" />
          <SkeletonLine w="w-2/3" />
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3 space-y-2">
          <SkeletonLine w="w-1/2" />
          <SkeletonLine w="w-2/3" />
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3 col-span-2 space-y-2">
          <SkeletonLine w="w-1/3" />
          <SkeletonLine w="w-5/6" />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 justify-end">
        <div className="h-9 w-24 rounded-xl bg-slate-800/70 animate-pulse" />
      </div>
    </div>
  );
}

function ProjectModal({ open, onClose, project }) {
  useEffect(() => {
    if (!open) return;

    function onKeyDown(e) {
      if (e.key === "Escape") onClose();
    }

    document.addEventListener("keydown", onKeyDown);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open || !project) return null;

  const skills = pickList(project, "selectedSkills");
  const locations = pickList(project, "selectedLocations");

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4"
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="absolute inset-0 bg-black/60" />

      <div className="relative z-10 w-full max-w-3xl rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl max-h-[92vh] overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 border-b border-slate-800 px-4 sm:px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-slate-100">
              Project Details
            </h2>
            <div className="mt-1 text-xs text-slate-400 break-words">
              ID: <span className="text-slate-300">{project?.id || "—"}</span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-full sm:w-auto rounded-lg border border-slate-700 bg-slate-950/30 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800 transition active:scale-[0.99]"
          >
            Close
          </button>
        </div>

        <div className="max-h-[75vh] overflow-y-auto px-4 sm:px-5 py-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {/* Main fields */}
            <Field label="Project ID">{project?.projectId || "—"}</Field>
            <Field label="Status">
              <StatusBadge
                status={project?.status}
                isPublished={project?.isPublished}
              />
            </Field>
            <Field label="Start">{toDateText(project?.projectStart)}</Field>
            <Field label="End">{toDateText(project?.projectEnd)}</Field>

            <div className="sm:col-span-2">
              <Field label="Project Description">
                <div className="whitespace-pre-wrap">
                  {project?.projectDescription || "—"}
                </div>
              </Field>
            </div>

            <div className="sm:col-span-2">
              <Field label="Task Description">
                <div className="whitespace-pre-wrap">
                  {project?.taskDescription || "—"}
                </div>
              </Field>
            </div>

            <div className="sm:col-span-2">
              <Field label="Link">
                {project?.links ? (
                  <a
                    className="text-emerald-300 hover:underline break-all"
                    href={project.links}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {project.links}
                  </a>
                ) : (
                  "—"
                )}
              </Field>
            </div>

            <div className="sm:col-span-2">
              <Field label="Selected Skills">{joinList(skills, 999)}</Field>
            </div>

            <div className="sm:col-span-2">
              <Field label="Selected Locations">
                {joinList(locations, 999)}
              </Field>
            </div>

            <div className="sm:col-span-2">
              <Field label="Roles">
                <RolesChips roles={project?.roles} />
              </Field>
            </div>

            {/* Other useful meta */}
            <Field label="External Search">
              {String(!!project?.isExternalSearch)}
            </Field>
            <Field label="Published">{String(!!project?.isPublished)}</Field>
            <Field label="Created At">{toDateText(project?.createdAt)}</Field>
            <Field label="Updated At">{toDateText(project?.updatedAt)}</Field>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-800 px-4 sm:px-5 py-4">
          <button
            onClick={onClose}
            className="w-full sm:w-auto rounded-lg border border-slate-700 bg-slate-950/30 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800 transition active:scale-[0.99]"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ProjectsExplorer({ initialProjects = [] }) {
  const [projects] = useState(initialProjects);

  const [tab, setTab] = useState("all"); // all | published | draft
  const [q, setQ] = useState("");

  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(null);

  // UI-only: show skeleton once when initialProjects empty (optional)
  const [hydrating, setHydrating] = useState(false);
  useEffect(() => {
    if (initialProjects?.length) return;
    setHydrating(true);
    const t = setTimeout(() => setHydrating(false), 550);
    return () => clearTimeout(t);
  }, [initialProjects?.length]);

  const counts = useMemo(() => {
    const published = projects.filter(
      (p) => p?.isPublished === true || String(p?.isPublished) === "true",
    ).length;
    const draft = projects.length - published;
    return { all: projects.length, published, draft };
  }, [projects]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();

    return projects
      .filter((p) => {
        if (tab === "published")
          return p?.isPublished === true || String(p?.isPublished) === "true";
        if (tab === "draft")
          return !(
            p?.isPublished === true || String(p?.isPublished) === "true"
          );
        return true;
      })
      .filter((p) => {
        if (!needle) return true;

        const skills = joinList(pickList(p, "selectedSkills"), 999);
        const locations = joinList(pickList(p, "selectedLocations"), 999);

        const hay = [
          p?.projectId,
          p?.projectDescription,
          p?.projectStart,
          p?.projectEnd,
          p?.taskDescription,
          p?.status,
          p?.links,
          skills,
          locations,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return hay.includes(needle);
      });
  }, [projects, tab, q]);

  function openModal(p) {
    setSelected(p);
    setOpen(true);
  }

  function closeModal() {
    setOpen(false);
    setSelected(null);
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 px-4 py-6">
      <div className="mx-auto w-full max-w-7xl">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold">All Projects</h1>
            <p className="mt-1 text-sm text-slate-400">
              Browse, search, and open a project to view details.
            </p>
          </div>

          {/* Optional: quick back link (UI only) */}
          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800 transition"
            >
              Back
            </Link>
          </div>
        </div>

        {/* Tabs + Search */}
        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            {[
              ["all", "All"],
              ["published", "Published"],
              ["draft", "Draft"],
            ].map(([key, label]) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`rounded-lg px-3 py-2 text-sm border transition active:scale-[0.99] ${
                  tab === key
                    ? "border-emerald-400/60 bg-emerald-500/10 text-emerald-200"
                    : "border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800"
                }`}
              >
                {label}{" "}
                <span className="ml-1 text-slate-400">({counts[key]})</span>
              </button>
            ))}
          </div>

          <div className="w-full sm:w-96 relative">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search projectId, description, skills, locations..."
              className="w-full rounded-lg border border-slate-700 bg-slate-900 pl-3 pr-20 py-2 text-sm text-slate-100 placeholder:text-slate-500 outline-none focus:border-emerald-400/60"
            />
            {q?.trim() ? (
              <button
                type="button"
                onClick={() => setQ("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md border border-slate-700 bg-slate-950/30 px-2 py-1 text-[11px] text-slate-200 hover:bg-slate-800 transition active:scale-[0.99]"
              >
                Clear
              </button>
            ) : null}
          </div>
        </div>

        {/* Cards (Responsive on all devices) */}
        <div className="mt-5">
          {/* Skeletons */}
          {hydrating && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <ProjectCardSkeleton key={i} />
              ))}
            </div>
          )}

          {/* Empty */}
          {!hydrating && filtered.length === 0 && (
            <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 text-sm text-slate-300">
              No projects found.
            </div>
          )}

          {/* Cards */}
          {!hydrating && filtered.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {filtered.map((p) => {
                const skills = pickList(p, "selectedSkills");
                const locations = pickList(p, "selectedLocations");

                return (
                  <button
                    key={p?.id || p?.projectId}
                    type="button"
                    onClick={() => openModal(p)}
                    className="text-left rounded-2xl border border-slate-800 bg-slate-900/40 p-4 hover:bg-slate-900/60 hover:border-slate-700 transition active:scale-[0.99]"
                    title="Click to view"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-slate-100 truncate">
                          {p?.projectId || "—"}
                        </div>
                        <div className="mt-1 text-xs text-slate-400 line-clamp-2">
                          {p?.projectDescription || "—"}
                        </div>
                      </div>

                      <div className="shrink-0">
                        <StatusBadge
                          status={p?.status}
                          isPublished={p?.isPublished}
                        />
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
                        <div className="text-[11px] uppercase tracking-wide text-slate-500">
                          Start
                        </div>
                        <div className="mt-1 text-sm text-slate-100">
                          {toDateText(p?.projectStart)}
                        </div>
                      </div>

                      <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
                        <div className="text-[11px] uppercase tracking-wide text-slate-500">
                          End
                        </div>
                        <div className="mt-1 text-sm text-slate-100">
                          {toDateText(p?.projectEnd)}
                        </div>
                      </div>

                      <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3 col-span-2">
                        <div className="text-[11px] uppercase tracking-wide text-slate-500">
                          Locations
                        </div>
                        <div className="mt-1 text-sm text-slate-100">
                          {joinList(locations, 6)}
                        </div>
                      </div>

                      <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3 col-span-2">
                        <div className="text-[11px] uppercase tracking-wide text-slate-500">
                          Skills
                        </div>
                        <div className="mt-1 text-sm text-slate-100">
                          {joinList(skills, 6)}
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 flex items-center justify-end gap-2">
                      <span className="text-xs text-slate-400">
                        Click to view details
                      </span>
                      <span className="text-xs rounded-lg border border-slate-700 bg-slate-950/30 px-3 py-2 text-slate-200">
                        Open
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <ProjectModal open={open} onClose={closeModal} project={selected} />
      </div>
    </div>
  );
}
