"use client";

import { useEffect, useMemo, useState } from "react";

function asArray(v) {
  if (!v) return [];
  return Array.isArray(v) ? v : [v];
}

function pick(obj, keys, fallback = "") {
  for (const k of keys) {
    const v = obj?.[k];
    if (v === 0) return 0;
    if (v === false) return false;
    if (v !== undefined && v !== null && String(v).trim() !== "") return v;
  }
  return fallback;
}

function normalizeSkills(p) {
  // sample: selectedSkills: { selectedSkills: ["Ethereum","Web3.js"] }
  const root = p?.selectedSkills;
  const items = root?.selectedSkills;
  return asArray(items).filter(Boolean).map(String);
}

function normalizeLocations(p) {
  const root = p?.selectedLocations;
  const items = root?.selectedLocations;
  return asArray(items).filter(Boolean).map(String);
}

function normalizeRoles(p) {
  // sample: roles: { roles: [{ requiredRole, requiredCompetencies:{requiredCompetencies:[]}, capacity, numberOfEmployees ...}] }
  const root = p?.roles;
  const items = root?.roles;
  return asArray(items).map((r) => ({
    requiredRole: pick(r, ["requiredRole"], ""),
    competencies: asArray(r?.requiredCompetencies?.requiredCompetencies)
      .filter(Boolean)
      .map(String),
    capacity: pick(r, ["capacity"], ""),
    numberOfEmployees: pick(r, ["numberOfEmployees"], ""),
    roleInput: pick(r, ["roleInput"], ""),
    competencyInput: pick(r, ["competencyInput"], ""),
    showRoleDropdown: pick(r, ["showRoleDropdown"], ""),
    showCompetencyDropdown: pick(r, ["showCompetencyDropdown"], ""),
  }));
}

function formatDate(d) {
  if (!d) return "—";
  return String(d);
}

function Badge({ children }) {
  return (
    <span className="inline-flex items-center rounded-full border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] text-slate-200">
      {children}
    </span>
  );
}

function Chip({ children }) {
  return (
    <span className="inline-flex items-center rounded-full bg-emerald-500/10 border border-emerald-500/30 px-2 py-1 text-[11px] text-emerald-200">
      {children}
    </span>
  );
}

export default function ProjectsExplorer({ initialProjects = [] }) {
  const [q, setQ] = useState("");
  const [activeId, setActiveId] = useState(null);

  // pick first project by default
  useEffect(() => {
    if (!activeId && initialProjects.length > 0) {
      const first = initialProjects[0];
      const id = pick(first, ["id", "_id"], null);
      setActiveId(id);
    }
  }, [activeId, initialProjects]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return initialProjects;

    return initialProjects.filter((p) => {
      const hay = [
        pick(p, ["projectId", "id", "_id"]),
        pick(p, ["projectDescription"]),
        pick(p, ["taskDescription"]),
        pick(p, ["links"]),
        ...normalizeSkills(p),
        ...normalizeLocations(p),
      ]
        .map((x) => String(x || "").toLowerCase())
        .join(" | ");

      return hay.includes(query);
    });
  }, [q, initialProjects]);

  const active = useMemo(() => {
    if (!activeId) return null;
    return (
      initialProjects.find((p) => pick(p, ["id", "_id"], "") === activeId) ||
      filtered.find((p) => pick(p, ["id", "_id"], "") === activeId) ||
      null
    );
  }, [activeId, initialProjects, filtered]);

  const activeSkills = active ? normalizeSkills(active) : [];
  const activeLocations = active ? normalizeLocations(active) : [];
  const activeRoles = active ? normalizeRoles(active) : [];

  return (
    <section className="grid grid-cols-4 gap-4">
      {/* LEFT LIST */}
      <aside className="rounded-2xl border border-slate-800 bg-slate-900">
        <div className="p-4 border-b border-slate-800">
          <h1 className="text-lg font-semibold text-slate-100">Projects</h1>
          <p className="text-xs text-slate-400 mt-1">
            {filtered.length} project{filtered.length === 1 ? "" : "s"}
          </p>

          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search projectId, description, skills..."
            className="mt-3 w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-emerald-400"
          />
        </div>

        <div className="max-h-[70vh] overflow-auto">
          {filtered.length === 0 ? (
            <div className="p-4 text-sm text-slate-300">No projects found.</div>
          ) : (
            filtered.map((p) => {
              const id = pick(p, ["id", "_id"], "");
              const projectId = pick(p, ["projectId"], "—");
              const desc = pick(p, ["projectDescription"], "No description");
              const start = pick(p, ["projectStart"], "");
              const end = pick(p, ["projectEnd"], "");
              const published = !!pick(p, ["isPublished"], false);

              const isActive = id === activeId;

              return (
                <button
                  key={id}
                  onClick={() => setActiveId(id)}
                  className={[
                    "w-full text-left p-4 border-b border-slate-800 hover:bg-slate-950/40 transition",
                    isActive ? "bg-slate-950/50" : "",
                  ].join(" ")}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-100">
                        {projectId}
                      </p>
                      <p className="mt-1 text-xs text-slate-400 line-clamp-2">
                        {desc}
                      </p>
                    </div>
                    <span
                      className={[
                        "shrink-0 rounded-full px-2 py-1 text-[10px] border",
                        published
                          ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-200"
                          : "bg-slate-800 border-slate-700 text-slate-300",
                      ].join(" ")}
                    >
                      {published ? "Published" : "Draft"}
                    </span>
                  </div>

                  <div className="mt-2 flex flex-wrap gap-2">
                    {start ? <Badge>Start: {formatDate(start)}</Badge> : null}
                    {end ? <Badge>End: {formatDate(end)}</Badge> : null}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </aside>

      {/* RIGHT DETAILS */}
      <div className="col-span-3 rounded-2xl border border-slate-800 bg-slate-900">
        {!active ? (
          <div className="p-6 text-slate-200">Select a project to view.</div>
        ) : (
          <div className="p-6 space-y-5">
            {/* Header */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <h2 className="text-xl font-semibold text-slate-100">
                  {pick(active, ["projectId"], "Project")}
                </h2>
                <p className="mt-1 text-sm text-slate-300">
                  {pick(active, ["projectDescription"], "—")}
                </p>

                <div className="mt-3 flex flex-wrap gap-2">
                  <Badge>ID: {pick(active, ["id", "_id"], "—")}</Badge>
                  {pick(active, ["status"], "") ? (
                    <Badge>Status: {pick(active, ["status"], "")}</Badge>
                  ) : null}
                  <Badge>
                    Published: {String(!!pick(active, ["isPublished"], false))}
                  </Badge>
                  <Badge>
                    External Search:{" "}
                    {String(!!pick(active, ["isExternalSearch"], false))}
                  </Badge>
                </div>
              </div>

              {/* Link */}
              {pick(active, ["links"], "") ? (
                <a
                  href={pick(active, ["links"], "")}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-black hover:bg-emerald-400"
                >
                  Open Project Link
                </a>
              ) : null}
            </div>

            {/* Timeline + Task */}
            <div className="grid gap-4 lg:grid-cols-2">
              <Card title="Timeline">
                <div className="grid grid-cols-2 gap-3">
                  <KV
                    label="Project Start"
                    value={formatDate(pick(active, ["projectStart"], ""))}
                  />
                  <KV
                    label="Project End"
                    value={formatDate(pick(active, ["projectEnd"], ""))}
                  />
                  <KV
                    label="Created At"
                    value={formatDate(pick(active, ["createdAt"], ""))}
                  />
                  <KV
                    label="Updated At"
                    value={formatDate(pick(active, ["updatedAt"], ""))}
                  />
                </div>
              </Card>

              <Card title="Task Description">
                <p className="text-sm text-slate-200 whitespace-pre-wrap">
                  {pick(active, ["taskDescription"], "—")}
                </p>
              </Card>
            </div>

            {/* Skills & Locations */}
            <div className="grid gap-4 lg:grid-cols-2">
              <Card title={`Selected Skills (${activeSkills.length})`}>
                {activeSkills.length === 0 ? (
                  <EmptyLine text="No skills selected." />
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {activeSkills.map((s, i) => (
                      <Chip key={i}>{s}</Chip>
                    ))}
                  </div>
                )}
              </Card>

              <Card title={`Selected Locations (${activeLocations.length})`}>
                {activeLocations.length === 0 ? (
                  <EmptyLine text="No locations selected." />
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {activeLocations.map((l, i) => (
                      <Chip key={i}>{l}</Chip>
                    ))}
                  </div>
                )}
              </Card>
            </div>

            {/* Roles */}
            <Card title={`Roles (${activeRoles.length})`}>
              {activeRoles.length === 0 ? (
                <EmptyLine text="No roles found." />
              ) : (
                <div className="space-y-3">
                  {activeRoles.map((r, idx) => (
                    <details
                      key={idx}
                      className="rounded-xl border border-slate-800 bg-slate-950/30 p-3"
                    >
                      <summary className="cursor-pointer list-none">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-slate-100">
                              {r.requiredRole || `Role #${idx + 1}`}
                            </p>
                            <p className="mt-1 text-xs text-slate-400">
                              Capacity: {r.capacity || "—"} · Employees:{" "}
                              {r.numberOfEmployees || "—"}
                            </p>
                          </div>
                          <span className="text-[11px] text-emerald-300">
                            Expand
                          </span>
                        </div>
                      </summary>

                      <div className="mt-3 grid gap-3 lg:grid-cols-2">
                        <div>
                          <p className="text-[11px] text-slate-500">
                            Required Competencies
                          </p>
                          {r.competencies.length === 0 ? (
                            <p className="text-sm text-slate-200 mt-1">—</p>
                          ) : (
                            <div className="mt-2 flex flex-wrap gap-2">
                              {r.competencies.map((c, i) => (
                                <Chip key={i}>{c}</Chip>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <KV
                            label="showRoleDropdown"
                            value={String(r.showRoleDropdown)}
                          />
                          <KV
                            label="showCompetencyDropdown"
                            value={String(r.showCompetencyDropdown)}
                          />
                          <KV label="roleInput" value={r.roleInput || "—"} />
                          <KV
                            label="competencyInput"
                            value={r.competencyInput || "—"}
                          />
                        </div>
                      </div>
                    </details>
                  ))}
                </div>
              )}
            </Card>

            {/* Meta */}
            <Card title="Meta / Audit">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <KV
                  label="createdBy"
                  value={pick(active, ["createdBy"], "—")}
                />
                <KV
                  label="updatedBy"
                  value={pick(active, ["updatedBy"], "—")}
                />
                <KV
                  label="requiredEmployees"
                  value={pick(active, ["requiredEmployees"], "—")}
                />
              </div>

              <details className="mt-4">
                <summary className="cursor-pointer text-xs text-emerald-300 hover:underline">
                  View raw project JSON
                </summary>
                <pre className="mt-2 max-h-72 overflow-auto rounded-lg border border-slate-800 bg-slate-950/40 p-3 text-[11px] text-slate-200">
                  {JSON.stringify(active, null, 2)}
                </pre>
              </details>
            </Card>
          </div>
        )}
      </div>
    </section>
  );
}

function Card({ title, children }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-100">{title}</h3>
      </div>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function KV({ label, value }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/30 p-3">
      <p className="text-[11px] text-slate-500">{label}</p>
      <p className="mt-1 text-sm text-slate-200 break-words">{value || "—"}</p>
    </div>
  );
}

function EmptyLine({ text }) {
  return <p className="text-sm text-slate-300">{text}</p>;
}
