"use client";

import {
  useEffect,
  useRef,
  useState,
  useCallback,
  useContext,
  useMemo,
} from "react";
import { AuthContext } from "../context/AuthContext";
import { apiGet, apiPost } from "../lib/api";

// ✅ external system (another team)
const EXTERNAL_INTERNAL_PROJECTS_BASE = "https://internal-projects.example.com";

const emptyLang = { language: "English", level: "B2" };

const LANGUAGE_OPTIONS = [
  "English",
  "German",
  "French",
  "Spanish",
  "Italian",
  "Dutch",
  "Polish",
  "Portuguese",
  "Turkish",
  "Arabic",
  "Hindi",
  "Bengali",
];

const LANGUAGE_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2", "Native"];

/* ===================
   Create a Position Object
=================== */
function createPosition(subContract) {
  return {
    subContract: subContract || "",
    role: subContract || "",
    technology: "",
    experienceLevel: "",
    performanceLocation: "Onshore",
    startDate: "",
    endDate: "",
    manDays: 0,
    hoursPerDay: 8,
    employeesCount: 1,
    offeredSalaryPerHour: 0,
    taskDescription: "",
    mustHaveSkills: [],
    niceToHaveSkills: [],
  };
}

/** ✅ Resets full form state */
function getInitialPayload() {
  return {
    title: "",
    contract: "",
    contractId: "",
    requestType: "Single",
    positions: [createPosition("")],
    commercialWeighting: 50,
    technicalWeighting: 50,
    maxOffersPerProvider: 3,
    maxAcceptedOffers: 1,
    requiredLanguageSkills: [emptyLang],
  };
}

function Label({ children }) {
  return (
    <label className="text-xs font-medium text-slate-300">{children}</label>
  );
}

function SectionTitle({ children }) {
  return (
    <h3 className="text-sm font-semibold text-emerald-400 mt-4 mb-2">
      {children}
    </h3>
  );
}

/* ===================
   Multi-select with search (skills)
=================== */
function MultiSelect({
  label,
  options,
  selected,
  onChange,
  disabledOptions = [],
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef(null);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return options.filter((opt) => opt.toLowerCase().includes(q));
  }, [options, query]);

  useEffect(() => {
    function outside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", outside);
    return () => document.removeEventListener("mousedown", outside);
  }, []);

  const toggle = (value) => {
    if (disabledOptions.includes(value)) return;
    if (selected.includes(value)) onChange(selected.filter((v) => v !== value));
    else onChange([...selected, value]);
  };

  return (
    <div className="space-y-1" ref={containerRef}>
      {label && <Label>{label}</Label>}

      <button
        type="button"
        className="w-full rounded-lg bg-slate-800 px-2 py-1 flex flex-wrap gap-1 border border-slate-700 cursor-pointer"
        onClick={() => setOpen((v) => !v)}
      >
        {selected.length === 0 && (
          <span className="text-xs text-slate-500">Select skills...</span>
        )}

        {selected.map((s) => (
          <span
            key={s}
            onClick={(e) => {
              e.stopPropagation();
              toggle(s);
            }}
            className="flex items-center gap-1 text-[11px] bg-emerald-500/10 text-emerald-300 border border-emerald-500/40 rounded-full px-2 py-0.5"
          >
            {s}
            <span className="text-[10px]">✕</span>
          </span>
        ))}

        <span className="ml-auto text-[10px] text-slate-400">▼</span>
      </button>

      {open && (
        <div className="mt-1 max-h-64 overflow-y-auto bg-slate-900 border border-slate-700 rounded-lg p-2 z-30">
          <input
            className="w-full mb-2 px-2 py-1 rounded bg-slate-800 border border-slate-600 text-xs"
            placeholder="Search..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />

          {filtered.map((opt) => {
            const disabled = disabledOptions.includes(opt);
            const selectedItem = selected.includes(opt);

            return (
              <button
                type="button"
                key={opt}
                disabled={disabled}
                onClick={() => toggle(opt)}
                className={
                  "w-full text-left px-3 py-1.5 flex items-center gap-2 rounded text-xs " +
                  (disabled
                    ? "text-slate-500 cursor-not-allowed"
                    : selectedItem
                    ? "bg-emerald-500/20 text-emerald-200"
                    : "hover:bg-slate-800 text-slate-200")
                }
              >
                <span
                  className={
                    "inline-block w-3 h-3 rounded border " +
                    (selectedItem
                      ? "bg-emerald-400 border-emerald-400"
                      : "border-slate-600")
                  }
                />
                {opt}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function buildFinalPayload(payload) {
  const sumOfManDays = payload.positions.reduce(
    (t, p) => t + (Number(p.manDays) || 0) * (Number(p.employeesCount) || 1),
    0
  );

  const totalEmployees = payload.positions.reduce(
    (t, p) => t + (Number(p.employeesCount) || 1),
    0
  );

  const base = { ...payload, sumOfManDays, totalEmployees };

  if (payload.requestType === "Single" && payload.positions?.length) {
    return { ...base, positions: [payload.positions[0]] };
  }

  return base;
}

/* ===================
   MAIN COMPONENT
=================== */
export default function ServiceRequestForm({ onCreated }) {
  const { user, authHeaders, loading: authLoading } = useContext(AuthContext);

  const [contracts, setContracts] = useState([]);
  const [availableSubContracts, setAvailableSubContracts] = useState([]);
  const [skillsList, setSkillsList] = useState([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submitLockRef = useRef(false);

  const [payload, setPayload] = useState(getInitialPayload());

  const canCreate = user?.role === "ProjectManager";

  const headersReady =
    !!authHeaders?.["x-user-id"] && !!authHeaders?.["x-user-role"];

  /* ===================
     LOAD contracts + skills
  =================== */
  useEffect(() => {
    if (authLoading) return;

    apiGet("/contracts", { headers: authHeaders })
      .then((res) => setContracts(res.data || []))
      .catch(() => setContracts([]));

    apiGet("/skills", { headers: authHeaders })
      .then((res) => {
        const docs = res.data || [];
        const all = new Set();
        docs.forEach((d) => d.skills?.forEach((s) => all.add(s)));
        setSkillsList([...all]);
      })
      .catch(() => setSkillsList([]));
  }, [authLoading, authHeaders]);

  /* ============ Helpers ============ */
  const update = useCallback((key, value) => {
    setPayload((p) => ({ ...p, [key]: value }));
  }, []);

  const updatePosition = useCallback((i, patch) => {
    setPayload((p) => {
      const updated = [...p.positions];
      updated[i] = { ...updated[i], ...patch };
      return { ...p, positions: updated };
    });
  }, []);

  const setPositions = useCallback((arr) => {
    setPayload((p) => ({ ...p, positions: arr }));
  }, []);

  const resetForm = useCallback(() => {
    setPayload(getInitialPayload());
    setAvailableSubContracts([]);
  }, []);

  function handleContractChange(val) {
    const selected = contracts.find((c) => c.contract === val);
    const subs = selected?.subContract || [];

    setAvailableSubContracts(subs);

    setPayload((prev) => {
      let newPositions = prev.positions;

      if (prev.requestType === "Single" || prev.requestType === "Multi") {
        newPositions = [createPosition(subs[0] || "")];
      } else if (prev.requestType === "Team") {
        newPositions = prev.positions.filter((p) =>
          subs.includes(p.subContract)
        );
        if (newPositions.length === 0 && subs.length) {
          newPositions = [createPosition(subs[0])];
        }
      }

      return {
        ...prev,
        contract: val,
        contractId: selected?._id || "",
        positions: newPositions,
      };
    });
  }

  function handleSingleSubContractChange(value) {
    setPositions([createPosition(value)]);
  }

  function toggleTeamSubContract(sub) {
    setPayload((prev) => {
      let arr = prev.positions;
      if (arr.find((p) => p.subContract === sub)) {
        arr = arr.filter((p) => p.subContract !== sub);
      } else {
        arr = [...arr, createPosition(sub)];
      }
      if (arr.length === 0) arr = [createPosition(sub)];
      return { ...prev, positions: arr };
    });
  }

  function addLanguage() {
    update("requiredLanguageSkills", [
      ...payload.requiredLanguageSkills,
      { language: "English", level: "B2" },
    ]);
  }

  /* =================== Submit =================== */
  async function handleSubmit(e) {
    e.preventDefault();

    if (authLoading) return;

    if (!canCreate) {
      setError("Only ProjectManager can create requests.");
      return;
    }

    if (!headersReady) {
      setError(
        "Missing auth headers (x-user-id / x-user-role). Please login again."
      );
      return;
    }

    if (submitLockRef.current) return;
    submitLockRef.current = true;

    setError("");
    setLoading(true);

    try {
      const final = buildFinalPayload(payload);

      await apiPost("/requests", final, {
        headers: authHeaders,
      });

      await Promise.resolve(onCreated?.());
      resetForm();
    } catch (err) {
      setError(err?.response?.data?.error || "Error creating request");
    } finally {
      setLoading(false);
      submitLockRef.current = false;
    }
  }

  const { positions, requestType } = payload;
  const singleOrMulti = requestType === "Single" || requestType === "Multi";
  const isTeam = requestType === "Team";

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-slate-900/70 border border-slate-800 rounded-2xl shadow-lg p-6 space-y-8"
    >
      {/* HEADER */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold">New Service Request</h2>
          <p className="text-xs text-slate-400">Fill all required details.</p>

          {authLoading && (
            <p className="text-[11px] text-slate-400 mt-1">
              Loading session...
            </p>
          )}

          {!authLoading && !headersReady && (
            <p className="text-[11px] text-amber-300 mt-1">
              Not authenticated (missing headers). Login again.
            </p>
          )}

          {!canCreate && (
            <p className="text-[11px] text-amber-300 mt-1">
              You must be ProjectManager to create requests.
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* ✅ visible for everyone */}
          <a
            href={EXTERNAL_INTERNAL_PROJECTS_BASE}
            target="_blank"
            rel="noreferrer"
            className="px-4 py-2 rounded-xl border border-slate-600 text-xs text-slate-200 hover:bg-slate-800"
          >
            Open Internal Projects
          </a>

          <button
            type="submit"
            disabled={loading || authLoading || !canCreate || !headersReady}
            className="px-4 py-2 rounded-xl bg-emerald-500 text-black text-sm shadow hover:bg-emerald-400 disabled:opacity-60"
          >
            {loading ? "Creating..." : "Create Request"}
          </button>

          <button
            type="button"
            disabled={loading}
            onClick={resetForm}
            className="px-4 py-2 rounded-xl border border-slate-600 text-xs text-slate-200 hover:bg-slate-800 disabled:opacity-60"
          >
            Reset
          </button>
        </div>
      </div>

      {error && (
        <p className="text-xs text-red-400 border border-red-500/40 bg-red-500/10 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      {/* BASIC INFO */}
      <div>
        <SectionTitle>Basic Information</SectionTitle>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <Label>Title</Label>
            <input
              required
              value={payload.title}
              onChange={(e) => update("title", e.target.value)}
              className="w-full rounded-lg bg-slate-800 px-3 py-2"
            />
          </div>

          <div>
            <Label>Request Type</Label>
            <select
              value={payload.requestType}
              onChange={(e) => update("requestType", e.target.value)}
              className="w-full rounded-lg bg-slate-800 px-3 py-2"
            >
              <option value="Single">Single</option>
              <option value="Multi">Multi</option>
              <option value="Team">Team</option>
              <option value="WorkContract">Work Contract</option>
            </select>
          </div>
        </div>
      </div>

      {/* CONTRACT + SUBCONTRACT */}
      <div>
        <SectionTitle>Contract & Sub Contract</SectionTitle>

        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <Label>Contract</Label>
            <select
              value={payload.contract}
              onChange={(e) => handleContractChange(e.target.value)}
              className="w-full rounded-lg bg-slate-800 px-3 py-2"
            >
              <option value="">Select contract</option>
              {contracts.map((c) => (
                <option key={c._id} value={c.contract}>
                  {c.contract}
                </option>
              ))}
            </select>

            {payload.contractId && (
              <p className="text-[10px] text-slate-500">
                Contract ID: {payload.contractId}
              </p>
            )}
          </div>

          {singleOrMulti && (
            <div>
              <Label>Sub Contract</Label>
              <select
                value={positions[0]?.subContract}
                onChange={(e) => handleSingleSubContractChange(e.target.value)}
                className="w-full rounded-lg bg-slate-800 px-3 py-2"
                disabled={!availableSubContracts.length}
              >
                <option value="">Select sub contract</option>
                {availableSubContracts.map((s, i) => (
                  <option key={i} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          )}

          {isTeam && (
            <div className="md:col-span-2">
              <Label>Team Sub Contracts</Label>
              <div className="flex flex-wrap gap-2">
                {availableSubContracts.map((s, i) => {
                  const active = positions.some((p) => p.subContract === s);
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => toggleTeamSubContract(s)}
                      className={
                        "px-3 py-1 rounded-full text-xs border " +
                        (active
                          ? "bg-emerald-500 text-black border-emerald-400"
                          : "bg-slate-800 border-slate-600 text-slate-200")
                      }
                    >
                      {s}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* REQUIREMENTS PER POSITION */}
      <div>
        <SectionTitle>Requirements</SectionTitle>

        {positions.map((pos, index) => (
          <div
            key={`${pos.subContract}-${index}`}
            className="border border-slate-700 rounded-xl p-4 space-y-4 bg-slate-900/40"
          >
            <div className="grid md:grid-cols-3 gap-4">
              <div>
                <Label>Role</Label>
                <input
                  readOnly
                  value={pos.role}
                  className="w-full rounded-lg bg-slate-800 px-3 py-2 text-xs"
                />
              </div>

              {(requestType === "Multi" || requestType === "Team") && (
                <div>
                  <Label>Required Employees</Label>
                  <input
                    type="number"
                    min={1}
                    value={pos.employeesCount}
                    onChange={(e) =>
                      updatePosition(index, {
                        employeesCount: Number(e.target.value),
                      })
                    }
                    className="w-full rounded-lg bg-slate-800 px-3 py-2 text-xs"
                  />
                </div>
              )}

              <div>
                <Label>Offered Salary (€ / hour)</Label>
                <input
                  type="number"
                  min={0}
                  value={pos.offeredSalaryPerHour}
                  onChange={(e) =>
                    updatePosition(index, {
                      offeredSalaryPerHour: Number(e.target.value),
                    })
                  }
                  className="w-full rounded-lg bg-slate-800 px-3 py-2 text-xs"
                />
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-4">
              <div>
                <Label>Technology</Label>
                <input
                  value={pos.technology}
                  onChange={(e) =>
                    updatePosition(index, { technology: e.target.value })
                  }
                  className="w-full rounded-lg bg-slate-800 px-3 py-2 text-xs"
                />
              </div>

              <div>
                <Label>Experience Level</Label>
                <input
                  value={pos.experienceLevel}
                  onChange={(e) =>
                    updatePosition(index, { experienceLevel: e.target.value })
                  }
                  placeholder="Junior / Mid / Senior"
                  className="w-full rounded-lg bg-slate-800 px-3 py-2 text-xs"
                />
              </div>

              <div>
                <Label>Job Location</Label>
                <select
                  value={pos.performanceLocation}
                  onChange={(e) =>
                    updatePosition(index, {
                      performanceLocation: e.target.value,
                    })
                  }
                  className="w-full rounded-lg bg-slate-800 px-3 py-2 text-xs"
                >
                  <option value="Onshore">Onsite</option>
                  <option value="Nearshore">Remote</option>
                  <option value="Offshore">Hybrid</option>
                </select>
              </div>
            </div>

            <div className="grid md:grid-cols-4 gap-4">
              <div>
                <Label>Start Date</Label>
                <input
                  type="date"
                  value={pos.startDate}
                  onChange={(e) =>
                    updatePosition(index, { startDate: e.target.value })
                  }
                  className="w-full rounded-lg bg-slate-800 px-3 py-2 text-xs"
                />
              </div>

              <div>
                <Label>End Date</Label>
                <input
                  type="date"
                  value={pos.endDate}
                  onChange={(e) =>
                    updatePosition(index, { endDate: e.target.value })
                  }
                  className="w-full rounded-lg bg-slate-800 px-3 py-2 text-xs"
                />
              </div>

              <div>
                <Label>Total Days</Label>
                <input
                  type="number"
                  min={0}
                  value={pos.manDays}
                  onChange={(e) =>
                    updatePosition(index, { manDays: Number(e.target.value) })
                  }
                  className="w-full rounded-lg bg-slate-800 px-3 py-2 text-xs"
                />
              </div>

              <div>
                <Label>Hours / Day</Label>
                <input
                  type="number"
                  min={1}
                  value={pos.hoursPerDay}
                  onChange={(e) =>
                    updatePosition(index, {
                      hoursPerDay: Number(e.target.value),
                    })
                  }
                  className="w-full rounded-lg bg-slate-800 px-3 py-2 text-xs"
                />
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <MultiSelect
                label="Must-have Skills"
                options={skillsList}
                selected={pos.mustHaveSkills}
                disabledOptions={[]}
                onChange={(v) => updatePosition(index, { mustHaveSkills: v })}
              />

              <MultiSelect
                label="Nice-to-have Skills"
                options={skillsList}
                selected={pos.niceToHaveSkills}
                disabledOptions={pos.mustHaveSkills}
                onChange={(v) => updatePosition(index, { niceToHaveSkills: v })}
              />
            </div>

            <div>
              <Label>Task Description</Label>
              <textarea
                rows={2}
                value={pos.taskDescription}
                onChange={(e) =>
                  updatePosition(index, { taskDescription: e.target.value })
                }
                className="w-full rounded-lg bg-slate-800 px-3 py-2 text-xs"
              />
            </div>
          </div>
        ))}
      </div>

      {/* ADDITIONAL DETAILS */}
      <div>
        <SectionTitle>Additional Details</SectionTitle>

        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <Label>Commercial Weighting (%)</Label>
            <input
              type="number"
              min={0}
              max={100}
              value={payload.commercialWeighting}
              onChange={(e) =>
                update("commercialWeighting", Number(e.target.value))
              }
              className="w-full rounded-lg bg-slate-800 px-3 py-2"
            />
          </div>

          <div>
            <Label>Technical Weighting (%)</Label>
            <input
              type="number"
              min={0}
              max={100}
              value={payload.technicalWeighting}
              onChange={(e) =>
                update("technicalWeighting", Number(e.target.value))
              }
              className="w-full rounded-lg bg-slate-800 px-3 py-2"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Required Languages</Label>

          {payload.requiredLanguageSkills.map((ls, i) => (
            <div key={i} className="grid grid-cols-2 gap-2">
              <select
                value={ls.language}
                onChange={(e) => {
                  const arr = [...payload.requiredLanguageSkills];
                  arr[i] = { ...arr[i], language: e.target.value };
                  update("requiredLanguageSkills", arr);
                }}
                className="rounded-lg bg-slate-800 px-3 py-2 text-xs"
              >
                {LANGUAGE_OPTIONS.map((lang) => (
                  <option key={lang} value={lang}>
                    {lang}
                  </option>
                ))}
              </select>

              <select
                value={ls.level}
                onChange={(e) => {
                  const arr = [...payload.requiredLanguageSkills];
                  arr[i] = { ...arr[i], level: e.target.value };
                  update("requiredLanguageSkills", arr);
                }}
                className="rounded-lg bg-slate-800 px-3 py-2 text-xs"
              >
                {LANGUAGE_LEVELS.map((lvl) => (
                  <option key={lvl} value={lvl}>
                    {lvl}
                  </option>
                ))}
              </select>
            </div>
          ))}

          <button
            type="button"
            onClick={addLanguage}
            className="text-[11px] mt-1 px-3 py-1.5 border border-emerald-500/60 text-emerald-300 rounded-lg hover:bg-emerald-500/10"
          >
            + Add another language
          </button>
        </div>
      </div>
    </form>
  );
}
