// components/ServiceRequestForm.jsx
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

function extractArrayMaybe(x) {
  if (Array.isArray(x)) return x;
  if (Array.isArray(x?.data)) return x.data;
  if (Array.isArray(x?.items)) return x.items;
  return [];
}

/* =========================
   Project Normalizer
========================= */
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

/* =========================
   Contracts Normalizer
========================= */
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
   Multi-level Role Helpers
========================= */
const LEVEL_OPTIONS = ["Junior", "Mid", "Senior", "Lead", "Architect"];

function emptyLevelRow() {
  return {
    level: "Senior",
    employees: "1",
    expertise: [],
    manDays: "",
    onsiteDays: "",
    workingHoursPerDay: "8",
    salaryPerHour: "",
  };
}

function emptyRoleRow() {
  return {
    roleName: "",
    requiredCompetencies: [],
    domain: "",
    technology: "",
    experienceLevel: "", // kept for backward compatibility (optional)
    levels: [emptyLevelRow()],
  };
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

  // ✅ request-level requirements (renamed concept)
  const [requirementsMustHave, setRequirementsMustHave] = useState([
    "",
    "",
    "",
  ]); // max 3
  const [requirementsNiceToHave, setRequirementsNiceToHave] = useState([
    "",
    "",
    "",
    "",
    "",
  ]); // max 5

  const emptyLangRow = useCallback(() => ({ language: "", level: "B2" }), []);
  const [languages, setLanguages] = useState([emptyLangRow()]);

  const [roles, setRoles] = useState([emptyRoleRow()]);

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

    // requirements (renamed)
    setRequirementsMustHave([
      initialRequest.mustHaveCriteria?.[0] || "",
      initialRequest.mustHaveCriteria?.[1] || "",
      initialRequest.mustHaveCriteria?.[2] || "",
    ]);

    setRequirementsNiceToHave([
      initialRequest.niceToHaveCriteria?.[0] || "",
      initialRequest.niceToHaveCriteria?.[1] || "",
      initialRequest.niceToHaveCriteria?.[2] || "",
      initialRequest.niceToHaveCriteria?.[3] || "",
      initialRequest.niceToHaveCriteria?.[4] || "",
    ]);

    // roles (supports BOTH old and new shape)
    const incomingRoles =
      Array.isArray(initialRequest.roles) && initialRequest.roles.length
        ? initialRequest.roles
        : [emptyRoleRow()];

    const normalizedRoles = incomingRoles.map((r) => {
      const hasLevels = Array.isArray(r.levels) && r.levels.length;

      // legacy single-level fields -> convert to one level row
      const legacyLevel = {
        level: safeStr(r.experienceLevel) || "Senior",
        employees:
          r.numberOfEmployees != null ? String(r.numberOfEmployees) : "1",
        expertise: Array.isArray(r.expertise) ? r.expertise : [],
        manDays: r.manDays ?? "",
        onsiteDays: r.onsiteDays ?? "",
        workingHoursPerDay: r.workingHoursPerDay ?? "8",
        salaryPerHour: r.salaryPerHour ?? "",
      };

      const levels = hasLevels
        ? r.levels.map((lv) => ({
            level: safeStr(lv.level) || "Senior",
            employees:
              lv.employees != null
                ? String(lv.employees)
                : lv.count != null
                  ? String(lv.count)
                  : "0",
            expertise: Array.isArray(lv.expertise)
              ? lv.expertise
              : Array.isArray(lv.skills)
                ? lv.skills
                : [],
            manDays: lv.manDays ?? "",
            onsiteDays: lv.onsiteDays ?? "",
            workingHoursPerDay: lv.workingHoursPerDay ?? "8",
            salaryPerHour: lv.salaryPerHour ?? "",
          }))
        : [legacyLevel];

      return {
        ...emptyRoleRow(),
        roleName: r.roleName || "",
        requiredCompetencies: Array.isArray(r.requiredCompetencies)
          ? r.requiredCompetencies
          : [],
        domain: r.domain || "",
        technology: r.technology || "",
        experienceLevel: r.experienceLevel || "",
        levels: levels.length ? levels : [emptyLevelRow()],
      };
    });

    setRoles(normalizedRoles);

    // languages
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
  }, [mode, initialRequest, emptyLangRow]);

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

  /* ---------------- Criteria auto-fill ---------------- */
  const recomputeRequirementsFromSelection = useCallback(
    (nextRoles) => {
      // Must-have requirements: from required competencies of selected roles
      const comp = uniq(
        (nextRoles || [])
          .flatMap((rr) => rr.requiredCompetencies || [])
          .map((x) => safeStr(x)),
      ).slice(0, 3);

      setRequirementsMustHave((prev) => {
        const userTouched = prev.some((x) => safeStr(x));
        return userTouched
          ? prev
          : [comp[0] || "", comp[1] || "", comp[2] || ""];
      });

      // Nice-to-have requirements: from project selected skills
      const skills = (selectedProject?.selectedSkills || []).slice(0, 5);
      setRequirementsNiceToHave((prev) => {
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
          const total = String(clampInt(base, 1, maxEmp ?? 999999));

          return {
            ...emptyRoleRow(),
            roleName: opt.value,
            requiredCompetencies: opt.requiredCompetencies || [],
            levels: [
              {
                ...emptyLevelRow(),
                level: "Senior",
                employees: total,
              },
            ],
          };
        });

        const next = all.length ? all : [emptyRoleRow()];
        setRoles(next);
        recomputeRequirementsFromSelection(next);
      }

      if (value === "SINGLE") {
        setRoles((prev) => {
          const first = prev?.[0] ? prev[0] : emptyRoleRow();
          const maxEmp = roleMaxEmployees(selectedProject, first.roleName);

          // keep role but clamp employees by summing levels
          const sum = (first.levels || [])
            .map((lv) => Number(lv.employees))
            .filter((n) => Number.isFinite(n))
            .reduce((a, b) => a + b, 0);

          const clampedSum = maxEmp ? Math.min(sum || 1, maxEmp) : sum || 1;

          const next = [
            {
              ...first,
              levels: [
                {
                  ...emptyLevelRow(),
                  ...(first.levels?.[0] || {}),
                  employees: String(clampedSum),
                },
              ],
            },
          ];

          recomputeRequirementsFromSelection(next);
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

    // Build roles based on project type
    if (typeNow === "TEAM") {
      const all = (proj?.roles || []).map((r) => {
        const maxEmp = roleMaxEmployees(proj, r.requiredRole);
        const base = r.numberOfEmployees || "1";
        const total = String(clampInt(base, 1, maxEmp ?? 999999));

        return {
          ...emptyRoleRow(),
          roleName: r.requiredRole,
          requiredCompetencies: r.requiredCompetencies || [],
          levels: [
            {
              ...emptyLevelRow(),
              level: "Senior",
              employees: total,
            },
          ],
        };
      });

      const next = all.length ? all : [emptyRoleRow()];
      setRoles(next);
      recomputeRequirementsFromSelection(next);
    } else {
      // SINGLE or MULTI starts with first project role
      const first = proj?.roles?.[0];
      const roleName = first?.requiredRole || "";
      const maxEmp = roleMaxEmployees(proj, roleName);
      const base = first?.numberOfEmployees || "1";
      const total = String(clampInt(base, 1, maxEmp ?? 999999));

      const next = [
        first
          ? {
              ...emptyRoleRow(),
              roleName,
              requiredCompetencies: first.requiredCompetencies || [],
              levels: [
                {
                  ...emptyLevelRow(),
                  level: "Senior",
                  employees: total,
                },
              ],
            }
          : emptyRoleRow(),
      ];

      setRoles(next);
      recomputeRequirementsFromSelection(next);
    }

    // auto-fill nice-to-have requirements (if untouched)
    const skills = (proj?.selectedSkills || []).slice(0, 5);
    setRequirementsNiceToHave((prev) => {
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
      recomputeRequirementsFromSelection(next);
      return next;
    });
  };

  const addRoleRow = () => {
    if (form.type !== "MULTI") return;
    setRoles((prev) => {
      const next = [...prev, emptyRoleRow()];
      recomputeRequirementsFromSelection(next);
      return next;
    });
  };

  const removeRoleRow = (index) => {
    if (form.type !== "MULTI") return;
    setRoles((prev) => {
      const next =
        prev.length === 1 ? prev : prev.filter((_, i) => i !== index);
      recomputeRequirementsFromSelection(next);
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

  const totalEmployeesSelected = useMemo(() => {
    const sum = roles
      .flatMap((r) => r.levels || [])
      .map((lv) => Number(lv.employees))
      .filter((n) => Number.isFinite(n))
      .reduce((a, b) => a + b, 0);
    return sum;
  }, [roles]);

  const totalEstimatedCost = useMemo(() => {
    // Simple estimation: salaryPerHour * hours/day * manDays * employees
    // (assumes manDays is per employee for that level)
    let total = 0;

    for (const role of roles || []) {
      for (const lv of role.levels || []) {
        const emp = Number(lv.employees);
        const manDays = Number(lv.manDays);
        const hrs = Number(lv.workingHoursPerDay);
        const salary = Number(lv.salaryPerHour);

        if (
          Number.isFinite(emp) &&
          Number.isFinite(manDays) &&
          Number.isFinite(hrs) &&
          Number.isFinite(salary)
        ) {
          total += emp * manDays * hrs * salary;
        }
      }
    }

    return Number.isFinite(total) ? total : 0;
  }, [roles]);

  /* ---------------- Build payload (backend shape) ---------------- */
  const buildPayload = () => {
    const must = requirementsMustHave
      .map((x) => safeStr(x))
      .filter(Boolean)
      .slice(0, 3);

    const nice = requirementsNiceToHave
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

      // ✅ renamed concept but keep keys for backend compatibility
      mustHaveCriteria: must,
      niceToHaveCriteria: nice,

      requiredLanguagesWithLevel: (languages || [])
        .map((l) => ({
          language: safeStr(l.language),
          level: safeStr(l.level) || "B2",
        }))
        .filter((x) => x.language),

      // ✅ multi-level roles
      roles: (roles || [])
        .map((r) => ({
          roleName: safeStr(r.roleName) || null,
          requiredCompetencies: uniq(
            (r.requiredCompetencies || []).map((x) => safeStr(x)),
          ),
          domain: safeStr(r.domain) || null,
          technology: safeStr(r.technology) || null,

          levels: (r.levels || []).map((lv) => ({
            level: safeStr(lv.level) || "Senior",
            employees: numOrNull(lv.employees) ?? 0,
            expertise: uniq((lv.expertise || []).map((x) => safeStr(x))).filter(
              Boolean,
            ),
            manDays: numOrNull(lv.manDays),
            onsiteDays: numOrNull(lv.onsiteDays),
            workingHoursPerDay: numOrNull(lv.workingHoursPerDay),
            salaryPerHour: numOrNull(lv.salaryPerHour),
          })),
        }))
        .filter((x) => x.roleName),

      requiredEmployeesTotal: totalEmployeesSelected,
      estimatedTotalCost: totalEstimatedCost || 0,
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

    // ✅ per-role employees must match project limit (if known)
    for (const role of payload.roles || []) {
      const maxEmp = roleMaxEmployees(selectedProject, role.roleName);
      const sum = (role.levels || [])
        .map((lv) => Number(lv.employees))
        .filter((n) => Number.isFinite(n))
        .reduce((a, b) => a + b, 0);

      if (maxEmp && sum > maxEmp) {
        return setErr(
          `Role "${role.roleName}" exceeds project limit. Selected=${sum}, Max=${maxEmp}`,
        );
      }

      // You asked: "If employees > 1, PM can split by experience levels"
      // ✅ enforce that the sum is >= 1 (if role selected)
      if (sum < 1) {
        return setErr(
          `Role "${role.roleName}" must have at least 1 employee in total (across levels).`,
        );
      }

      // ✅ validate level fields
      for (const lv of role.levels || []) {
        const emp = Number(lv.employees);
        if (!Number.isFinite(emp) || emp < 0) {
          return setErr(
            `Invalid employees for "${role.roleName}" level "${lv.level}".`,
          );
        }

        const h = Number(lv.workingHoursPerDay);
        if (Number.isFinite(h) && (h < 1 || h > 24)) {
          return setErr(
            `Hours/day for "${role.roleName}" level "${lv.level}" must be 1..24.`,
          );
        }

        const s = Number(lv.salaryPerHour);
        if (Number.isFinite(s) && s < 0) {
          return setErr(
            `Salary/hour for "${role.roleName}" level "${lv.level}" cannot be negative.`,
          );
        }

        const md = Number(lv.manDays);
        if (Number.isFinite(md) && md < 0) {
          return setErr(
            `Man days for "${role.roleName}" level "${lv.level}" cannot be negative.`,
          );
        }

        const od = Number(lv.onsiteDays);
        if (Number.isFinite(od) && od < 0) {
          return setErr(
            `Onsite days for "${role.roleName}" level "${lv.level}" cannot be negative.`,
          );
        }
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
            Select a project → roles & requirements auto-fill. Split employees
            by experience level with different costs.
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

          <div className="mt-2 grid grid-cols-2 gap-2">
            <div className="rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2">
              <p className="text-[11px] text-slate-500">Employees (total)</p>
              <p className="text-sm font-semibold text-slate-100">
                {totalEmployeesSelected || "—"}
              </p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2">
              <p className="text-[11px] text-slate-500">Est. Cost (€)</p>
              <p className="text-sm font-semibold text-slate-100">
                {totalEstimatedCost
                  ? Math.round(totalEstimatedCost).toLocaleString()
                  : "—"}
              </p>
            </div>
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

      {/* ROLES */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <h3 className="text-sm font-semibold text-slate-100">
              Roles (multi-level workforce)
            </h3>
            <p className="text-xs text-slate-500">
              For each role, split employees by experience level. Each level can
              have different salary, hours/day, man days, onsite days,
              expertise.
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

            const sumRoleEmployees = (r.levels || [])
              .map((lv) => Number(lv.employees))
              .filter((n) => Number.isFinite(n))
              .reduce((a, b) => a + b, 0);

            return (
              <div
                key={idx}
                className="rounded-2xl border border-slate-800 bg-slate-950/30 p-3 space-y-3"
              >
                {/* Role row header */}
                <div className="grid gap-3 grid-cols-1 md:grid-cols-4 items-end">
                  <div className="md:col-span-2">
                    <label className="text-[11px] text-slate-400">Role</label>
                    <select
                      value={r.roleName}
                      onChange={(e) => {
                        const roleName = e.target.value;
                        const opt = projectRoleOptions.find(
                          (x) => x.value === roleName,
                        );

                        // If role changes, we keep levels but set competencies
                        const nextLevels = r.levels?.length
                          ? r.levels
                          : [emptyLevelRow()];

                        setRoleAt(idx, {
                          roleName,
                          requiredCompetencies: opt?.requiredCompetencies || [],
                          levels: nextLevels,
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
                        Role competencies:{" "}
                        <span className="text-slate-300">
                          {r.requiredCompetencies.join(", ")}
                        </span>
                      </p>
                    )}
                  </div>

                  <div className="rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2">
                    <p className="text-[11px] text-slate-500">
                      Employees (sum of levels)
                    </p>
                    <p className="text-sm font-semibold text-slate-100">
                      {sumRoleEmployees || "—"}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Max allowed:{" "}
                      <span className="text-slate-200 font-semibold">
                        {maxEmp ?? "—"}
                      </span>
                    </p>
                  </div>

                  <div className="flex justify-end">
                    {form.type === "MULTI" && roles.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeRoleRow(idx)}
                        className="text-xs px-3 py-2 rounded-xl border border-slate-700 hover:bg-slate-800 text-red-300"
                      >
                        Remove Role
                      </button>
                    )}
                  </div>
                </div>

                {/* Levels editor */}
                <div className="rounded-xl border border-slate-800 bg-slate-950/30 p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div>
                      <p className="text-xs font-semibold text-slate-100">
                        Experience levels for this role
                      </p>
                      <p className="text-[11px] text-slate-500">
                        Employees can be split across levels with different cost
                        and effort.
                      </p>
                    </div>

                    <button
                      type="button"
                      disabled={!r.roleName || form.type === "TEAM"}
                      onClick={() => {
                        const next = [...(r.levels || [])];
                        next.push({
                          ...emptyLevelRow(),
                          level: "Mid",
                          employees: "0",
                        });
                        setRoleAt(idx, { levels: next });
                      }}
                      className="text-xs px-3 py-2 rounded-xl border border-slate-700 hover:bg-slate-800 disabled:opacity-60"
                    >
                      + Add Level
                    </button>
                  </div>

                  <div className="space-y-3">
                    {(r.levels || []).map((lv, li) => (
                      <div
                        key={li}
                        className="grid gap-2 grid-cols-1 md:grid-cols-8 rounded-xl border border-slate-800 p-2"
                      >
                        {/* Level */}
                        <div className="md:col-span-1">
                          <label className="text-[11px] text-slate-400">
                            Level
                          </label>
                          <select
                            value={lv.level}
                            disabled={!r.roleName}
                            onChange={(e) => {
                              const next = [...r.levels];
                              next[li] = { ...next[li], level: e.target.value };
                              setRoleAt(idx, { levels: next });
                            }}
                            className="mt-1 w-full border border-slate-700 rounded-lg px-2 py-1 bg-slate-950/40 disabled:opacity-60"
                          >
                            {LEVEL_OPTIONS.map((x) => (
                              <option key={x} value={x}>
                                {x}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Employees */}
                        <div className="md:col-span-1">
                          <label className="text-[11px] text-slate-400">
                            Employees
                          </label>
                          <input
                            type="number"
                            min={0}
                            disabled={!r.roleName || form.type === "TEAM"}
                            value={lv.employees}
                            onChange={(e) => {
                              const raw = e.target.value;
                              const next = [...r.levels];
                              next[li] = { ...next[li], employees: raw };
                              setRoleAt(idx, { levels: next });
                            }}
                            className="mt-1 w-full border border-slate-700 rounded-lg px-2 py-1 bg-slate-950/40 disabled:opacity-60"
                          />
                        </div>

                        {/* Expertise */}
                        <div className="md:col-span-2">
                          <label className="text-[11px] text-slate-400">
                            Expertise (comma separated)
                          </label>

                          <input
                            value={lv.expertiseText ?? ""}
                            disabled={!r.roleName}
                            onChange={(e) => {
                              const text = e.target.value;

                              // ✅ ALWAYS keep what the user typed (so comma/space never "disappears")
                              const next = [...r.levels];
                              next[li] = { ...next[li], expertiseText: text };

                              // ✅ ALSO maintain parsed array (non-destructive)
                              const list = text
                                .split(/[,\n]+/)
                                .map((s) => s.trim())
                                .filter(Boolean);

                              next[li].expertise = Array.from(new Set(list));

                              setRoleAt(idx, { levels: next });
                            }}
                            onKeyDown={(e) => {
                              // optional: allow Enter to separate items without submitting the whole form
                              if (e.key === "Enter") {
                                e.preventDefault();
                                const text = (lv.expertiseText ?? "") + "\n";
                                const next = [...r.levels];
                                next[li] = { ...next[li], expertiseText: text };
                                setRoleAt(idx, { levels: next });
                              }
                            }}
                            className="mt-1 w-full border border-slate-700 rounded-xl px-3 py-2 bg-slate-950/40 disabled:opacity-60"
                            placeholder="e.g. React, Next.js, Node"
                          />

                          {/* optional: show parsed tags preview */}
                          {!!(lv.expertise || []).length && (
                            <p className="mt-1 text-[10px] text-slate-500">
                              Parsed:{" "}
                              <span className="text-slate-200">
                                {(lv.expertise || []).join(", ")}
                              </span>
                            </p>
                          )}
                        </div>

                        {/* Man Days */}
                        <div className="md:col-span-1">
                          <label className="text-[11px] text-slate-400">
                            Man Days
                          </label>
                          <input
                            type="number"
                            min={0}
                            disabled={!r.roleName}
                            value={lv.manDays}
                            onChange={(e) => {
                              const next = [...r.levels];
                              next[li] = {
                                ...next[li],
                                manDays: e.target.value,
                              };
                              setRoleAt(idx, { levels: next });
                            }}
                            className="mt-1 w-full border border-slate-700 rounded-lg px-2 py-1 bg-slate-950/40 disabled:opacity-60"
                            placeholder="e.g. 45"
                          />
                        </div>

                        {/* Onsite Days */}
                        <div className="md:col-span-1">
                          <label className="text-[11px] text-slate-400">
                            Onsite Days
                          </label>
                          <input
                            type="number"
                            min={0}
                            disabled={!r.roleName}
                            value={lv.onsiteDays}
                            onChange={(e) => {
                              const next = [...r.levels];
                              next[li] = {
                                ...next[li],
                                onsiteDays: e.target.value,
                              };
                              setRoleAt(idx, { levels: next });
                            }}
                            className="mt-1 w-full border border-slate-700 rounded-lg px-2 py-1 bg-slate-950/40 disabled:opacity-60"
                            placeholder="e.g. 25"
                          />
                        </div>

                        {/* Hours/day */}
                        <div className="md:col-span-1">
                          <label className="text-[11px] text-slate-400">
                            Hours/Day
                          </label>
                          <input
                            type="number"
                            min={1}
                            max={24}
                            disabled={!r.roleName}
                            value={lv.workingHoursPerDay}
                            onChange={(e) => {
                              const next = [...r.levels];
                              next[li] = {
                                ...next[li],
                                workingHoursPerDay: e.target.value,
                              };
                              setRoleAt(idx, { levels: next });
                            }}
                            className="mt-1 w-full border border-slate-700 rounded-lg px-2 py-1 bg-slate-950/40 disabled:opacity-60"
                            placeholder="8"
                          />
                        </div>

                        {/* Salary/hour */}
                        <div className="md:col-span-1">
                          <label className="text-[11px] text-slate-400">
                            €/Hour
                          </label>
                          <input
                            type="number"
                            min={0}
                            step="0.5"
                            disabled={!r.roleName}
                            value={lv.salaryPerHour}
                            onChange={(e) => {
                              const next = [...r.levels];
                              next[li] = {
                                ...next[li],
                                salaryPerHour: e.target.value,
                              };
                              setRoleAt(idx, { levels: next });
                            }}
                            className="mt-1 w-full border border-slate-700 rounded-lg px-2 py-1 bg-slate-950/40 disabled:opacity-60"
                            placeholder="e.g. 45"
                          />
                        </div>

                        {/* Remove level */}
                        <div className="md:col-span-8 flex justify-end">
                          {r.levels.length > 1 && (
                            <button
                              type="button"
                              disabled={form.type === "TEAM"}
                              onClick={() => {
                                const next = r.levels.filter(
                                  (_, j) => j !== li,
                                );
                                setRoleAt(idx, { levels: next });
                              }}
                              className="text-xs px-3 py-1 rounded-lg border border-red-700 text-red-300 hover:bg-red-900/30 disabled:opacity-60"
                            >
                              Remove Level
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* per-role hint */}
                  {maxEmp ? (
                    <p className="text-[11px] text-slate-500">
                      Tip: total employees across levels should not exceed{" "}
                      <span className="text-slate-200 font-semibold">
                        {maxEmp}
                      </span>{" "}
                      for this role (project limit).
                    </p>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Requirements (Must + Nice) */}
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-800 bg-slate-950/30 p-3">
          <p className="text-sm font-semibold text-slate-100">
            Project Requirements (Must-have)
          </p>
          <p className="text-xs text-slate-500">
            Max 3 (auto from role competencies)
          </p>
          <div className="mt-3 space-y-2">
            {requirementsMustHave.map((v, i) => (
              <input
                key={i}
                value={v}
                onChange={(e) =>
                  setRequirementsMustHave((p) => {
                    const n = [...p];
                    n[i] = e.target.value;
                    return n;
                  })
                }
                className="w-full border border-slate-700 rounded-xl px-3 py-2 bg-slate-950/40"
                placeholder="Must-have requirement"
              />
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-950/30 p-3">
          <p className="text-sm font-semibold text-slate-100">
            Project Requirements (Nice-to-have)
          </p>
          <p className="text-xs text-slate-500">
            Max 5 (auto from project skills)
          </p>
          <div className="mt-3 space-y-2">
            {requirementsNiceToHave.map((v, i) => (
              <input
                key={i}
                value={v}
                onChange={(e) =>
                  setRequirementsNiceToHave((p) => {
                    const n = [...p];
                    n[i] = e.target.value;
                    return n;
                  })
                }
                className="w-full border border-slate-700 rounded-xl px-3 py-2 bg-slate-950/40"
                placeholder="Nice-to-have requirement"
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
