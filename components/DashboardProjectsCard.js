"use client";

import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useRouter } from "next/navigation";

const PROJECTS_API =
  process.env.NEXT_PROJECTS_API ||
  "https://workforcemangementtool.onrender.com/api/projects";

export default function DashboardProjectsCard() {
  const router = useRouter();

  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    let alive = true;

    async function load() {
      setLoading(true);
      setErr("");

      try {
        const res = await axios.get(PROJECTS_API, {
          headers: { Accept: "application/json" },
        });

        const data = res.data;

        // supports: [...] OR {data:[...]} OR {projects:[...]}
        const list =
          (Array.isArray(data) && data) ||
          (Array.isArray(data?.data) && data.data) ||
          (Array.isArray(data?.projects) && data.projects) ||
          [];

        if (alive) setProjects(list);
      } catch (e) {
        if (!alive) return;
        setErr(
          e?.response?.data?.error || e?.message || "Failed to load projects"
        );
      } finally {
        if (alive) setLoading(false);
      }
    }

    load();
    return () => {
      alive = false;
    };
  }, []);

  const stats = useMemo(() => {
    const total = projects.length;
    const published = projects.filter((p) => p?.isPublished === true).length;
    const draft = total - published;

    return { total, published, draft };
  }, [projects]);

  return (
    <div
      className="relative group w-full max-w-sm cursor-pointer"
      onClick={() => router.push("/projects")}
    >
      {/* MAIN CARD */}
      <div className="bg-slate-700 rounded-xl p-4 border border-slate-600 hover:border-emerald-400 hover:bg-slate-600/80 transition">
        <h3 className="text-sm text-slate-200 font-medium">Projects</h3>

        {loading ? (
          <h2 className="mt-1 text-2xl font-semibold text-white">Loading...</h2>
        ) : err ? (
          <div className="mt-2 text-xs text-red-300">{err}</div>
        ) : (
          <h2 className="mt-1 text-2xl font-semibold text-white">
            Total: {stats.total}
          </h2>
        )}
      </div>

      {/* HOVER DETAILS */}
      {!loading && !err && (
        <div className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 w-56 -translate-x-1/2 rounded-xl border border-slate-700 bg-slate-900 p-3 text-xs text-slate-200 opacity-0 shadow-xl transition-all duration-200 group-hover:opacity-100 group-hover:translate-y-1">
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Published</span>
            <span className="text-emerald-400 font-semibold">
              {stats.published}
            </span>
          </div>

          <div className="mt-2 flex items-center justify-between">
            <span className="text-slate-400">Draft</span>
            <span className="text-yellow-300 font-semibold">{stats.draft}</span>
          </div>
        </div>
      )}
    </div>
  );
}
