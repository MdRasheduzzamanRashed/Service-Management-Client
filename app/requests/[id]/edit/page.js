"use client";

import {
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { AuthContext } from "../../../../context/AuthContext";
import { apiGet, apiPut } from "../../../../lib/api";
// ✅ for app/requests/[id]/edit/page.js
// If your file is deeper/shallower, adjust ../ count.

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

/** ✅ normalize Mongo ObjectId values (string OR { $oid }) */
function oidToString(v) {
  if (!v) return "";
  if (typeof v === "string") return v;
  if (typeof v === "object" && v.$oid) return String(v.$oid);
  return String(v);
}

/* ===================
   UI helpers
=================== */
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
    return (options || []).filter((opt) => opt.toLowerCase().includes(q));
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

/* ===================
   helper
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

export default function RequestEditPage() {
  const { id } = useParams();
  const router = useRouter();

  const { user, authHeaders, loading: authLoading } = useContext(AuthContext);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [reqDoc, setReqDoc] = useState(null);

  const [contracts, setContracts] = useState([]);
  const [availableSubContracts, setAvailableSubContracts] = useState([]);
  const [skillsList, setSkillsList] = useState([]);

  const saveLockRef = useRef(false);

  const headersReady = useMemo(() => {
    return (
      !!authHeaders?.["x-user-id"] &&
      !!authHeaders?.["x-user-role"] &&
      !authLoading
    );
  }, [authHeaders, authLoading]);

  const canEdit = useMemo(() => {
    const myId = oidToString(user?._id);
    const ownerId = oidToString(reqDoc?.createdBy);

    return (
      user?.role === "ProjectManager" &&
      reqDoc?.status === "Draft" &&
      !!myId &&
      !!ownerId &&
      myId === ownerId
    );
  }, [user, reqDoc]);

  /* ===================
     Load contracts + skills (wait for headersReady)
  =================== */
  useEffect(() => {
    if (!headersReady) return;

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
  }, [headersReady, authHeaders]);

  /* ===================
     Load request (IMPORTANT: send headers)
  =================== */
  const loadRequest = useCallback(async () => {
    if (!id) return;
    if (!headersReady) return;

    setLoading(true);
    setError("");

    try {
      const res = await apiGet(`/requests/${id}`, {
        headers: authHeaders,
      });

      const data = res.data || null;
      setReqDoc(data);

      if (!data) {
        setError("Request not found");
        setAvailableSubContracts([]);
      }
    } catch (err) {
      setReqDoc(null);
      setError(err?.response?.data?.error || "Error loading request");
      setAvailableSubContracts([]);
    } finally {
      setLoading(false);
    }
  }, [id, headersReady, authHeaders]);

  useEffect(() => {
    loadRequest();
  }, [loadRequest]);

  // When contracts or reqDoc.contract changes, update available subcontracts
  useEffect(() => {
    if (!reqDoc?.contract) return;
    const c = contracts.find((x) => x.contract === reqDoc.contract);
    setAvailableSubContracts(c?.subContract || []);
  }, [contracts, reqDoc?.contract]);

  /* ===================
     State helpers
  =================== */
  const update = (key, value) => setReqDoc((p) => ({ ...p, [key]: value }));

  const updatePosition = (i, patch) => {
    setReqDoc((p) => {
      const updated = [...(p?.positions || [])];
      updated[i] = { ...updated[i], ...patch };
      return { ...p, positions: updated };
    });
  };

  const setPositions = (arr) => setReqDoc((p) => ({ ...p, positions: arr }));

  /* ===================
     Contract change
  =================== */
  function handleContractChange(val) {
    const selected = contracts.find((c) => c.contract === val);
    const subs = selected?.subContract || [];
    setAvailableSubContracts(subs);

    setReqDoc((prev) => {
      if (!prev) return prev;

      let newPositions = prev.positions || [];

      if (prev.requestType === "Single" || prev.requestType === "Multi") {
        newPositions = [createPosition(subs[0] || "")];
      } else if (prev.requestType === "Team") {
        newPositions = newPositions.filter((p) => subs.includes(p.subContract));
        if (newPositions.length === 0 && subs.length)
          newPositions = [createPosition(subs[0])];
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
    setReqDoc((prev) => {
      if (!prev) return prev;

      let arr = prev.positions || [];
      if (arr.find((p) => p.subContract === sub))
        arr = arr.filter((p) => p.subContract !== sub);
      else arr = [...arr, createPosition(sub)];

      if (arr.length === 0) arr = [createPosition(sub)];
      return { ...prev, positions: arr };
    });
  }

  function addLanguage() {
    update("requiredLanguageSkills", [
      ...(reqDoc?.requiredLanguageSkills || [emptyLang]),
      { language: "English", level: "B2" },
    ]);
  }

  /* ===================
     Save
  =================== */
  async function handleSave(e) {
    e.preventDefault();
    if (!reqDoc) return;

    if (!headersReady) {
      setError("Missing auth headers. Please login again.");
      return;
    }

    if (!canEdit) {
      setError("Not allowed. Only owner PM can edit Draft requests.");
      return;
    }

    if (saveLockRef.current) return;
    saveLockRef.current = true;

    setSaving(true);
    setError("");

    try {
      // contractId must be string
      const contractId = oidToString(reqDoc.contractId);

      const payload = {
        title: reqDoc.title,
        contract: reqDoc.contract,
        contractId,

        requestType: reqDoc.requestType,
        positions: reqDoc.positions || [],

        commercialWeighting: Number(reqDoc.commercialWeighting) || 50,
        technicalWeighting: Number(reqDoc.technicalWeighting) || 50,

        maxOffersPerProvider: Number(reqDoc.maxOffersPerProvider) || 3,
        maxAcceptedOffers: Number(reqDoc.maxAcceptedOffers) || 1,

        requiredLanguageSkills: reqDoc.requiredLanguageSkills || [],
        sumOfManDays: Number(reqDoc.sumOfManDays) || 0,
        totalEmployees: Number(reqDoc.totalEmployees) || 1,
      };

      await apiPut(`/requests/${id}`, payload, {
        headers: authHeaders,
      });

      // ✅ FIX: go back to the request view page in your structure
      router.push(`/requests/${id}`);
    } catch (err) {
      setError(err?.response?.data?.error || "Error saving request");
    } finally {
      setSaving(false);
      saveLockRef.current = false;
    }
  }

  /* ===================
     RENDER STATES
  =================== */
  if (authLoading || !headersReady) {
    return (
      <main className="p-4">
        <p className="text-xs text-amber-300">
          Missing auth headers. Please login again.
        </p>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="p-4">
        <p className="text-xs text-slate-300">Loading...</p>
      </main>
    );
  }

  if (!reqDoc) {
    return (
      <main className="p-4 space-y-3">
        <p className="text-xs text-red-400">{error || "Request not found"}</p>
        <Link
          href="/requests"
          className="inline-block px-3 py-1.5 text-xs rounded-lg border border-slate-700 text-slate-200 hover:bg-slate-800"
        >
          Back
        </Link>
      </main>
    );
  }

  const { positions = [], requestType } = reqDoc;
  const singleOrMulti = requestType === "Single" || requestType === "Multi";
  const isTeam = requestType === "Team";

  return (
    <main className="space-y-5">
      {/* HEADER */}
      <section className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-semibold">Edit Request</h2>

          <p className="text-xs text-slate-400">
            <span className="text-slate-200">{reqDoc.title}</span> • Status:{" "}
            <span className="px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700">
              {reqDoc.status}
            </span>
          </p>

          {!canEdit && (
            <p className="text-[11px] text-amber-300 mt-1">
              Editing is disabled. Only the creator (PM) can edit Draft
              requests.
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={`/requests/${id}`}
            className="px-3 py-1.5 text-xs rounded-lg border border-slate-700 text-slate-200 hover:bg-slate-800"
          >
            View
          </Link>

          <button
            type="submit"
            form="editForm"
            disabled={!canEdit || saving}
            className="px-3 py-1.5 text-xs rounded-lg bg-emerald-500 text-black hover:bg-emerald-400 disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </section>

      {error && (
        <p className="text-xs text-red-400 border border-red-500/40 bg-red-500/10 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      {/* FORM */}
      <form
        id="editForm"
        onSubmit={handleSave}
        className="bg-slate-900/70 border border-slate-800 rounded-2xl shadow-lg p-6 space-y-8"
      >
        {/* BASIC INFO */}
        <div>
          <SectionTitle>Basic Information</SectionTitle>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label>Title</Label>
              <input
                required
                value={reqDoc.title || ""}
                onChange={(e) => update("title", e.target.value)}
                disabled={!canEdit}
                className="w-full rounded-lg bg-slate-800 px-3 py-2 disabled:opacity-60"
              />
            </div>

            <div>
              <Label>Request Type</Label>
              <select
                value={reqDoc.requestType || "Single"}
                onChange={(e) => update("requestType", e.target.value)}
                disabled={!canEdit}
                className="w-full rounded-lg bg-slate-800 px-3 py-2 disabled:opacity-60"
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
                value={reqDoc.contract || ""}
                onChange={(e) => handleContractChange(e.target.value)}
                disabled={!canEdit}
                className="w-full rounded-lg bg-slate-800 px-3 py-2 disabled:opacity-60"
              >
                <option value="">Select contract</option>
                {contracts.map((c) => (
                  <option key={c._id} value={c.contract}>
                    {c.contract}
                  </option>
                ))}
              </select>

              {!!reqDoc.contractId && (
                <p className="text-[10px] text-slate-500">
                  Contract ID: {oidToString(reqDoc.contractId)}
                </p>
              )}
            </div>

            {singleOrMulti && (
              <div>
                <Label>Sub Contract</Label>
                <select
                  value={positions[0]?.subContract || ""}
                  onChange={(e) =>
                    handleSingleSubContractChange(e.target.value)
                  }
                  disabled={!canEdit || !availableSubContracts.length}
                  className="w-full rounded-lg bg-slate-800 px-3 py-2 disabled:opacity-60"
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
                        disabled={!canEdit}
                        onClick={() => toggleTeamSubContract(s)}
                        className={
                          "px-3 py-1 rounded-full text-xs border disabled:opacity-60 " +
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

        {/* REQUIREMENTS */}
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
                    value={pos.role || ""}
                    className="w-full rounded-lg bg-slate-800 px-3 py-2 text-xs"
                  />
                </div>

                {(requestType === "Multi" || requestType === "Team") && (
                  <div>
                    <Label>Required Employees</Label>
                    <input
                      type="number"
                      min={1}
                      value={pos.employeesCount ?? 1}
                      onChange={(e) =>
                        updatePosition(index, {
                          employeesCount: Number(e.target.value),
                        })
                      }
                      disabled={!canEdit}
                      className="w-full rounded-lg bg-slate-800 px-3 py-2 text-xs disabled:opacity-60"
                    />
                  </div>
                )}

                <div>
                  <Label>Offered Salary (€ / hour)</Label>
                  <input
                    type="number"
                    min={0}
                    value={pos.offeredSalaryPerHour ?? 0}
                    onChange={(e) =>
                      updatePosition(index, {
                        offeredSalaryPerHour: Number(e.target.value),
                      })
                    }
                    disabled={!canEdit}
                    className="w-full rounded-lg bg-slate-800 px-3 py-2 text-xs disabled:opacity-60"
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-3 gap-4">
                <div>
                  <Label>Technology</Label>
                  <input
                    value={pos.technology || ""}
                    onChange={(e) =>
                      updatePosition(index, { technology: e.target.value })
                    }
                    disabled={!canEdit}
                    className="w-full rounded-lg bg-slate-800 px-3 py-2 text-xs disabled:opacity-60"
                  />
                </div>

                <div>
                  <Label>Experience Level</Label>
                  <input
                    value={pos.experienceLevel || ""}
                    onChange={(e) =>
                      updatePosition(index, { experienceLevel: e.target.value })
                    }
                    disabled={!canEdit}
                    className="w-full rounded-lg bg-slate-800 px-3 py-2 text-xs disabled:opacity-60"
                  />
                </div>

                <div>
                  <Label>Job Location</Label>
                  <select
                    value={pos.performanceLocation || "Onshore"}
                    onChange={(e) =>
                      updatePosition(index, {
                        performanceLocation: e.target.value,
                      })
                    }
                    disabled={!canEdit}
                    className="w-full rounded-lg bg-slate-800 px-3 py-2 text-xs disabled:opacity-60"
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
                    value={pos.startDate || ""}
                    onChange={(e) =>
                      updatePosition(index, { startDate: e.target.value })
                    }
                    disabled={!canEdit}
                    className="w-full rounded-lg bg-slate-800 px-3 py-2 text-xs disabled:opacity-60"
                  />
                </div>

                <div>
                  <Label>End Date</Label>
                  <input
                    type="date"
                    value={pos.endDate || ""}
                    onChange={(e) =>
                      updatePosition(index, { endDate: e.target.value })
                    }
                    disabled={!canEdit}
                    className="w-full rounded-lg bg-slate-800 px-3 py-2 text-xs disabled:opacity-60"
                  />
                </div>

                <div>
                  <Label>Total Days</Label>
                  <input
                    type="number"
                    min={0}
                    value={pos.manDays ?? 0}
                    onChange={(e) =>
                      updatePosition(index, { manDays: Number(e.target.value) })
                    }
                    disabled={!canEdit}
                    className="w-full rounded-lg bg-slate-800 px-3 py-2 text-xs disabled:opacity-60"
                  />
                </div>

                <div>
                  <Label>Hours / Day</Label>
                  <input
                    type="number"
                    min={1}
                    value={pos.hoursPerDay ?? 8}
                    onChange={(e) =>
                      updatePosition(index, {
                        hoursPerDay: Number(e.target.value),
                      })
                    }
                    disabled={!canEdit}
                    className="w-full rounded-lg bg-slate-800 px-3 py-2 text-xs disabled:opacity-60"
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <MultiSelect
                  label="Must-have Skills"
                  options={skillsList}
                  selected={pos.mustHaveSkills || []}
                  onChange={(v) => updatePosition(index, { mustHaveSkills: v })}
                />

                <MultiSelect
                  label="Nice-to-have Skills"
                  options={skillsList}
                  selected={pos.niceToHaveSkills || []}
                  disabledOptions={pos.mustHaveSkills || []}
                  onChange={(v) =>
                    updatePosition(index, { niceToHaveSkills: v })
                  }
                />
              </div>

              <div>
                <Label>Task Description</Label>
                <textarea
                  rows={2}
                  value={pos.taskDescription || ""}
                  onChange={(e) =>
                    updatePosition(index, { taskDescription: e.target.value })
                  }
                  disabled={!canEdit}
                  className="w-full rounded-lg bg-slate-800 px-3 py-2 text-xs disabled:opacity-60"
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
                value={reqDoc.commercialWeighting ?? 50}
                onChange={(e) =>
                  update("commercialWeighting", Number(e.target.value))
                }
                disabled={!canEdit}
                className="w-full rounded-lg bg-slate-800 px-3 py-2 disabled:opacity-60"
              />
            </div>

            <div>
              <Label>Technical Weighting (%)</Label>
              <input
                type="number"
                min={0}
                max={100}
                value={reqDoc.technicalWeighting ?? 50}
                onChange={(e) =>
                  update("technicalWeighting", Number(e.target.value))
                }
                disabled={!canEdit}
                className="w-full rounded-lg bg-slate-800 px-3 py-2 disabled:opacity-60"
              />
            </div>
          </div>

          <div className="space-y-2 mt-3">
            <Label>Required Languages</Label>

            {(reqDoc.requiredLanguageSkills || [emptyLang]).map((ls, i) => (
              <div key={i} className="grid grid-cols-2 gap-2">
                <select
                  value={ls.language}
                  onChange={(e) => {
                    const arr = [...(reqDoc.requiredLanguageSkills || [])];
                    arr[i] = { ...arr[i], language: e.target.value };
                    update("requiredLanguageSkills", arr);
                  }}
                  disabled={!canEdit}
                  className="rounded-lg bg-slate-800 px-3 py-2 text-xs disabled:opacity-60"
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
                    const arr = [...(reqDoc.requiredLanguageSkills || [])];
                    arr[i] = { ...arr[i], level: e.target.value };
                    update("requiredLanguageSkills", arr);
                  }}
                  disabled={!canEdit}
                  className="rounded-lg bg-slate-800 px-3 py-2 text-xs disabled:opacity-60"
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
              disabled={!canEdit}
              onClick={addLanguage}
              className="text-[11px] mt-1 px-3 py-1.5 border border-emerald-500/60 text-emerald-300 rounded-lg hover:bg-emerald-500/10 disabled:opacity-60"
            >
              + Add another language
            </button>
          </div>
        </div>
      </form>
    </main>
  );
}
