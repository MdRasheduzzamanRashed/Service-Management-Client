"use client";

import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import Link from "next/link";

// ✅ NEW API (approved contracts)
const CONTRACTS_API =
  process.env.NEXT_PUBLIC_CONTRACTS_API ||
  "https://contact-management-three-jade.vercel.app/api/public/approved-contracts";

function toDateText(v) {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

function toDateTimeText(v) {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-GB", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function moneyRange(budget) {
  const min = Number(budget?.minimum);
  const max = Number(budget?.maximum);
  const cur = String(budget?.currency || "EUR");
  const okMin = Number.isFinite(min);
  const okMax = Number.isFinite(max);
  if (okMin && okMax)
    return `${min.toLocaleString()}–${max.toLocaleString()} ${cur}`;
  if (okMin) return `≥ ${min.toLocaleString()} ${cur}`;
  if (okMax) return `≤ ${max.toLocaleString()} ${cur}`;
  return "—";
}

function computeLifecycle({ startDate, endDate }) {
  const now = Date.now();
  const s = startDate ? new Date(startDate).getTime() : NaN;
  const e = endDate ? new Date(endDate).getTime() : NaN;

  if (!Number.isFinite(s) || !Number.isFinite(e)) return "UNKNOWN";
  if (now < s) return "UPCOMING";
  if (now > e) return "ENDED";
  return "ACTIVE";
}

function lifecycleBadgeClass(life) {
  const base =
    "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold border";
  if (life === "UPCOMING")
    return `${base} border-sky-400/40 text-sky-300 bg-sky-500/10`;
  if (life === "ACTIVE")
    return `${base} border-emerald-400/40 text-emerald-300 bg-emerald-500/10`;
  if (life === "ENDED")
    return `${base} border-rose-400/40 text-rose-300 bg-rose-500/10`;
  return `${base} border-slate-500/40 text-slate-300 bg-slate-500/10`;
}

function LifecycleBadge({ value }) {
  const life = String(value || "UNKNOWN").toUpperCase();
  const label =
    life === "UPCOMING"
      ? "Upcoming"
      : life === "ACTIVE"
        ? "Active"
        : life === "ENDED"
          ? "Ended"
          : "Unknown";
  return <span className={lifecycleBadgeClass(life)}>{label}</span>;
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
   UI: Skeletons
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

/* =========================
   Normalize NEW API shape
========================= */
function extractList(payload) {
  // API returns: { success, statusCode, message, data:[...], pagination }
  const data = payload?.data;
  return Array.isArray(data) ? data : [];
}

function normalizeContract(raw) {
  const c = raw || {};

  const providerName =
    c?.workflow?.coordinator?.selectedOffer?.provider?.name || "";

  const offerAmount =
    c?.workflow?.coordinator?.selectedOffer?.offerAmount?.amount ?? null;

  const offerCurrency =
    c?.workflow?.coordinator?.selectedOffer?.offerAmount?.currency || "";

  const proposedStart =
    c?.workflow?.coordinator?.selectedOffer?.proposedTimeline?.startDate || "";

  const proposedEnd =
    c?.workflow?.coordinator?.selectedOffer?.proposedTimeline?.endDate || "";

  const approvedAt = c?.workflow?.finalApproval?.approvedAt || "";

  const life = computeLifecycle({
    startDate: c?.startDate,
    endDate: c?.endDate,
  });

  return {
    _raw: c,
    id: String(c?._id || "").trim(),
    referenceNumber: String(c?.referenceNumber || "").trim(),
    title: String(c?.title || "").trim(),
    contractType: String(c?.contractType || "").trim(),
    description: String(c?.description || "").trim(),
    targetPersons: Number.isFinite(Number(c?.targetPersons))
      ? Number(c?.targetPersons)
      : null,
    budget: c?.budget || null,
    startDate: c?.startDate || "",
    endDate: c?.endDate || "",
    lifecycle: life,

    providerName,
    offerAmount,
    offerCurrency,
    proposedStart,
    proposedEnd,
    approvedAt,
  };
}

function joinHay(c) {
  return [
    c?.referenceNumber,
    c?.title,
    c?.contractType,
    c?.description,
    c?.providerName,
    c?.offerCurrency,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

/* =========================
   Modal
========================= */
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
      className="fixed inset-0 z-[999] flex items-center justify-center p-2 sm:p-4"
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
            <div className="mt-1 text-xs text-slate-400 break-words">
              Ref:{" "}
              <span className="text-slate-200">
                {contract.referenceNumber || "—"}
              </span>
              {" · "}
              <LifecycleBadge value={contract.lifecycle} />
            </div>
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
            <Field label="Title">{contract.title || "—"}</Field>
            <Field label="Contract Type">{contract.contractType || "—"}</Field>

            <Field label="Start Date">{toDateText(contract.startDate)}</Field>
            <Field label="End Date">{toDateText(contract.endDate)}</Field>

            <Field label="Target Persons">
              {contract.targetPersons ?? "—"}
            </Field>
            <Field label="Budget">{moneyRange(contract.budget)}</Field>

            <Field label="Selected Provider">
              {contract.providerName || "—"}
            </Field>
            <Field label="Selected Offer Amount">
              {contract.offerAmount != null
                ? `${Number(contract.offerAmount).toLocaleString()} ${
                    contract.offerCurrency || "EUR"
                  }`
                : "—"}
            </Field>

            <Field label="Proposed Timeline Start">
              {toDateText(contract.proposedStart)}
            </Field>
            <Field label="Proposed Timeline End">
              {toDateText(contract.proposedEnd)}
            </Field>

            <Field label="Final Approved At">
              {toDateTimeText(contract.approvedAt)}
            </Field>
            <Field label="Internal ID">{contract.id || "—"}</Field>

            <div className="sm:col-span-2">
              <Field label="Description">
                <div className="whitespace-pre-wrap">
                  {contract.description || "—"}
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

/* =========================
   Page
========================= */
export default function ContractsPage() {
  const [contracts, setContracts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // tabs: all | upcoming | active | ended | type
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
          params: { _t: Date.now() },
          timeout: 15000,
        });

        const list = extractList(res?.data)
          .map(normalizeContract)
          .filter((c) => c.id);

        if (!alive) return;
        setContracts(list);
      } catch (e) {
        if (!alive) return;
        const msg =
          e?.response?.data?.message ||
          e?.response?.data?.error ||
          e?.message ||
          "Failed to load contracts";
        setErr(String(msg));
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    }

    load();
    return () => {
      alive = false;
    };
  }, []);

  const typeCounts = useMemo(() => {
    const m = new Map();
    for (const c of contracts) {
      const t = String(c?.contractType || "Unknown").trim() || "Unknown";
      m.set(t, (m.get(t) || 0) + 1);
    }
    return Array.from(m.entries())
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count);
  }, [contracts]);

  const counts = useMemo(() => {
    const upcoming = contracts.filter((c) => c.lifecycle === "UPCOMING").length;
    const active = contracts.filter((c) => c.lifecycle === "ACTIVE").length;
    const ended = contracts.filter((c) => c.lifecycle === "ENDED").length;
    return { all: contracts.length, upcoming, active, ended };
  }, [contracts]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();

    return contracts
      .filter((c) => {
        if (tab === "upcoming") return c.lifecycle === "UPCOMING";
        if (tab === "active") return c.lifecycle === "ACTIVE";
        if (tab === "ended") return c.lifecycle === "ENDED";
        if (tab.startsWith("type:")) {
          const t = tab.slice("type:".length);
          return String(c.contractType || "") === t;
        }
        return true;
      })
      .filter((c) => {
        if (!needle) return true;
        return joinHay(c).includes(needle);
      })
      .sort((a, b) => {
        // keep Active first, then Upcoming, then Ended; within groups by start date
        const order = { ACTIVE: 0, UPCOMING: 1, ENDED: 2, UNKNOWN: 3 };
        const oa = order[a.lifecycle] ?? 9;
        const ob = order[b.lifecycle] ?? 9;
        if (oa !== ob) return oa - ob;

        const sa = a.startDate ? new Date(a.startDate).getTime() : 0;
        const sb = b.startDate ? new Date(b.startDate).getTime() : 0;
        return sa - sb;
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

  const topTypeTabs = typeCounts.slice(0, 3); // show top 3 types as quick tabs

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-7xl px-4 py-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Approved Contracts</h1>
            <p className="mt-1 text-sm text-slate-400">
              These are final approved contracts. Tap a card to open full
              details.
            </p>
          </div>

          <Link
            href="/dashboard"
            className="w-full sm:w-auto text-center rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800 transition"
          >
            ← Back
          </Link>
        </div>

        {/* Tabs + Search */}
        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            {[
              ["all", `All (${counts.all})`],
              ["upcoming", `Upcoming (${counts.upcoming})`],
              ["active", `Active (${counts.active})`],
              ["ended", `Ended (${counts.ended})`],
            ].map(([key, label]) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`rounded-lg px-3 py-2 text-sm border transition active:scale-[0.99] ${
                  tab === key
                    ? "border-emerald-400/60 bg-emerald-500/10 text-emerald-200"
                    : "border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800"
                }`}
              >
                {label}
              </button>
            ))}

            {/* Quick type tabs (top 3) */}
            {topTypeTabs.map((t) => {
              const key = `type:${t.type}`;
              const label = `${t.type} (${t.count})`;
              return (
                <button
                  key={key}
                  on
                  حالClick={() => setTab(key)}
                  className={`rounded-lg px-3 py-2 text-sm border transition active:scale-[0.99] ${
                    tab === key
                      ? "border-sky-400/60 bg-sky-500/10 text-sky-200"
                      : "border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800"
                  }`}
                  title="Filter by Contract Type"
                >
                  {label}
                </button>
              );
            })}
          </div>

          <div className="w-full sm:w-96 relative">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search title, reference, type, provider..."
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
                  key={c.id}
                  type="button"
                  onClick={() => openModal(c)}
                  className="text-left rounded-2xl border border-slate-800 bg-slate-900/40 p-4 hover:bg-slate-900/60 hover:border-slate-700 transition active:scale-[0.99]"
                  title="Click to view"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-slate-100 truncate">
                        {c.title || "—"}
                      </div>
                      <div className="mt-1 text-xs text-slate-400 break-words">
                        Ref:{" "}
                        <span className="text-slate-200">
                          {c.referenceNumber || "—"}
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-slate-500 line-clamp-2">
                        {c.description || "—"}
                      </div>
                    </div>

                    <div className="shrink-0 flex flex-col items-end gap-2">
                      <LifecycleBadge value={c.lifecycle} />
                      <span className="text-[11px] text-slate-400">
                        {c.contractType || "—"}
                      </span>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
                      <div className="text-[11px] uppercase tracking-wide text-slate-500">
                        Provider
                      </div>
                      <div className="mt-1 text-sm text-slate-100 truncate">
                        {c.providerName || "—"}
                      </div>
                    </div>

                    <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
                      <div className="text-[11px] uppercase tracking-wide text-slate-500">
                        Budget
                      </div>
                      <div className="mt-1 text-sm text-slate-100">
                        {moneyRange(c.budget)}
                      </div>
                    </div>

                    <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
                      <div className="text-[11px] uppercase tracking-wide text-slate-500">
                        Start
                      </div>
                      <div className="mt-1 text-sm text-slate-100">
                        {toDateText(c.startDate)}
                      </div>
                    </div>

                    <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3">
                      <div className="text-[11px] uppercase tracking-wide text-slate-500">
                        End
                      </div>
                      <div className="mt-1 text-sm text-slate-100">
                        {toDateText(c.endDate)}
                      </div>
                    </div>

                    <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3 col-span-2">
                      <div className="text-[11px] uppercase tracking-wide text-slate-500">
                        Selected Offer
                      </div>
                      <div className="mt-1 text-sm text-slate-100">
                        {c.offerAmount != null
                          ? `${Number(c.offerAmount).toLocaleString()} ${
                              c.offerCurrency || "EUR"
                            }`
                          : "—"}
                        <span className="text-slate-500">
                          {" "}
                          · Approved {toDateText(c.approvedAt)}
                        </span>
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
