// app/projects/page.jsx
import ProjectsExplorer from "./ProjectsExplorer";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const PROJECTS_API = "https://workforcemangementtool.onrender.com/api/projects";

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
  const projects = await fetchProjectsRaw();

  return (
    <main className="min-h-[calc(100vh-64px)] bg-slate-950 my-4">
      <div className="mx-auto max-w-7xl">
        <ProjectsExplorer initialProjects={projects} />
      </div>
    </main>
  );
}
