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
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="absolute inset-0 bg-black/60" />

      <div className="relative z-10 w-full max-w-3xl rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-slate-800 px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-100">
              Project Details
            </h2>
            <div className="mt-1 text-xs text-slate-400">
              ID: <span className="text-slate-300">{project?.id || "—"}</span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-lg border border-slate-700 bg-slate-950/30 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800 transition"
          >
            Close
          </button>
        </div>

        <div className="max-h-[75vh] overflow-y-auto px-5 py-4">
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

        <div className="flex items-center justify-end gap-2 border-t border-slate-800 px-5 py-4">
          <button
            onClick={onClose}
            className="rounded-lg border border-slate-700 bg-slate-950/30 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800 transition"
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

        // Search only main fields + skills/locations text
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
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-7xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Projects</h1>
            <p className="mt-1 text-sm text-slate-400">
              Click a row to open full project details.
            </p>
          </div>

          <Link
            href="/dashboard"
            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800 transition"
          >
            ← Back
          </Link>
        </div>

        {/* Tabs + Search (same style as contracts) */}
        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            {[
              ["all", "All"],
              ["published", "Published"],
              ["draft", "Draft"],
            ].map(([key, label]) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`rounded-lg px-3 py-2 text-sm border transition ${
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

          <div className="w-full sm:w-96">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search projectId, description, skills, locations..."
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 outline-none focus:border-emerald-400/60"
            />
          </div>
        </div>

        {/* Table (MAIN data only) */}
        <div className="mt-5 rounded-xl border border-slate-800 bg-slate-900/40">
          {filtered.length === 0 ? (
            <div className="p-5 text-sm text-slate-300">No projects found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-slate-300">
                  <tr className="border-b border-slate-800">
                    <th className="px-4 py-3">Project ID</th>
                    <th className="px-4 py-3">Project Description</th>
                    <th className="px-4 py-3">Start</th>
                    <th className="px-4 py-3">End</th>
                    <th className="px-4 py-3">Locations</th>
                    <th className="px-4 py-3">Skills</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>

                <tbody>
                  {filtered.map((p) => {
                    const skills = pickList(p, "selectedSkills");
                    const locations = pickList(p, "selectedLocations");

                    return (
                      <tr
                        key={p?.id || p?.projectId}
                        onClick={() => openModal(p)}
                        className="cursor-pointer border-b border-slate-800/70 hover:bg-slate-800/40 transition"
                        title="Click to view"
                      >
                        <td className="px-4 py-3 font-medium text-slate-100">
                          {p?.projectId || "—"}
                        </td>

                        <td className="px-4 py-3 text-slate-300">
                          <div className="max-w-md truncate">
                            {p?.projectDescription || "—"}
                          </div>
                        </td>

                        <td className="px-4 py-3 text-slate-300">
                          {toDateText(p?.projectStart)}
                        </td>

                        <td className="px-4 py-3 text-slate-300">
                          {toDateText(p?.projectEnd)}
                        </td>

                        <td className="px-4 py-3 text-slate-300">
                          {joinList(locations)}
                        </td>

                        <td className="px-4 py-3 text-slate-300">
                          {joinList(skills)}
                        </td>

                        <td className="px-4 py-3">
                          <StatusBadge
                            status={p?.status}
                            isPublished={p?.isPublished}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <ProjectModal open={open} onClose={closeModal} project={selected} />
      </div>
    </div>
  );
}
