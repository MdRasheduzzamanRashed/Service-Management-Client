"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useContext,
} from "react";
import toast from "react-hot-toast";
import { apiPost } from "../lib/api";
import { AuthContext } from "../context/AuthContext";

/* =========================
   Helpers
========================= */
function uniq(arr) {
  return Array.from(new Set((arr || []).filter(Boolean)));
}

function safeStr(x) {
  return String(x ?? "").trim();
}

function numOrNull(v) {
  if (v === "" || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function clampInt(val, min, max) {
  const n = Number(val);
  if (!Number.isFinite(n)) return min;
  const x = Math.trunc(n);
  return Math.max(min, Math.min(max, x));
}

// Project API sometimes returns XML-shaped fields or nested arrays.
// This normalizer makes your form stable.
function normalizeProject(p) {
  if (!p) return null;

  const id = p.projectId || p.id || p._id || "";
  const title = p.projectDescription || p.title || p.name || "";
  const taskDescription = p.taskDescription || p.description || "";
  const projectStart = p.projectStart || p.startDate || "";
  const projectEnd = p.projectEnd || p.endDate || "";

  const selectedSkillsRaw =
    p.selectedSkills?.selectedSkills ||
    p.selectedSkills ||
    p.skills ||
    p.selectedSkill ||
    [];
  const selectedSkills = Array.isArray(selectedSkillsRaw)
    ? selectedSkillsRaw
    : typeof selectedSkillsRaw === "string"
      ? [selectedSkillsRaw]
      : [];

  const selectedLocationsRaw =
    p.selectedLocations?.selectedLocations ||
    p.selectedLocations ||
    p.locations ||
    [];
  const selectedLocations = Array.isArray(selectedLocationsRaw)
    ? selectedLocationsRaw
    : typeof selectedLocationsRaw === "string"
      ? [selectedLocationsRaw]
      : [];

  const rolesRaw = Array.isArray(p.roles)
    ? p.roles
    : Array.isArray(p.roles?.roles)
      ? p.roles.roles
      : [];

  const roles = (rolesRaw || []).map((r, idx) => {
    const requiredRole =
      r.requiredRole || r.role || r.roleName || `Role ${idx + 1}`;

    const requiredCompetenciesRaw =
      r.requiredCompetencies?.requiredCompetencies ||
      r.requiredCompetencies ||
      r.competencies ||
      [];
    const requiredCompetencies = Array.isArray(requiredCompetenciesRaw)
      ? requiredCompetenciesRaw
      : typeof requiredCompetenciesRaw === "string"
        ? [requiredCompetenciesRaw]
        : [];

    const numberOfEmployees =
      r.numberOfEmployees ?? r.requiredEmployees ?? r.employees ?? "";

    const capacity = r.capacity ?? "";

    return {
      requiredRole: safeStr(requiredRole),
      requiredCompetencies: uniq(requiredCompetencies.map((x) => safeStr(x))),
      numberOfEmployees:
        numberOfEmployees === "" ? "" : String(numberOfEmployees),
      capacity: capacity === "" ? "" : String(capacity),
    };
  });

  const requiredEmployees =
    p.requiredEmployees ?? p.requiredEmployee ?? p.targetPersons ?? "";

  return {
    raw: p,
    projectId: String(id),
    projectDescription: title,
    taskDescription,
    projectStart: projectStart ? String(projectStart).slice(0, 10) : "",
    projectEnd: projectEnd ? String(projectEnd).slice(0, 10) : "",
    requiredEmployees:
      requiredEmployees === "" ? "" : String(requiredEmployees),
    selectedSkills: uniq(selectedSkills.map((x) => safeStr(x))),
    selectedLocations: uniq(selectedLocations.map((x) => safeStr(x))),
    roles,
    links: p.links || p.link || "",
  };
}

function suggestTypeFromProject(project) {
  if (!project) return "SINGLE";
  const roleCount = project.roles?.length || 0;
  if (roleCount <= 1) return "SINGLE";

  const sum = (project.roles || []).reduce((acc, r) => {
    const n = Number(r.numberOfEmployees);
    return acc + (Number.isFinite(n) ? n : 0);
  }, 0);

  const req = Number(project.requiredEmployees);
  if (Number.isFinite(req) && req > 0 && sum > 0 && req === sum) return "TEAM";

  return "MULTI";
}

function extractContracts(json) {
  if (Array.isArray(json)) return json;
  if (Array.isArray(json?.data)) return json.data;
  if (Array.isArray(json?.contracts)) return json.contracts;
  return [];
}

function normalizeContract(c) {
  const raw = c || {};
  const id = String(raw?.id || raw?._id || raw?.contractId || "").trim();

  const supplier =
    raw?.supplier ||
    raw?.workflow?.coordinator?.selectedOffer?.provider?.name ||
    raw?.provider?.name ||
    "";

  const domain = raw?.domain || raw?.contractType || "";
  const title = raw?.title || raw?.referenceNumber || "Approved Contract";

  return {
    _raw: raw,
    id,
    supplier,
    domain,
    title,
    startDate:
      raw?.startDate ||
      raw?.workflow?.coordinator?.selectedOffer?.proposedTimeline?.startDate ||
      "",
    endDate:
      raw?.endDate ||
      raw?.workflow?.coordinator?.selectedOffer?.proposedTimeline?.endDate ||
      "",
  };
}

// returns max allowed employees for a role from selectedProject
function roleMaxEmployees(project, roleName) {
  if (!project || !roleName) return null;

  const r = (project.roles || []).find(
    (x) => String(x?.requiredRole) === String(roleName),
  );

  const max = Number(r?.numberOfEmployees);
  return Number.isFinite(max) && max > 0 ? max : null;
}

/* =========================
   Component
========================= */
export default function ServiceRequestForm({
  mode = "create",
  initialRequest = null,
  saving: savingProp,
  onSubmit,
  onCancel,
  onCreated,
}) {
  const { authHeaders } = useContext(AuthContext);

  const [projects, setProjects] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [refLoading, setRefLoading] = useState(false);
  const [err, setErr] = useState("");
  const [info, setInfo] = useState("");

  const [selectedProject, setSelectedProject] = useState(null);
  const [selectedContract, setSelectedContract] = useState(null);

  const savingLocalRef = useRef(false);
  const [savingLocal, setSavingLocal] = useState(false);
  const saving = savingProp ?? savingLocal;

  const [form, setForm] = useState({
    title: "",
    type: "SINGLE", // SINGLE | MULTI | TEAM
    projectId: "",
    projectName: "",
    contractId: "",
    contractSupplier: "",
    startDate: "",
    endDate: "",
    performanceLocation: "",
    maxOffers: "",
    maxAcceptedOffers: "",
    biddingCycleDays: 7,
    taskDescription: "",
    furtherInformation: "",
  });

  const emptyRoleRow = useCallback(
    () => ({
      roleName: "",
      employees: "1",
      requiredCompetencies: [],
      domain: "",
      technology: "",
      experienceLevel: "",
      manDays: "",
      onsiteDays: "",
    }),
    [],
  );

  const [roles, setRoles] = useState([emptyRoleRow()]);

  const [mustHave, setMustHave] = useState(["", "", ""]); // max 3
  const [niceToHave, setNiceToHave] = useState(["", "", "", "", ""]); // max 5

  const emptyLangRow = useCallback(() => ({ language: "", level: "B2" }), []);
  const [languages, setLanguages] = useState([emptyLangRow()]);

  const titleTouchedRef = useRef(false);

  /* ---------------- Load reference data ---------------- */
  useEffect(() => {
    let alive = true;

    async function loadRef() {
      setErr("");
      setRefLoading(true);

      const toastId = toast.loading("Loading projects & contracts...");

      try {
        const [pRes, cRes] = await Promise.all([
          fetch("/api/external/projects", { cache: "no-store" }),
          fetch("/api/external/contracts", { cache: "no-store" }),
        ]);

        if (!pRes.ok) {
          const j = await pRes.json().catch(() => null);
          throw new Error(j?.error || `Projects API failed: ${pRes.status}`);
        }
        if (!cRes.ok) {
          const j = await cRes.json().catch(() => null);
          throw new Error(j?.error || `Contracts API failed: ${cRes.status}`);
        }

        const pJson = await pRes.json();
        const cJson = await cRes.json();

        const pList = Array.isArray(pJson) ? pJson : [];
        const normalizedProjects = pList.map(normalizeProject).filter(Boolean);

        const cListRaw = extractContracts(cJson);
        const normalizedContracts = cListRaw
          .map(normalizeContract)
          .filter((c) => c.id);

        if (!alive) return;

        setProjects(normalizedProjects);
        setContracts(normalizedContracts);

        toast.success(
          `Loaded: ${normalizedProjects.length} projects, ${normalizedContracts.length} contracts`,
          { id: toastId },
        );
      } catch (e) {
        if (!alive) return;
        const msg = e?.message || "Failed to load reference data";
        setErr(msg);
        setProjects([]);
        setContracts([]);
        toast.error(msg, { id: toastId });
      } finally {
        if (!alive) return;
        setRefLoading(false);
        toast.dismiss(toastId);
      }
    }

    loadRef();
    return () => {
      alive = false;
    };
  }, []);

  /* ---------------- Prefill (edit mode) ---------------- */
  useEffect(() => {
    if (mode !== "edit" || !initialRequest) return;

    titleTouchedRef.current = true;

    setForm((prev) => ({
      ...prev,
      title: initialRequest.title || "",
      type: initialRequest.type || "SINGLE",
      projectId: initialRequest.projectId || "",
      projectName: initialRequest.projectName || "",
      contractId: initialRequest.contractId
        ? String(initialRequest.contractId)
        : "",
      contractSupplier: initialRequest.contractSupplier || "",
      startDate: initialRequest.startDate
        ? String(initialRequest.startDate).slice(0, 10)
        : "",
      endDate: initialRequest.endDate
        ? String(initialRequest.endDate).slice(0, 10)
        : "",
      performanceLocation: initialRequest.performanceLocation || "",
      maxOffers: initialRequest.maxOffers ?? "",
      maxAcceptedOffers: initialRequest.maxAcceptedOffers ?? "",
      biddingCycleDays: initialRequest.biddingCycleDays ?? 7,
      taskDescription: initialRequest.taskDescription || "",
      furtherInformation: initialRequest.furtherInformation || "",
    }));

    const reqRoles =
      Array.isArray(initialRequest.roles) && initialRequest.roles.length
        ? initialRequest.roles
        : [emptyRoleRow()];

    setRoles(
      reqRoles.map((r) => ({
        ...emptyRoleRow(),
        roleName: r.roleName || "",
        employees:
          r.numberOfEmployees != null ? String(r.numberOfEmployees) : "1",
        requiredCompetencies: Array.isArray(r.requiredCompetencies)
          ? r.requiredCompetencies
          : [],
        domain: r.domain || "",
        technology: r.technology || "",
        experienceLevel: r.experienceLevel || "",
        manDays: r.manDays ?? "",
        onsiteDays: r.onsiteDays ?? "",
      })),
    );

    setMustHave([
      initialRequest.mustHaveCriteria?.[0] || "",
      initialRequest.mustHaveCriteria?.[1] || "",
      initialRequest.mustHaveCriteria?.[2] || "",
    ]);

    setNiceToHave([
      initialRequest.niceToHaveCriteria?.[0] || "",
      initialRequest.niceToHaveCriteria?.[1] || "",
      initialRequest.niceToHaveCriteria?.[2] || "",
      initialRequest.niceToHaveCriteria?.[3] || "",
      initialRequest.niceToHaveCriteria?.[4] || "",
    ]);

    const langInput = initialRequest.requiredLanguagesWithLevel || [];
    const langRows = Array.isArray(langInput)
      ? langInput
          .map((x) =>
            typeof x === "string"
              ? { language: x, level: "B2" }
              : { language: x?.language || "", level: x?.level || "B2" },
          )
          .filter((x) => safeStr(x.language))
      : [];

    setLanguages(langRows.length ? langRows : [emptyLangRow()]);
  }, [mode, initialRequest, emptyRoleRow, emptyLangRow]);

  /* ---------------- Derived: project role options ---------------- */
  const projectRoleOptions = useMemo(() => {
    return (selectedProject?.roles || []).map((r) => ({
      label: r.requiredRole,
      value: r.requiredRole,
      requiredCompetencies: r.requiredCompetencies || [],
      defaultEmployees: r.numberOfEmployees || "1",
    }));
  }, [selectedProject]);

  const locationOptions = useMemo(
    () => selectedProject?.selectedLocations || [],
    [selectedProject],
  );

  /* ---------------- Auto-fill criteria from project/roles ---------------- */
  const recomputeCriteriaFromSelection = useCallback(
    (nextRoles) => {
      const comp = uniq(
        (nextRoles || [])
          .flatMap((rr) => rr.requiredCompetencies || [])
          .map((x) => safeStr(x)),
      ).slice(0, 3);

      setMustHave((prev) => {
        const userTouched = prev.some((x) => safeStr(x));
        return userTouched
          ? prev
          : [comp[0] || "", comp[1] || "", comp[2] || ""];
      });

      const skills = (selectedProject?.selectedSkills || []).slice(0, 5);
      setNiceToHave((prev) => {
        const userTouched = prev.some((x) => safeStr(x));
        return userTouched
          ? prev
          : [
              skills[0] || "",
              skills[1] || "",
              skills[2] || "",
              skills[3] || "",
              skills[4] || "",
            ];
      });
    },
    [selectedProject],
  );

  /* ---------------- Handlers ---------------- */
  const handleBasicChange = (e) => {
    const { name, value } = e.target;
    if (name === "title") titleTouchedRef.current = true;

    if (name === "type") {
      setForm((p) => ({ ...p, type: value }));

      if (value === "TEAM") {
        const all = projectRoleOptions.map((opt) => {
          const maxEmp = roleMaxEmployees(selectedProject, opt.value);
          const base = opt.defaultEmployees || "1";
          const clamped = String(clampInt(base, 1, maxEmp ?? 999999));
          return {
            roleName: opt.value,
            employees: clamped,
            requiredCompetencies: opt.requiredCompetencies || [],
            domain: "",
            technology: "",
            experienceLevel: "",
            manDays: "",
            onsiteDays: "",
          };
        });
        const next = all.length ? all : [emptyRoleRow()];
        setRoles(next);
        recomputeCriteriaFromSelection(next);
      }

      if (value === "SINGLE") {
        setRoles((prev) => {
          const first = prev?.[0] ? prev[0] : emptyRoleRow();
          const maxEmp = roleMaxEmployees(selectedProject, first.roleName);
          const clamped =
            first.employees === ""
              ? ""
              : String(clampInt(first.employees, 1, maxEmp ?? 999999));
          const next = [{ ...first, employees: clamped }];
          recomputeCriteriaFromSelection(next);
          return next;
        });
      }

      return;
    }

    setForm((p) => ({ ...p, [name]: value }));
  };

  const handleProjectSelect = (e) => {
    const projectId = e.target.value;
    const proj =
      projects.find((p) => String(p.projectId) === String(projectId)) || null;

    setSelectedProject(proj);

    const suggestedType = suggestTypeFromProject(proj);
    const typeNow = form.type || suggestedType;

    setForm((prev) => ({
      ...prev,
      projectId: proj?.projectId || "",
      projectName: proj?.projectDescription || "",
      title: titleTouchedRef.current
        ? prev.title
        : proj?.projectDescription || proj?.projectId || "",
      startDate: proj?.projectStart || prev.startDate,
      endDate: proj?.projectEnd || prev.endDate,
      taskDescription: proj?.taskDescription || prev.taskDescription,
      performanceLocation:
        prev.performanceLocation ||
        (proj?.selectedLocations?.[0] ? proj.selectedLocations[0] : ""),
      type: prev.type ? prev.type : suggestedType,
      furtherInformation:
        prev.furtherInformation ||
        (proj?.selectedSkills?.length
          ? `Nice to have skills: ${proj.selectedSkills.join(", ")}`
          : ""),
    }));

    if (typeNow === "TEAM") {
      const all = (proj?.roles || []).map((r) => {
        const maxEmp = roleMaxEmployees(proj, r.requiredRole);
        const base = r.numberOfEmployees || "1";
        const clamped = String(clampInt(base, 1, maxEmp ?? 999999));
        return {
          ...emptyRoleRow(),
          roleName: r.requiredRole,
          employees: clamped,
          requiredCompetencies: r.requiredCompetencies || [],
        };
      });
      const next = all.length ? all : [emptyRoleRow()];
      setRoles(next);
      recomputeCriteriaFromSelection(next);
    } else if (typeNow === "SINGLE") {
      const first = proj?.roles?.[0];
      const roleName = first?.requiredRole || "";
      const maxEmp = roleMaxEmployees(proj, roleName);
      const base = first?.numberOfEmployees || "1";
      const clamped = String(clampInt(base, 1, maxEmp ?? 999999));
      const next = [
        first
          ? {
              ...emptyRoleRow(),
              roleName,
              employees: clamped,
              requiredCompetencies: first.requiredCompetencies || [],
            }
          : emptyRoleRow(),
      ];
      setRoles(next);
      recomputeCriteriaFromSelection(next);
    } else {
      // MULTI
      const first = proj?.roles?.[0];
      const roleName = first?.requiredRole || "";
      const maxEmp = roleMaxEmployees(proj, roleName);
      const base = first?.numberOfEmployees || "1";
      const clamped = String(clampInt(base, 1, maxEmp ?? 999999));

      const next = [
        first
          ? {
              ...emptyRoleRow(),
              roleName,
              employees: clamped,
              requiredCompetencies: first.requiredCompetencies || [],
            }
          : emptyRoleRow(),
      ];
      setRoles(next);
      recomputeCriteriaFromSelection(next);
    }

    const skills = (proj?.selectedSkills || []).slice(0, 5);
    setNiceToHave((prev) => {
      const userTouched = prev.some((x) => safeStr(x));
      return userTouched
        ? prev
        : [
            skills[0] || "",
            skills[1] || "",
            skills[2] || "",
            skills[3] || "",
            skills[4] || "",
          ];
    });
  };

  const handleContractSelect = (e) => {
    const contractId = String(e.target.value || "").trim();
    const c = contracts.find((x) => String(x?.id) === contractId) || null;

    setSelectedContract(c);

    setForm((p) => ({
      ...p,
      contractId: c?.id ? String(c.id) : "",
      contractSupplier: c?.supplier || c?.title || "",
    }));
  };

  const setRoleAt = (index, patch) => {
    setRoles((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...patch };
      recomputeCriteriaFromSelection(next);
      return next;
    });
  };

  const addRoleRow = () => {
    if (form.type !== "MULTI") return;
    setRoles((prev) => {
      const next = [...prev, emptyRoleRow()];
      recomputeCriteriaFromSelection(next);
      return next;
    });
  };

  const removeRoleRow = (index) => {
    if (form.type !== "MULTI") return;
    setRoles((prev) => {
      const next =
        prev.length === 1 ? prev : prev.filter((_, i) => i !== index);
      recomputeCriteriaFromSelection(next);
      return next;
    });
  };

  const addLangRow = () => setLanguages((p) => [...p, emptyLangRow()]);
  const removeLangRow = (i) =>
    setLanguages((p) => (p.length === 1 ? p : p.filter((_, idx) => idx !== i)));
  const updateLangRow = (i, field, value) =>
    setLanguages((p) => {
      const next = [...p];
      next[i] = { ...next[i], [field]: value };
      return next;
    });

  const totalEmployees = useMemo(() => {
    const nums = roles
      .map((r) => Number(r.employees))
      .filter((n) => Number.isFinite(n));
    return nums.reduce((a, b) => a + b, 0);
  }, [roles]);

  /* ---------------- Build payload (your backend shape) ---------------- */
  const buildPayload = () => {
    const must = mustHave
      .map((x) => safeStr(x))
      .filter(Boolean)
      .slice(0, 3);
    const nice = niceToHave
      .map((x) => safeStr(x))
      .filter(Boolean)
      .slice(0, 5);

    return {
      title: safeStr(form.title),
      type: form.type,

      projectId: form.projectId || null,
      projectName: form.projectName || null,

      contractId: form.contractId || null,
      contractSupplier: form.contractSupplier || null,

      startDate: form.startDate || null,
      endDate: form.endDate || null,

      performanceLocation: form.performanceLocation || null,

      maxOffers: numOrNull(form.maxOffers),
      maxAcceptedOffers: numOrNull(form.maxAcceptedOffers),
      biddingCycleDays: Number(form.biddingCycleDays || 7),

      taskDescription: safeStr(form.taskDescription),
      furtherInformation: safeStr(form.furtherInformation),

      mustHaveCriteria: must,
      niceToHaveCriteria: nice,

      requiredLanguagesWithLevel: (languages || [])
        .map((l) => ({
          language: safeStr(l.language),
          level: safeStr(l.level) || "B2",
        }))
        .filter((x) => x.language),

      roles: (roles || [])
        .map((r) => ({
          roleName: safeStr(r.roleName) || null,
          requiredCompetencies: uniq(
            (r.requiredCompetencies || []).map((x) => safeStr(x)),
          ),
          numberOfEmployees: numOrNull(r.employees),
          domain: safeStr(r.domain) || null,
          technology: safeStr(r.technology) || null,
          experienceLevel: safeStr(r.experienceLevel) || null,
          manDays: numOrNull(r.manDays),
          onsiteDays: numOrNull(r.onsiteDays),
        }))
        .filter((x) => x.roleName),

      requiredEmployeesTotal: totalEmployees,
    };
  };

  /* ---------------- Submit ---------------- */
  const handleSubmit = async (e) => {
    e.preventDefault();
    setErr("");
    setInfo("");

    const payload = buildPayload();

    if (!payload.projectId) return setErr("Select a project first.");
    if (!payload.title) return setErr("Title is required.");
    if (!payload.roles?.length) return setErr("Select at least one role.");

    if (payload.type === "SINGLE" && payload.roles.length !== 1) {
      return setErr("SINGLE request must contain exactly 1 role.");
    }

    if (payload.type === "TEAM" && selectedProject?.roles?.length) {
      if (payload.roles.length !== selectedProject.roles.length) {
        return setErr("TEAM request must include all project roles.");
      }
    }

    // ✅ enforce role max employees from project
    for (const rr of payload.roles || []) {
      const maxEmp = roleMaxEmployees(selectedProject, rr.roleName);
      const entered = Number(rr.numberOfEmployees);
      if (maxEmp && Number.isFinite(entered) && entered > maxEmp) {
        return setErr(
          `Employees for role "${rr.roleName}" cannot exceed ${maxEmp} (project limit).`,
        );
      }
      if (Number.isFinite(entered) && entered < 1) {
        return setErr(
          `Employees for role "${rr.roleName}" must be at least 1.`,
        );
      }
    }

    if (mode === "edit") {
      if (!onSubmit) return setErr("Missing onSubmit handler for edit mode");
      await onSubmit(payload);
      return;
    }

    if (savingLocalRef.current) return;
    savingLocalRef.current = true;
    setSavingLocal(true);

    const t = toast.loading("Creating request...");

    try {
      await apiPost("/requests", payload, { headers: authHeaders });
      toast.success("Request created", { id: t });
      setInfo("Request created successfully!");
      onCreated?.();
    } catch (e2) {
      const msg =
        e2?.response?.data?.error || e2?.message || "Failed to create request";
      toast.error(msg, { id: t });
      setErr(msg);
    } finally {
      setSavingLocal(false);
      savingLocalRef.current = false;
      toast.dismiss(t);
    }
  };

  /* =========================
     UI
  ========================= */
  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4 sm:p-6 space-y-5"
    >
      {/* header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-sm font-semibold text-slate-100">
            {mode === "edit"
              ? "Edit Service Request"
              : "Create Service Request"}
          </h2>
          <p className="text-[11px] text-slate-400">
            Select a project → roles & criteria auto-fill. Adjust only what you
            need.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {refLoading && (
            <span className="text-[11px] text-slate-400">
              Loading reference data…
            </span>
          )}
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="text-xs px-3 py-2 rounded-xl border border-slate-700 hover:bg-slate-800"
          >
            Reload
          </button>
        </div>
      </div>

      {err && (
        <div className="rounded-xl border border-red-700/40 bg-red-950/40 px-4 py-2 text-sm text-red-200">
          {err}
        </div>
      )}
      {info && (
        <div className="rounded-xl border border-emerald-700/40 bg-emerald-950/30 px-4 py-2 text-sm text-emerald-200">
          {info}
        </div>
      )}

      {/* Project + Type + Title */}
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <label className="text-xs text-slate-300">Project (required)</label>
          <select
            value={form.projectId || ""}
            onChange={handleProjectSelect}
            disabled={refLoading}
            className="mt-1 w-full border border-slate-700 rounded-xl px-3 py-2 bg-slate-950/40 disabled:opacity-60"
            required
          >
            <option value="">
              {refLoading ? "Loading projects..." : "-- Select project --"}
            </option>
            {projects.map((p) => (
              <option key={p.projectId} value={p.projectId}>
                {p.projectId} – {p.projectDescription}
              </option>
            ))}
          </select>

          {selectedProject?.links ? (
            <p className="mt-2 text-[11px] text-slate-500 break-all">
              Project link:{" "}
              <span className="text-slate-300">{selectedProject.links}</span>
            </p>
          ) : null}
        </div>

        <div className="lg:col-span-1">
          <label className="text-xs text-slate-300">Request Type</label>
          <select
            name="type"
            value={form.type}
            onChange={handleBasicChange}
            className="mt-1 w-full border border-slate-700 rounded-xl px-3 py-2 bg-slate-950/40"
          >
            <option value="SINGLE">Single (exactly 1 role)</option>
            <option value="MULTI">Multi (multiple roles)</option>
            <option value="TEAM">Team (all project roles)</option>
          </select>

          <div className="mt-2 rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2">
            <p className="text-[11px] text-slate-500">
              Total employees (selected)
            </p>
            <p className="text-sm font-semibold text-slate-100">
              {totalEmployees || "—"}
            </p>
          </div>
        </div>

        <div className="lg:col-span-1">
          <label className="text-xs text-slate-300">Title</label>
          <input
            type="text"
            name="title"
            value={form.title}
            onChange={handleBasicChange}
            className="mt-1 w-full border border-slate-700 rounded-xl px-3 py-2 bg-slate-950/40"
            placeholder="Auto-filled from project"
            required
          />
        </div>
      </div>

      {/* Contract (optional) + Dates + Location */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-4">
        <div>
          <label className="text-xs text-slate-300">Contract (optional)</label>
          <select
            value={form.contractId || ""}
            onChange={handleContractSelect}
            disabled={refLoading}
            className="mt-1 w-full border border-slate-700 rounded-xl px-3 py-2 bg-slate-950/40 disabled:opacity-60"
          >
            <option value="">
              {refLoading ? "Loading contracts..." : "-- Select contract --"}
            </option>
            {contracts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.supplier || "Provider"} – {c.title || "Contract"} (
                {c.domain || "Type"})
              </option>
            ))}
          </select>
          {selectedContract?.title ? (
            <p className="mt-1 text-[11px] text-slate-500 truncate">
              {selectedContract.title}
            </p>
          ) : null}
        </div>

        <div>
          <label className="text-xs text-slate-300">Start Date</label>
          <input
            type="date"
            name="startDate"
            value={form.startDate || ""}
            onChange={handleBasicChange}
            className="mt-1 w-full border border-slate-700 rounded-xl px-3 py-2 bg-slate-950/40"
          />
        </div>

        <div>
          <label className="text-xs text-slate-300">End Date</label>
          <input
            type="date"
            name="endDate"
            value={form.endDate || ""}
            onChange={handleBasicChange}
            className="mt-1 w-full border border-slate-700 rounded-xl px-3 py-2 bg-slate-950/40"
          />
        </div>

        <div>
          <label className="text-xs text-slate-300">Performance Location</label>
          {locationOptions?.length ? (
            <select
              name="performanceLocation"
              value={form.performanceLocation || ""}
              onChange={handleBasicChange}
              className="mt-1 w-full border border-slate-700 rounded-xl px-3 py-2 bg-slate-950/40"
            >
              <option value="">-- Select location --</option>
              {locationOptions.map((loc) => (
                <option key={loc} value={loc}>
                  {loc}
                </option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              name="performanceLocation"
              value={form.performanceLocation || ""}
              onChange={handleBasicChange}
              className="mt-1 w-full border border-slate-700 rounded-xl px-3 py-2 bg-slate-950/40"
              placeholder="e.g. Frankfurt / Berlin"
            />
          )}
        </div>
      </div>

      {/* Offers + bidding */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-4">
        <div>
          <label className="text-xs text-slate-300">
            Max Offers from Provider
          </label>
          <input
            type="number"
            name="maxOffers"
            value={form.maxOffers}
            onChange={handleBasicChange}
            className="mt-1 w-full border border-slate-700 rounded-xl px-3 py-2 bg-slate-950/40"
            placeholder="e.g. 4"
          />
        </div>

        <div>
          <label className="text-xs text-slate-300">Max Accepted Offers</label>
          <input
            type="number"
            name="maxAcceptedOffers"
            value={form.maxAcceptedOffers}
            onChange={handleBasicChange}
            className="mt-1 w-full border border-slate-700 rounded-xl px-3 py-2 bg-slate-950/40"
            placeholder="e.g. 1"
          />
        </div>

        <div>
          <label className="text-xs text-slate-300">Bidding Cycle (days)</label>
          <select
            name="biddingCycleDays"
            value={form.biddingCycleDays}
            onChange={handleBasicChange}
            className="mt-1 w-full border border-slate-700 rounded-xl px-3 py-2 bg-slate-950/40"
          >
            {[0, 1, 3, 7, 14, 21, 30].map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-950/30 p-3">
          <p className="text-[11px] text-slate-500">
            Project required employees
          </p>
          <p className="text-sm font-semibold text-slate-100">
            {selectedProject?.requiredEmployees || "—"}
          </p>
        </div>
      </div>

      {/* ROLES (from project) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <h3 className="text-sm font-semibold text-slate-100">
              Roles (from Project)
            </h3>
            <p className="text-xs text-slate-500">
              SINGLE = one role, MULTI = multiple roles, TEAM = auto all roles.
            </p>
          </div>

          {form.type === "MULTI" && (
            <button
              type="button"
              onClick={addRoleRow}
              className="text-xs px-3 py-2 rounded-xl border border-slate-700 hover:bg-slate-800"
              disabled={!selectedProject}
            >
              + Add Role
            </button>
          )}
        </div>

        <div className="space-y-3">
          {roles.map((r, idx) => {
            const maxEmp = roleMaxEmployees(selectedProject, r.roleName);

            return (
              <div
                key={idx}
                className="rounded-2xl border border-slate-800 bg-slate-950/30 p-3"
              >
                <div className="grid gap-3 grid-cols-1 md:grid-cols-4">
                  <div className="md:col-span-2">
                    <label className="text-[11px] text-slate-400">Role</label>
                    <select
                      value={r.roleName}
                      onChange={(e) => {
                        const roleName = e.target.value;
                        const opt = projectRoleOptions.find(
                          (x) => x.value === roleName,
                        );

                        const maxE = roleMaxEmployees(
                          selectedProject,
                          roleName,
                        );
                        const base =
                          opt?.defaultEmployees || r.employees || "1";
                        const clamped =
                          base === ""
                            ? ""
                            : String(clampInt(base, 1, maxE ?? 999999));

                        setRoleAt(idx, {
                          roleName,
                          requiredCompetencies: opt?.requiredCompetencies || [],
                          employees: clamped,
                        });
                      }}
                      disabled={!selectedProject || form.type === "TEAM"}
                      className="mt-1 w-full border border-slate-700 rounded-xl px-3 py-2 bg-slate-950/40 disabled:opacity-60"
                    >
                      <option value="">
                        {selectedProject
                          ? "-- Select role --"
                          : "Select project first"}
                      </option>
                      {projectRoleOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>

                    {!!r.requiredCompetencies?.length && (
                      <p className="mt-2 text-[11px] text-slate-500">
                        Required competencies:{" "}
                        <span className="text-slate-300">
                          {r.requiredCompetencies.join(", ")}
                        </span>
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="text-[11px] text-slate-400">
                      Employees for this role
                    </label>
                    <input
                      type="number"
                      value={r.employees}
                      min={1}
                      max={maxEmp ?? undefined}
                      disabled={
                        !selectedProject || form.type === "TEAM" || !r.roleName
                      }
                      onChange={(e) => {
                        const raw = e.target.value;

                        if (raw === "") {
                          setRoleAt(idx, { employees: "" });
                          return;
                        }

                        const clamped = clampInt(raw, 1, maxEmp ?? 999999);
                        setRoleAt(idx, { employees: String(clamped) });
                      }}
                      className="mt-1 w-full border border-slate-700 rounded-xl px-3 py-2 bg-slate-950/40 disabled:opacity-60"
                    />

                    {maxEmp ? (
                      <p className="mt-1 text-[11px] text-slate-500">
                        Max allowed:{" "}
                        <span className="text-slate-200 font-semibold">
                          {maxEmp}
                        </span>
                      </p>
                    ) : r.roleName ? (
                      <p className="mt-1 text-[11px] text-slate-500">
                        Max allowed: —
                      </p>
                    ) : null}
                  </div>

                  <div className="flex items-end justify-end gap-2">
                    {form.type === "MULTI" && roles.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeRoleRow(idx)}
                        className="text-xs px-3 py-2 rounded-xl border border-slate-700 hover:bg-slate-800 text-red-300"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Criteria: must + nice */}
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-800 bg-slate-950/30 p-3">
          <p className="text-sm font-semibold text-slate-100">
            Must-have (auto from competencies)
          </p>
          <p className="text-xs text-slate-500">Max 3</p>
          <div className="mt-3 space-y-2">
            {mustHave.map((v, i) => (
              <input
                key={i}
                value={v}
                onChange={(e) =>
                  setMustHave((p) => {
                    const n = [...p];
                    n[i] = e.target.value;
                    return n;
                  })
                }
                className="w-full border border-slate-700 rounded-xl px-3 py-2 bg-slate-950/40"
                placeholder="Must-have criterion"
              />
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-950/30 p-3">
          <p className="text-sm font-semibold text-slate-100">
            Nice-to-have (auto from skills)
          </p>
          <p className="text-xs text-slate-500">Max 5</p>
          <div className="mt-3 space-y-2">
            {niceToHave.map((v, i) => (
              <input
                key={i}
                value={v}
                onChange={(e) =>
                  setNiceToHave((p) => {
                    const n = [...p];
                    n[i] = e.target.value;
                    return n;
                  })
                }
                className="w-full border border-slate-700 rounded-xl px-3 py-2 bg-slate-950/40"
                placeholder="Nice-to-have criterion"
              />
            ))}
          </div>
        </div>
      </div>

      {/* Languages */}
      <div className="rounded-2xl border border-slate-800 bg-slate-950/30 p-3 space-y-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <p className="text-sm font-semibold text-slate-100">
              Required Languages
            </p>
            <p className="text-xs text-slate-500">
              Language with level (A1..C2 / Native)
            </p>
          </div>
          <button
            type="button"
            onClick={addLangRow}
            className="text-xs px-3 py-2 rounded-xl border border-slate-700 hover:bg-slate-800"
          >
            + Add Language
          </button>
        </div>

        <div className="space-y-2">
          {languages.map((l, i) => (
            <div
              key={i}
              className="grid gap-2 grid-cols-1 sm:grid-cols-3 items-end"
            >
              <div className="sm:col-span-2">
                <label className="text-[11px] text-slate-400">Language</label>
                <input
                  value={l.language}
                  onChange={(e) => updateLangRow(i, "language", e.target.value)}
                  className="mt-1 w-full border border-slate-700 rounded-xl px-3 py-2 bg-slate-950/40"
                  placeholder="e.g. English"
                />
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="text-[11px] text-slate-400">Level</label>
                  <select
                    value={l.level}
                    onChange={(e) => updateLangRow(i, "level", e.target.value)}
                    className="mt-1 w-full border border-slate-700 rounded-xl px-3 py-2 bg-slate-950/40"
                  >
                    {["A1", "A2", "B1", "B2", "C1", "C2", "Native"].map((x) => (
                      <option key={x} value={x}>
                        {x}
                      </option>
                    ))}
                  </select>
                </div>
                {languages.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeLangRow(i)}
                    className="px-3 py-2 rounded-xl border border-slate-700 hover:bg-slate-800 text-xs text-red-300"
                    title="Remove"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Descriptions */}
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
        <div>
          <label className="text-xs text-slate-300">Task Description</label>
          <textarea
            name="taskDescription"
            value={form.taskDescription}
            onChange={(e) =>
              setForm((p) => ({ ...p, taskDescription: e.target.value }))
            }
            rows={6}
            className="mt-1 w-full border border-slate-700 rounded-xl px-3 py-2 bg-slate-950/40"
            placeholder="Auto-filled from project. You can refine it."
          />
        </div>

        <div>
          <label className="text-xs text-slate-300">Further Information</label>
          <textarea
            name="furtherInformation"
            value={form.furtherInformation}
            onChange={(e) =>
              setForm((p) => ({ ...p, furtherInformation: e.target.value }))
            }
            rows={6}
            className="mt-1 w-full border border-slate-700 rounded-xl px-3 py-2 bg-slate-950/40"
            placeholder="Extra notes, constraints, context, links..."
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-5 py-2 rounded-xl bg-slate-900 text-slate-100 border border-slate-700 hover:bg-slate-800"
          >
            Cancel
          </button>
        )}

        <button
          type="submit"
          disabled={saving}
          className="px-5 py-2 rounded-xl bg-emerald-500 text-black font-semibold hover:bg-emerald-400 disabled:opacity-60"
        >
          {saving
            ? "Saving..."
            : mode === "edit"
              ? "Update Draft"
              : "Create Request"}
        </button>
      </div>
    </form>
  );
}
