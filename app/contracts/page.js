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
  // simple ISO check
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
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="absolute inset-0 bg-black/60" />

      <div className="relative z-10 w-full max-w-3xl rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-slate-800 px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-100">
              Contract Details
            </h2>
          </div>

          <button
            onClick={onClose}
            className="rounded-lg border border-slate-700 bg-slate-950/30 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800 transition"
          >
            Close
          </button>
        </div>

        <div className="max-h-[75vh] overflow-y-auto px-5 py-4">
          {/* Nice summary (your main fields) */}
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

            <Field label="Description">
              <div className="whitespace-pre-wrap">
                {contract?.description || "—"}
              </div>
            </Field>
            <Field label="Roles">
              <div className="flex flex-wrap gap-2">
                {Array.isArray(contract?.roles) && contract.roles.length > 0 ? (
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
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Contracts</h1>
            <p className="mt-1 text-sm text-slate-400">
              Click a row to open full details modal.
            </p>
          </div>

          <Link
            href="/dashboard"
            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800 transition"
          >
            ← Back
          </Link>
        </div>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            {["all", "active", "expired"].map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`rounded-lg px-3 py-2 text-sm border transition ${
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

          <div className="w-full sm:w-96">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search anything..."
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 outline-none focus:border-emerald-400/60"
            />
          </div>
        </div>

        <div className="mt-5 rounded-xl border border-slate-800 bg-slate-900/40">
          {loading ? (
            <div className="p-5 text-sm text-slate-300">
              Loading contracts...
            </div>
          ) : err ? (
            <div className="p-5 text-sm text-red-300">{err}</div>
          ) : filtered.length === 0 ? (
            <div className="p-5 text-sm text-slate-300">
              No contracts found.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-slate-300">
                  <tr className="border-b border-slate-800">
                    <th className="px-4 py-3">Supplier</th>
                    <th className="px-4 py-3">Description</th>
                    <th className="px-4 py-3">Domain</th>
                    <th className="px-4 py-3">Start</th>
                    <th className="px-4 py-3">End</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>

                <tbody>
                  {filtered.map((c) => (
                    <tr
                      key={c?.id}
                      onClick={() => openModal(c)}
                      className="cursor-pointer border-b border-slate-800/70 hover:bg-slate-800/40 transition"
                    >
                      <td className="px-4 py-3 font-medium text-slate-100">
                        {c?.supplier || "—"}
                      </td>
                      <td className="px-4 py-3 text-slate-300">
                        <div className="max-w-md truncate">
                          {c?.description || "—"}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-300">
                        {c?.domain || "—"}
                      </td>
                      <td className="px-4 py-3 text-slate-300">
                        {toDateText(c?.startDate)}
                      </td>
                      <td className="px-4 py-3 text-slate-300">
                        {toDateText(c?.endDate)}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={c?.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <ContractModal open={open} onClose={closeModal} contract={selected} />
    </div>
  );
}
