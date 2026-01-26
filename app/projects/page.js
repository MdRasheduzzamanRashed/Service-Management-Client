// app/projects/page.jsx
import ProjectsExplorer from "./ProjectsExplorer";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// ✅ Use SERVER env first (recommended). NEXT_PUBLIC_* is for client.
const PROJECTS_API = (
  process.env.PROJECTS_API ||
  process.env.NEXT_PUBLIC_PROJECTS_API ||
  ""
).trim();

/* =========================
   New API list extraction
   supports: [...] | {data:[...]} | {projects:[...]} | {items:[...]}
========================= */
function extractList(json) {
  return (
    (Array.isArray(json) && json) ||
    (Array.isArray(json?.data) && json.data) ||
    (Array.isArray(json?.projects) && json.projects) ||
    (Array.isArray(json?.items) && json.items) ||
    []
  );
}

/* =========================
   Normalize project shape (optional but helpful)
========================= */
function normalizeProject(raw) {
  const p = raw || {};
  const id = String(p.id || p._id || p.projectId || "").trim();

  const isPublished =
    typeof p.isPublished === "boolean"
      ? p.isPublished
      : String(p.status || "").toUpperCase() === "PLANNED";

  return {
    // keep raw too if your explorer needs fields not listed here
    ...p,

    // normalized
    id,
    projectId: String(p.projectId || p.id || "").trim(),
    projectDescription: p.projectDescription || p.title || p.name || "",
    projectStart: p.projectStart || p.startDate || "",
    projectEnd: p.projectEnd || p.endDate || "",
    taskDescription: p.taskDescription || "",
    requiredEmployees:
      p.requiredEmployees != null ? Number(p.requiredEmployees) : null,

    isPublished,
    status: String(p.status || "").toUpperCase(),
    isExternalSearch: !!p.isExternalSearch,
    isApplicationsAllowed: !!p.isApplicationsAllowed,
  };
}

async function fetchProjectsRaw() {
  if (!PROJECTS_API) {
    throw new Error("Missing env: PROJECTS_API (or NEXT_PUBLIC_PROJECTS_API)");
  }

  // ✅ Timeout for Render / slow API
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);

  try {
    const res = await fetch(PROJECTS_API, {
      headers: { Accept: "application/json" },
      cache: "no-store",
      // ✅ avoid caching/proxy weirdness
      next: { revalidate: 0 },
      signal: controller.signal,
    });

    const text = await res.text().catch(() => "");

    if (!res.ok) {
      throw new Error(
        `Projects API failed (${res.status}): ${text.slice(0, 200)}`,
      );
    }

    let json;
    try {
      json = JSON.parse(text);
    } catch {
      throw new Error(`Projects JSON parse failed: ${text.slice(0, 200)}`);
    }

    const list = extractList(json);

    // ✅ Normalize so UI doesn't break if fields vary
    const normalized = list
      .map(normalizeProject)
      .filter((p) => p?.id || p?.projectId);

    return normalized;
  } catch (err) {
    if (err?.name === "AbortError") {
      throw new Error("Projects API timeout (12s)");
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

export default async function Projects() {
  let projects = [];
  let error = "";

  try {
    projects = await fetchProjectsRaw();
  } catch (err) {
    error = err?.message || "Failed to load projects.";
  }

  return (
    <main className="min-h-[calc(100vh-64px)] bg-slate-950 my-4">
      <div className="mx-auto max-w-7xl px-4 py-6">
        {error && (
          <div className="mb-4 rounded-lg border border-red-700/40 bg-red-950/40 px-4 py-2 text-xs text-red-300">
            {error}
          </div>
        )}

        {/* ✅ Your explorer receives stable shape now */}
        <ProjectsExplorer initialProjects={projects} />
      </div>
    </main>
  );
}
