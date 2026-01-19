// app/projects/page.jsx
import ProjectsExplorer from "./ProjectsExplorer";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const PROJECTS_API = process.env.NEXT_PROJECTS_API;

async function fetchProjectsRaw() {
  const res = await fetch(PROJECTS_API, {
    headers: { Accept: "application/json, application/xml, text/xml" },
    cache: "no-store",
  });

  // If their server returns XML, your backend should proxy/convert.
  // If it returns JSON already, great.
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `Projects API failed (${res.status}): ${text.slice(0, 200)}`
    );
  }

  // Try JSON first
  const text = await res.text();
  try {
    const json = JSON.parse(text);

    const list =
      (Array.isArray(json) && json) ||
      (Array.isArray(json?.data) && json.data) ||
      (Array.isArray(json?.projects) && json.projects) ||
      [];

    return list;
  } catch {
    // If this endpoint truly returns XML, you should proxy it through your backend.
    // For now we throw a readable error:
    throw new Error(
      "Projects API returned non-JSON (XML). Please proxy/convert it to JSON in your backend."
    );
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
      <div className="mx-auto max-w-7xl">
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
