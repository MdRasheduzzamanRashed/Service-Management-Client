"use client";

import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import Link from "next/link";

const CONTRACTS_API = process.env.NEXT_PUBLIC_CONTRACTS_API;

function toDateText(v) {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleDateString("en-GB", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

function isIsoDateString(v) {
  if (typeof v !== "string") return false;
  return /^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:\d{2})?)?$/.test(
    v,
  );
}

function formatPrimitive(v) {
  if (v === null || v === undefined) return "—";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (typeof v === "number") return String(v);
  if (typeof v === "string") {
    const s = v.trim();
    if (!s) return "—";
    if (isIsoDateString(s)) return toDateText(s);
    return s;
  }
  return String(v);
}

function StatusBadge({ status }) {
  const s = String(status || "").toLowerCase();
  const base =
    "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold border";

  if (s === "active")
    return (
      <span
        className={`${base} border-emerald-400/40 text-emerald-300 bg-emerald-500/10`}
      >
        Active
      </span>
    );

  if (s === "expired")
    return (
      <span className={`${base} border-red-400/40 text-red-300 bg-red-500/10`}>
        Expired
      </span>
    );

  return (
    <span
      className={`${base} border-slate-500/40 text-slate-300 bg-slate-500/10`}
    >
      {status || "Unknown"}
    </span>
  );
}

function Field({ label, children }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-3">
      <div className="text-[11px] uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className="mt-1 text-sm text-slate-100 break-words">{children}</div>
    </div>
  );
}

/* =========================
   UI: Skeletons (UI only)
========================= */
function SkeletonLine({ w = "w-full" }) {
  return <div className={`h-3 ${w} rounded bg-slate-800/70 animate-pulse`} />;
}

function ContractCardSkeleton() {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-2">
          <SkeletonLine w="w-1/2" />
          <SkeletonLine w="w-4/5" />
        </div>
        <div className="h-5 w-20 rounded-full bg-slate-800/70 animate-pulse" />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3 space-y-2">
          <SkeletonLine w="w-1/2" />
          <SkeletonLine w="w-2/3" />
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3 space-y-2">
          <SkeletonLine w="w-1/2" />
          <SkeletonLine w="w-2/3" />
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3 col-span-2 space-y-2">
          <SkeletonLine w="w-1/3" />
          <SkeletonLine w="w-5/6" />
        </div>
      </div>

      <div className="mt-4 flex justify-end">
        <div className="h-9 w-24 rounded-xl bg-slate-800/70 animate-pulse" />
      </div>
    </div>
  );
}

function ContractModal({ open, onClose, contract }) {
  useEffect(() => {
    if (!open) return;

    function onKeyDown(e) {
      if (e.key === "Escape") onClose();
    }

    document.addEventListener("keydown", onKeyDown);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open || !contract) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4"
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="absolute inset-0 bg-black/60" />

      <div className="relative z-10 w-full max-w-3xl rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl max-h-[92vh] overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 border-b border-slate-800 px-4 sm:px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-slate-100">
              Contract Details
            </h2>
          </div>

          <button
            onClick={onClose}
            className="w-full sm:w-auto rounded-lg border border-slate-700 bg-slate-950/30 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800 transition active:scale-[0.99]"
          >
            Close
          </button>
        </div>

        <div className="max-h-[75vh] overflow-y-auto px-4 sm:px-5 py-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Supplier">
              {formatPrimitive(contract?.supplier)}
            </Field>
            <Field label="Domain">{formatPrimitive(contract?.domain)}</Field>
            <Field label="Start Date">{toDateText(contract?.startDate)}</Field>
            <Field label="End Date">{toDateText(contract?.endDate)}</Field>
            <Field label="Status">
              <StatusBadge status={contract?.status} />
            </Field>

            <div className="sm:col-span-2">
              <Field label="Description">
                <div className="whitespace-pre-wrap">
                  {contract?.description || "—"}
                </div>
              </Field>
            </div>

            <div className="sm:col-span-2">
              <Field label="Roles">
                <div className="flex flex-wrap gap-2">
                  {Array.isArray(contract?.roles) &&
                  contract.roles.length > 0 ? (
                    contract.roles.map((r, i) => (
                      <span
                        key={i}
                        className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-200"
                      >
                        {r?.role || r?.name || "—"}
                      </span>
                    ))
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </div>
              </Field>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-800 px-4 sm:px-5 py-4">
          <button
            onClick={onClose}
            className="w-full sm:w-auto rounded-lg border border-slate-700 bg-slate-950/30 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800 transition active:scale-[0.99]"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ContractsPage() {
  const [contracts, setContracts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [tab, setTab] = useState("all");
  const [q, setQ] = useState("");

  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    let alive = true;

    async function load() {
      setLoading(true);
      setErr("");

      try {
        const res = await axios.get(CONTRACTS_API, {
          headers: { Accept: "application/json" },
        });
        const data = res.data;

        const list =
          (Array.isArray(data) && data) ||
          (Array.isArray(data?.data) && data.data) ||
          (Array.isArray(data?.contracts) && data.contracts) ||
          [];

        if (alive) setContracts(list);
      } catch (e) {
        if (!alive) return;
        setErr(e?.message || "Failed to load contracts");
      } finally {
        if (alive) setLoading(false);
      }
    }

    load();
    return () => {
      alive = false;
    };
  }, []);

  const counts = useMemo(() => {
    const active = contracts.filter(
      (c) => String(c?.status || "").toLowerCase() === "active",
    ).length;
    const expired = contracts.filter(
      (c) => String(c?.status || "").toLowerCase() === "expired",
    ).length;
    return { all: contracts.length, active, expired };
  }, [contracts]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return contracts
      .filter((c) => {
        const s = String(c?.status || "").toLowerCase();
        if (tab === "active") return s === "active";
        if (tab === "expired") return s === "expired";
        return true;
      })
      .filter((c) => {
        if (!needle) return true;
        return JSON.stringify(c || {})
          .toLowerCase()
          .includes(needle);
      });
  }, [contracts, tab, q]);

  function openModal(contract) {
    setSelected(contract);
    setOpen(true);
  }

  function closeModal() {
    setOpen(false);
    setSelected(null);
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-7xl px-4 py-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Contracts</h1>
            <p className="mt-1 text-sm text-slate-400">
              Tap a card to open full details.
            </p>
          </div>

          <Link
            href="/dashboard"
            className="w-full sm:w-auto text-center rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800 transition"
          >
            ← Back
          </Link>
        </div>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            {["all", "active", "expired"].map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`rounded-lg px-3 py-2 text-sm border transition active:scale-[0.99] ${
                  tab === t
                    ? "border-emerald-400/60 bg-emerald-500/10 text-emerald-200"
                    : "border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800"
                }`}
              >
                {t.charAt(0).toUpperCase() + t.slice(1)}{" "}
                <span className="ml-1 text-slate-400">({counts[t]})</span>
              </button>
            ))}
          </div>

          <div className="w-full sm:w-96 relative">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search anything..."
              className="w-full rounded-lg border border-slate-700 bg-slate-900 pl-3 pr-20 py-2 text-sm text-slate-100 placeholder:text-slate-500 outline-none focus:border-emerald-400/60"
            />
            {q?.trim() ? (
              <button
                type="button"
                onClick={() => setQ("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md border border-slate-700 bg-slate-950/30 px-2 py-1 text-[11px] text-slate-200 hover:bg-slate-800 transition active:scale-[0.99]"
              >
                Clear
              </button>
            ) : null}
          </div>
        </div>

        {/* Cards */}
        <div className="mt-5">
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <ContractCardSkeleton key={i} />
              ))}
            </div>
          ) : err ? (
            <div className="rounded-xl border border-red-900/40 bg-red-950/20 p-5 text-sm text-red-200">
              {err}
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 text-sm text-slate-300">
              No contracts found.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {filtered.map((c) => (
                <button
                  key={c?.id}
                  type="button"
                  onClick={() => openModal(c)}
                  className="text-left rounded-2xl border border-slate-800 bg-slate-900/40 p-4 hover:bg-slate-900/60 hover:border-slate-700 transition active:scale-[0.99]"
                  title="Click to view"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-slate-100 truncate">
                        {c?.supplier || "—"}
                      </div>
                      <div className="mt-1 text-xs text-slate-400 line-clamp-2">
                        {c?.description || "—"}
                      </div>
                    </div>

                    <div className="shrink-0">
                      <StatusBadge status={c?.status} />
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
                      <div className="text-[11px] uppercase tracking-wide text-slate-500">
                        Domain
                      </div>
                      <div className="mt-1 text-sm text-slate-100">
                        {c?.domain || "—"}
                      </div>
                    </div>

                    <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
                      <div className="text-[11px] uppercase tracking-wide text-slate-500">
                        Start
                      </div>
                      <div className="mt-1 text-sm text-slate-100">
                        {toDateText(c?.startDate)}
                      </div>
                    </div>

                    <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
                      <div className="text-[11px] uppercase tracking-wide text-slate-500">
                        End
                      </div>
                      <div className="mt-1 text-sm text-slate-100">
                        {toDateText(c?.endDate)}
                      </div>
                    </div>

                    <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
                      <div className="text-[11px] uppercase tracking-wide text-slate-500">
                        Status
                      </div>
                      <div className="mt-1">
                        <StatusBadge status={c?.status} />
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-end gap-2">
                    <span className="text-xs text-slate-400">
                      Click to view details
                    </span>
                    <span className="text-xs rounded-lg border border-slate-700 bg-slate-950/30 px-3 py-2 text-slate-200">
                      Open
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <ContractModal open={open} onClose={closeModal} contract={selected} />
    </div>
  );
}
