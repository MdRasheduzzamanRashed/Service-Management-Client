// components/ServiceRequestForm.jsx
"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useContext,
  useCallback,
} from "react";
import { AuthContext } from "../context/AuthContext";
import { ToastContext } from "../context/ToastContext";
import { apiPost } from "../lib/api";

const PROJECTS_API = process.env.NEXT_PUBLIC_PROJECTS_API;
const CONTRACTS_API = process.env.NEXT_PUBLIC_CONTRACTS_API;

export default function ServiceRequestForm({
  mode = "create",
  initialRequest = null,
  saving: savingProp,
  onSubmit,
  onCancel,
  onCreated,
}) {
  const { authHeaders } = useContext(AuthContext);
  const { showToast } = useContext(ToastContext);

  const [projects, setProjects] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [availableRoles, setAvailableRoles] = useState([]);

  const [selectedProject, setSelectedProject] = useState(null);
  const [selectedContract, setSelectedContract] = useState(null);

  const [savingLocal, setSavingLocal] = useState(false);
  const saving = savingProp ?? savingLocal;

  const [info, setInfo] = useState("");
  const [err, setErr] = useState("");

  // ✅ new: ref data loading state
  const [refLoading, setRefLoading] = useState(false);

  const titleTouchedRef = useRef(false);

  const emptyRoleRow = useCallback(
    () => ({
      selectedContractRole: "",
      domain: "",
      roleName: "",
      technology: "",
      experienceLevel: "",
      manDays: "",
      onsiteDays: "",
    }),
    [],
  );

  const emptyLangRow = useCallback(
    () => ({
      language: "",
      level: "B2",
    }),
    [],
  );

  const [form, setForm] = useState({
    title: "",
    type: "SINGLE",
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

    must1: "",
    must2: "",
    must3: "",
    nice1: "",
    nice2: "",
    nice3: "",
    nice4: "",
    nice5: "",
    taskDescription: "",
    furtherInformation: "",
  });

  const [roles, setRoles] = useState([emptyRoleRow()]);
  const [languages, setLanguages] = useState([emptyLangRow()]);

  // ------- role row limits -------
  const maxRoleRows = useMemo(() => {
    if (form.type === "MULTI") return 4;
    if (form.type === "TEAM") return Infinity;
    return 1;
  }, [form.type]);
  const canAddRole = roles.length < maxRoleRows;

  /* ---------------- LOAD PROJECTS/CONTRACTS (with progress toasts) ---------------- */
  useEffect(() => {
    let alive = true;

    async function loadRefData() {
      setErr("");

      if (!PROJECTS_API) return setErr("Missing env: NEXT_PUBLIC_PROJECTS_API");
      if (!CONTRACTS_API)
        return setErr("Missing env: NEXT_PUBLIC_CONTRACTS_API");

      setRefLoading(true);

      // ✅ loading toast
      try {
        showToast?.({
          title: "Loading reference data...",
          message: "Fetching projects and contracts",
          type: "info",
          duration: 2500, // if your toast supports duration=0 for sticky, change to 0
        });
      } catch {}

      try {
        const [pRes, cRes] = await Promise.all([
          fetch("/api/external/projects"),
          fetch("/api/external/contracts"),
        ]);

        if (!pRes.ok) throw new Error(`Projects API failed: ${pRes.status}`);
        if (!cRes.ok) throw new Error(`Contracts API failed: ${cRes.status}`);

        const pJson = await pRes.json();
        const cJson = await cRes.json();

        const pList =
          (Array.isArray(pJson) && pJson) ||
          (Array.isArray(pJson?.data) && pJson.data) ||
          (Array.isArray(pJson?.projects) && pJson.projects) ||
          [];

        const cList =
          (Array.isArray(cJson) && cJson) ||
          (Array.isArray(cJson?.data) && cJson.data) ||
          (Array.isArray(cJson?.contracts) && cJson.contracts) ||
          [];

        if (!alive) return;
        setProjects(pList);
        setContracts(cList);

        showToast?.({
          title: "Loaded successfully",
          message: `Projects: ${pList.length}, Contracts: ${cList.length}`,
          type: "success",
          duration: 2500,
        });
      } catch (e) {
        if (!alive) return;
        setProjects([]);
        setContracts([]);
        setErr(e?.message || "Failed to load projects/contracts");

        showToast?.({
          title: "Load failed",
          message: e?.message || "Failed to load projects/contracts",
          type: "error",
          duration: 4000,
        });
      } finally {
        if (!alive) return;
        setRefLoading(false);
      }
    }

    loadRefData();
    return () => {
      alive = false;
    };
  }, []);

  /* ---------------- PREFILL IF EDIT ---------------- */
  useEffect(() => {
    if (mode !== "edit") return;
    if (!initialRequest) return;

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

      startDate: initialRequest.startDate || "",
      endDate: initialRequest.endDate || "",

      performanceLocation: initialRequest.performanceLocation || "",
      maxOffers: initialRequest.maxOffers ?? "",
      maxAcceptedOffers: initialRequest.maxAcceptedOffers ?? "",
      biddingCycleDays: initialRequest.biddingCycleDays ?? 7,

      must1: initialRequest.mustHaveCriteria?.[0] || "",
      must2: initialRequest.mustHaveCriteria?.[1] || "",
      must3: initialRequest.mustHaveCriteria?.[2] || "",
      nice1: initialRequest.niceToHaveCriteria?.[0] || "",
      nice2: initialRequest.niceToHaveCriteria?.[1] || "",
      nice3: initialRequest.niceToHaveCriteria?.[2] || "",
      nice4: initialRequest.niceToHaveCriteria?.[3] || "",
      nice5: initialRequest.niceToHaveCriteria?.[4] || "",
      taskDescription: initialRequest.taskDescription || "",
      furtherInformation: initialRequest.furtherInformation || "",
    }));

    const reqRoles =
      Array.isArray(initialRequest.roles) && initialRequest.roles.length
        ? initialRequest.roles
        : [emptyRoleRow()];

    setRoles(
      reqRoles.map((r) => ({
        selectedContractRole: r.roleName || r.selectedContractRole || "",
        domain: r.domain || "",
        roleName: r.roleName || "",
        technology: r.technology || "",
        experienceLevel: r.experienceLevel || "",
        manDays: r.manDays ?? "",
        onsiteDays: r.onsiteDays ?? "",
      })),
    );

    const langInput =
      initialRequest.requiredLanguagesWithLevel ||
      initialRequest.requiredLanguages ||
      [];
    const langRows = Array.isArray(langInput)
      ? langInput
          .map((x) => {
            if (typeof x === "string") return { language: x, level: "B2" };
            return {
              language: String(x?.language || x?.name || "").trim(),
              level: String(x?.level || "B2").trim(),
            };
          })
          .filter((x) => x.language)
      : [];
    setLanguages(langRows.length ? langRows : [emptyLangRow()]);
  }, [mode, initialRequest, emptyRoleRow, emptyLangRow]);

  /* ---------------- HELPERS ---------------- */
  const numOrNull = (v) => (v === "" ? null : Number(v));

  const getTechnologyOptionsFromContractRole = (cr) => {
    if (!cr) return [];
    const candidates = [
      cr.technologies,
      cr.technologyOptions,
      cr.technologyLevels,
      cr.technology,
      cr.tech,
      cr.techStack,
    ];
    const out = [];
    for (const val of candidates) {
      if (!val) continue;
      if (Array.isArray(val)) val.forEach((x) => out.push(String(x).trim()));
      else out.push(String(val).trim());
    }
    return Array.from(new Set(out.filter(Boolean)));
  };

  const getContractRoleObj = (selectedContractRole) =>
    availableRoles.find((r) => String(r.role) === String(selectedContractRole));

  const getTechnologyOptionsForRow = (row) => {
    const cr = getContractRoleObj(row.selectedContractRole);
    return getTechnologyOptionsFromContractRole(cr);
  };

  /* ---------------- HANDLERS ---------------- */
  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === "title") titleTouchedRef.current = true;

    if (name === "type") {
      setForm((prev) => ({ ...prev, type: value }));
      setRoles((prev) => {
        const limit = value === "MULTI" ? 4 : value === "TEAM" ? Infinity : 1;
        return prev.length <= limit ? prev : prev.slice(0, limit);
      });
      return;
    }

    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleProjectSelect = (e) => {
    const selectedValue = e.target.value;
    const proj = projects.find(
      (p) => String(p.projectId || p.id) === String(selectedValue),
    );

    setSelectedProject(proj || null);

    setForm((prev) => ({
      ...prev,
      projectId: proj?.projectId || "",
      projectName: proj?.projectDescription || proj?.projectId || "",
      title: titleTouchedRef.current
        ? prev.title
        : proj?.projectDescription || proj?.projectId || "",

      startDate: proj?.projectStart || prev.startDate,
      endDate: proj?.projectEnd || prev.endDate,

      taskDescription: proj?.taskDescription || prev.taskDescription,
      furtherInformation:
        prev.furtherInformation ||
        (proj?.selectedSkills?.length
          ? `Skills: ${proj.selectedSkills.join(", ")}`
          : ""),
    }));
  };

  const handleContractSelect = (e) => {
    const contractId = e.target.value;
    const contract = contracts.find((c) => String(c.id) === String(contractId));

    setSelectedContract(contract || null);

    const rolesFromContract = Array.isArray(contract?.roles)
      ? contract.roles
      : [];
    setAvailableRoles(rolesFromContract);

    setForm((prev) => ({
      ...prev,
      contractId: contract?.id ? String(contract.id) : "",
      contractSupplier: contract?.supplier || "",
    }));

    setRoles((prev) =>
      prev.map((r) => ({ ...r, domain: r.domain || contract?.domain || "" })),
    );
  };

  const handleRoleContractSelect = (index, selectedRoleName) => {
    if (!selectedContract) return;

    setRoles((prev) => {
      const updated = [...prev];
      const cr = availableRoles.find(
        (r) => String(r.role) === String(selectedRoleName),
      );

      const techOptions = getTechnologyOptionsFromContractRole(cr);
      const defaultTech = techOptions[0] || "";

      updated[index] = {
        ...updated[index],
        selectedContractRole: selectedRoleName,
        roleName: cr?.role || selectedRoleName || "",
        experienceLevel: cr?.experience || "",
        domain: updated[index]?.domain || selectedContract?.domain || "",
        technology: defaultTech,
      };

      return updated;
    });
  };

  const handleRoleFieldChange = (index, field, value) => {
    setRoles((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const addRoleRow = () => {
    if (!(form.type === "MULTI" || form.type === "TEAM")) return;
    if (!canAddRole) return;
    setRoles((prev) => [
      ...prev,
      { ...emptyRoleRow(), domain: selectedContract?.domain || "" },
    ]);
  };

  const removeRoleRow = (index) => {
    if (roles.length === 1) return;
    setRoles((prev) => prev.filter((_, i) => i !== index));
  };

  // ✅ LANG rows
  const addLangRow = () => setLanguages((p) => [...p, emptyLangRow()]);
  const removeLangRow = (i) => {
    setLanguages((p) => (p.length === 1 ? p : p.filter((_, idx) => idx !== i)));
  };
  const updateLangRow = (i, field, value) => {
    setLanguages((p) => {
      const next = [...p];
      next[i] = { ...next[i], [field]: value };
      return next;
    });
  };

  const buildPayload = () => ({
    title: form.title,
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
    biddingCycleDays: Number(form.biddingCycleDays),

    taskDescription: form.taskDescription || "",
    furtherInformation: form.furtherInformation || "",

    requiredLanguagesWithLevel: languages
      .map((l) => ({
        language: String(l.language || "").trim(),
        level: String(l.level || "").trim(),
      }))
      .filter((l) => l.language),

    mustHaveCriteria: [form.must1, form.must2, form.must3].filter(Boolean),
    niceToHaveCriteria: [
      form.nice1,
      form.nice2,
      form.nice3,
      form.nice4,
      form.nice5,
    ].filter(Boolean),

    roles: roles.map((r) => ({
      domain: r.domain || null,
      roleName: r.roleName || null,
      technology: r.technology || null,
      experienceLevel: r.experienceLevel || null,
      manDays: numOrNull(r.manDays),
      onsiteDays: numOrNull(r.onsiteDays),
    })),
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setInfo("");
    setErr("");

    const payload = buildPayload();

    if (mode === "edit") {
      if (!onSubmit) {
        setErr("Missing onSubmit handler for edit mode");
        return;
      }
      await onSubmit(payload);
      return;
    }

    try {
      setSavingLocal(true);
      await apiPost("/requests", payload, { headers: authHeaders });
      setInfo("Request created successfully!");
      onCreated?.();
    } catch (e2) {
      setErr(
        e2?.response?.data?.error || e2?.message || "Failed to create request",
      );
    } finally {
      setSavingLocal(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4 sm:p-6 space-y-5"
    >
      {refLoading && (
        <div className="rounded-xl border border-slate-700 bg-slate-950/40 px-4 py-3">
          <p className="text-xs text-slate-300">
            Loading projects & contracts...
          </p>
          <div className="mt-2 h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
            <div className="h-full w-1/2 bg-emerald-500 animate-pulse" />
          </div>
        </div>
      )}

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

      {/* TITLE + TYPE */}
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <label className="text-xs text-slate-300">Title</label>
          <input
            type="text"
            name="title"
            value={form.title}
            onChange={handleChange}
            className="mt-1 w-full border border-slate-700 rounded-xl px-3 py-2 bg-slate-950/40"
            required
          />
        </div>

        <div>
          <label className="text-xs text-slate-300">Request Type</label>
          <select
            name="type"
            value={form.type}
            onChange={handleChange}
            className="mt-1 w-full border border-slate-700 rounded-xl px-3 py-2 bg-slate-950/40"
          >
            <option value="SINGLE">Single</option>
            <option value="MULTI">Multi</option>
            <option value="TEAM">Team</option>
            <option value="WORK_CONTRACT">Work Contract</option>
          </select>
        </div>
      </div>

      {/* PROJECT / CONTRACT / DATES */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-4">
        <div>
          <label className="text-xs text-slate-300">Project</label>
          <select
            value={form.projectId || ""}
            onChange={handleProjectSelect}
            disabled={refLoading}
            className="mt-1 w-full border border-slate-700 rounded-xl px-3 py-2 bg-slate-950/40 disabled:opacity-60"
          >
            <option value="">
              {refLoading ? "Loading projects..." : "-- Select project --"}
            </option>
            {projects.map((p) => (
              <option
                key={String(p.id || p.projectId)}
                value={p.projectId || p.id}
              >
                {p.projectId} – {p.projectDescription}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs text-slate-300">Contract</label>
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
              <option key={String(c.id)} value={c.id}>
                {c.supplier} – {c.domain}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs text-slate-300">Start Date</label>
          <input
            type="date"
            name="startDate"
            value={form.startDate || ""}
            onChange={handleChange}
            className="mt-1 w-full border border-slate-700 rounded-xl px-3 py-2 bg-slate-950/40"
          />
        </div>

        <div>
          <label className="text-xs text-slate-300">End Date</label>
          <input
            type="date"
            name="endDate"
            value={form.endDate || ""}
            onChange={handleChange}
            className="mt-1 w-full border border-slate-700 rounded-xl px-3 py-2 bg-slate-950/40"
          />
        </div>
      </div>

      {/* LOCATION / OFFERS / BIDDING CYCLE */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-4">
        <div>
          <label className="text-xs text-slate-300">Performance Location</label>
          <input
            type="text"
            name="performanceLocation"
            value={form.performanceLocation || ""}
            onChange={handleChange}
            className="mt-1 w-full border border-slate-700 rounded-xl px-3 py-2 bg-slate-950/40"
            placeholder="e.g. Frankfurt, Onsite/Hybrid"
          />
        </div>

        <div>
          <label className="text-xs text-slate-300">Max Offers</label>
          <input
            type="number"
            name="maxOffers"
            value={form.maxOffers}
            onChange={handleChange}
            className="mt-1 w-full border border-slate-700 rounded-xl px-3 py-2 bg-slate-950/40"
          />
        </div>

        <div>
          <label className="text-xs text-slate-300">Max Accepted Offers</label>
          <input
            type="number"
            name="maxAcceptedOffers"
            value={form.maxAcceptedOffers}
            onChange={handleChange}
            className="mt-1 w-full border border-slate-700 rounded-xl px-3 py-2 bg-slate-950/40"
          />
        </div>

        <div>
          <label className="text-xs text-slate-300">Bidding Cycle (days)</label>
          <select
            name="biddingCycleDays"
            value={form.biddingCycleDays}
            onChange={handleChange}
            className="mt-1 w-full border border-slate-700 rounded-xl px-3 py-2 bg-slate-950/40"
          >
            <option value={0}>0</option>
            <option value={1}>1</option>
            <option value={3}>3</option>
            <option value={7}>7</option>
            <option value={14}>14</option>
            <option value={21}>21</option>
            <option value={30}>30</option>
          </select>
        </div>
      </div>

      {/* ROLES */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold">Requested Roles</h2>
            <p className="text-xs text-slate-500">
              Add Role only for Multi or Team.
            </p>
          </div>

          <button
            type="button"
            onClick={addRoleRow}
            disabled={
              !(form.type === "MULTI" || form.type === "TEAM") || !canAddRole
            }
            className="text-xs px-3 py-1.5 rounded-full border border-slate-700 hover:bg-slate-800 disabled:opacity-60"
          >
            + Add Role
          </button>
        </div>

        <div className="space-y-3">
          {roles.map((r, index) => {
            const techOptions = getTechnologyOptionsForRow(r);
            return (
              <div
                key={index}
                className="rounded-2xl border border-slate-800 bg-slate-950/30 p-3"
              >
                <div className="grid gap-3 grid-cols-1 md:grid-cols-2 xl:grid-cols-7">
                  <div className="xl:col-span-2">
                    <label className="text-[11px] text-slate-400">
                      Contract Role
                    </label>
                    <select
                      value={r.selectedContractRole}
                      onChange={(e) =>
                        handleRoleContractSelect(index, e.target.value)
                      }
                      className="mt-1 w-full border border-slate-700 rounded-xl px-2 py-2 text-sm bg-slate-950/40"
                      disabled={!selectedContract}
                    >
                      <option value="">
                        {selectedContract
                          ? "-- select --"
                          : "Select contract first"}
                      </option>
                      {availableRoles.map((cr) => (
                        <option key={cr.role} value={cr.role}>
                          {cr.role} ({cr.experience})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] text-slate-400">Domain</label>
                    <input
                      value={r.domain}
                      onChange={(e) =>
                        handleRoleFieldChange(index, "domain", e.target.value)
                      }
                      className="mt-1 w-full border border-slate-700 rounded-xl px-2 py-2 bg-slate-950/40"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] text-slate-400">Role</label>
                    <input
                      value={r.roleName}
                      onChange={(e) =>
                        handleRoleFieldChange(index, "roleName", e.target.value)
                      }
                      className="mt-1 w-full border border-slate-700 rounded-xl px-2 py-2 bg-slate-950/40"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] text-slate-400">
                      Technology
                    </label>
                    <select
                      value={r.technology}
                      onChange={(e) =>
                        handleRoleFieldChange(
                          index,
                          "technology",
                          e.target.value,
                        )
                      }
                      className="mt-1 w-full border border-slate-700 rounded-xl px-2 py-2 text-sm bg-slate-950/40"
                      disabled={!r.selectedContractRole}
                    >
                      <option value="">
                        {r.selectedContractRole
                          ? "-- select --"
                          : "Select role first"}
                      </option>
                      {techOptions.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] text-slate-400">
                      Experience
                    </label>
                    <input
                      value={r.experienceLevel}
                      onChange={(e) =>
                        handleRoleFieldChange(
                          index,
                          "experienceLevel",
                          e.target.value,
                        )
                      }
                      className="mt-1 w-full border border-slate-700 rounded-xl px-2 py-2 bg-slate-950/40"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] text-slate-400">
                      Man Days
                    </label>
                    <input
                      type="number"
                      value={r.manDays}
                      onChange={(e) =>
                        handleRoleFieldChange(index, "manDays", e.target.value)
                      }
                      className="mt-1 w-full border border-slate-700 rounded-xl px-2 py-2 bg-slate-950/40"
                    />
                  </div>

                  <div className="flex items-end gap-2">
                    <div className="flex-1">
                      <label className="text-[11px] text-slate-400">
                        Onsite Days
                      </label>
                      <input
                        type="number"
                        value={r.onsiteDays}
                        onChange={(e) =>
                          handleRoleFieldChange(
                            index,
                            "onsiteDays",
                            e.target.value,
                          )
                        }
                        className="mt-1 w-full border border-slate-700 rounded-xl px-2 py-2 bg-slate-950/40"
                      />
                    </div>

                    {roles.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeRoleRow(index)}
                        className="text-red-300 text-xs font-semibold px-2 py-2"
                        title="Remove role"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>

                {/* Required Languages (last role block) */}
                {index === roles.length - 1 && (
                  <div className="mt-4 border-t border-slate-800 pt-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-semibold">
                          Required Languages (with level)
                        </h3>
                        <p className="text-xs text-slate-500">
                          Add language + level (A1..C2 / Native).
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={addLangRow}
                        className="text-xs px-3 py-1.5 rounded-full border border-slate-700 hover:bg-slate-800"
                      >
                        + Add Language
                      </button>
                    </div>

                    <div className="space-y-2">
                      {languages.map((l, i) => (
                        <div
                          key={i}
                          className="grid gap-3 grid-cols-1 sm:grid-cols-3 items-end"
                        >
                          <div className="sm:col-span-2">
                            <label className="text-[11px] text-slate-400">
                              Language
                            </label>
                            <input
                              value={l.language}
                              onChange={(e) =>
                                updateLangRow(i, "language", e.target.value)
                              }
                              className="mt-1 w-full border border-slate-700 rounded-xl px-3 py-2 bg-slate-950/40"
                              placeholder="e.g. English"
                            />
                          </div>

                          <div className="flex gap-2">
                            <div className="flex-1">
                              <label className="text-[11px] text-slate-400">
                                Level
                              </label>
                              <select
                                value={l.level}
                                onChange={(e) =>
                                  updateLangRow(i, "level", e.target.value)
                                }
                                className="mt-1 w-full border border-slate-700 rounded-xl px-3 py-2 bg-slate-950/40"
                              >
                                {[
                                  "A1",
                                  "A2",
                                  "B1",
                                  "B2",
                                  "C1",
                                  "C2",
                                  "Native",
                                ].map((x) => (
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
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Must / Nice criteria */}
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
        <div>
          <p className="text-xs text-slate-300 mb-2">Must-have criteria</p>
          {["must1", "must2", "must3"].map((k) => (
            <input
              key={k}
              name={k}
              value={form[k]}
              onChange={handleChange}
              className="w-full border border-slate-700 rounded-xl px-3 py-2 bg-slate-950/40 mb-2"
              placeholder="Must-have..."
            />
          ))}
        </div>

        <div>
          <p className="text-xs text-slate-300 mb-2">Nice-to-have criteria</p>
          {["nice1", "nice2", "nice3", "nice4", "nice5"].map((k) => (
            <input
              key={k}
              name={k}
              value={form[k]}
              onChange={handleChange}
              className="w-full border border-slate-700 rounded-xl px-3 py-2 bg-slate-950/40 mb-2"
              placeholder="Nice-to-have..."
            />
          ))}
        </div>
      </div>

      {/* Task Description + Further Info */}
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
        <div>
          <label className="text-xs text-slate-300">Task Description</label>
          <textarea
            name="taskDescription"
            value={form.taskDescription}
            onChange={handleChange}
            rows={5}
            className="mt-1 w-full border border-slate-700 rounded-xl px-3 py-2 bg-slate-950/40"
            placeholder="Will auto-fill from project if available..."
          />
        </div>

        <div>
          <label className="text-xs text-slate-300">Further Information</label>
          <textarea
            name="furtherInformation"
            value={form.furtherInformation}
            onChange={handleChange}
            rows={5}
            className="mt-1 w-full border border-slate-700 rounded-xl px-3 py-2 bg-slate-950/40"
            placeholder="Will auto-fill with skills from project selection..."
          />
        </div>
      </div>

      {/* ACTION BUTTONS */}
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
