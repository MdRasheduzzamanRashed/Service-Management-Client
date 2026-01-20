// app/projects/page.jsx
import ProjectsExplorer from "./ProjectsExplorer";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const PROJECTS_API = process.env.NEXT_PUBLIC_PROJECTS_API;

async function fetchProjectsRaw() {
  if (!PROJECTS_API) {
    throw new Error("Missing env: NEXT_PUBLIC_PROJECTS_API");
  }

  const res = await fetch(PROJECTS_API, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `Projects API failed (${res.status}): ${text.slice(0, 200)}`,
    );
  }

  // JSON
  const json = await res.json();

  const list =
    (Array.isArray(json) && json) ||
    (Array.isArray(json?.data) && json.data) ||
    (Array.isArray(json?.projects) && json.projects) ||
    [];

  return list;
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
        <ProjectsExplorer initialProjects={projects} />
      </div>
    </main>
  );
}
