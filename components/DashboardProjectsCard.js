"use client";

import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

const PROJECTS_API = process.env.NEXT_PUBLIC_PROJECTS_API;

function numClass(kind, n) {
  const v = Number(n || 0);
  if (v <= 0) return "text-slate-500";
  if (kind === "published") return "text-emerald-300";
  if (kind === "draft") return "text-amber-300";
  return "text-slate-50";
}

export default function DashboardProjectsCard() {
  const router = useRouter();

  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    let alive = true;
    const t = toast.loading("Loading projects...");

    async function load() {
      try {
        setLoading(true);
        setErr("");

        if (!PROJECTS_API) {
          throw new Error("Missing NEXT_PUBLIC_PROJECTS_API");
        }

        const res = await axios.get(PROJECTS_API, {
          headers: { Accept: "application/json" },
        });

        const data = res.data;

        const list =
          (Array.isArray(data) && data) ||
          (Array.isArray(data?.data) && data.data) ||
          (Array.isArray(data?.projects) && data.projects) ||
          [];

        if (!alive) return;
        setProjects(list);
        toast.success("Projects loaded", { id: t });
      } catch (e) {
        if (!alive) return;
        const msg =
          e?.response?.data?.error || e?.message || "Failed to load projects";
        setErr(msg);
        toast.error(msg, { id: t });
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    }

    load();

    return () => {
      alive = false;
      toast.dismiss(t);
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
      className="relative z-10 overflow-visible group w-full max-w-sm cursor-pointer"
      onClick={() => router.push("/projects")}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && router.push("/projects")}
    >
      {/* MAIN CARD */}
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

      {/* HOVER DETAILS */}
      {!loading && !err && (
        <div className="pointer-events-none absolute left-1/2 top-full z-50 mt-3 w-56 -translate-x-1/2 translate-y-2 opacity-0 rounded-xl border border-slate-700 bg-slate-900 p-3 text-xs text-slate-200 shadow-xl transition-all duration-200 group-hover:opacity-100 group-hover:translate-y-0">
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Published</span>
            <span
              className={`font-semibold ${numClass("published", stats.published)}`}
            >
              {stats.published}
            </span>
          </div>

          <div className="mt-2 flex items-center justify-between">
            <span className="text-slate-400">Draft</span>
            <span className={`font-semibold ${numClass("draft", stats.draft)}`}>
              {stats.draft}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
