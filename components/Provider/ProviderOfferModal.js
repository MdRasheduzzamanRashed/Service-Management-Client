"use client";

import { useMemo, useState } from "react";
import { saveMockOffer } from '../../lib/providerOffersMock';

function normalizeId(raw) {
  if (!raw) return "";
  if (typeof raw === "string") return raw;
  if (raw?.$oid) return String(raw.$oid);
  return String(raw);
}

export default function ProviderOfferModal({ request, onClose, onSubmitted }) {
  const requestId = useMemo(
    () => normalizeId(request?._id || request?.id),
    [request],
  );

  const maxOffers = Number(request?.maxOffers ?? 3);

  const [form, setForm] = useState({
    supplierName: request?.contractSupplier || "",
    priceTotal: "",
    deliveryDays: "",
    notes: "",
  });

  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  function onChange(e) {
    setForm((p) => ({ ...p, [e.target.name]: e.target.value }));
  }

  async function submit() {
    setErr("");
    setOk("");

    if (!requestId) return setErr("Missing requestId");
    if (!form.supplierName.trim()) return setErr("Supplier name required");
    if (!form.priceTotal || Number(form.priceTotal) <= 0)
      return setErr("Price must be > 0");
    if (!form.deliveryDays || Number(form.deliveryDays) <= 0)
      return setErr("Delivery days must be > 0");

    try {
      setSaving(true);

      // ✅ Frontend mock save
      saveMockOffer({
        requestId,
        maxOffers,
        offer: {
          supplierName: form.supplierName.trim(),
          priceTotal: Number(form.priceTotal),
          deliveryDays: Number(form.deliveryDays),
          notes: form.notes?.trim() || "",
        },
      });

      setOk("Offer submitted (mock).");
      onSubmitted?.();
    } catch (e) {
      setErr(e?.message || "Submit failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="w-full max-w-xl rounded-2xl border border-slate-800 bg-slate-950 p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-slate-100">
              Submit Offer
            </h3>
            <p className="text-xs text-slate-400 truncate">
              {request?.title || "Untitled"} • maxOffers: {maxOffers}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-xs px-2 py-1 rounded-lg border border-slate-700 hover:bg-slate-900"
          >
            ✕
          </button>
        </div>

        {err && (
          <div className="text-xs text-red-300 bg-red-950/40 border border-red-700/40 px-3 py-2 rounded-xl">
            {err}
          </div>
        )}
        {ok && (
          <div className="text-xs text-emerald-200 bg-emerald-950/30 border border-emerald-800/40 px-3 py-2 rounded-xl">
            {ok}
          </div>
        )}

        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
          <div>
            <label className="text-[11px] text-slate-400">Supplier Name</label>
            <input
              name="supplierName"
              value={form.supplierName}
              onChange={onChange}
              className="mt-1 w-full border border-slate-700 rounded-xl px-3 py-2 bg-slate-900/40 text-sm"
            />
          </div>

          <div>
            <label className="text-[11px] text-slate-400">
              Total Price (EUR)
            </label>
            <input
              name="priceTotal"
              type="number"
              value={form.priceTotal}
              onChange={onChange}
              className="mt-1 w-full border border-slate-700 rounded-xl px-3 py-2 bg-slate-900/40 text-sm"
            />
          </div>

          <div>
            <label className="text-[11px] text-slate-400">Delivery Days</label>
            <input
              name="deliveryDays"
              type="number"
              value={form.deliveryDays}
              onChange={onChange}
              className="mt-1 w-full border border-slate-700 rounded-xl px-3 py-2 bg-slate-900/40 text-sm"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="text-[11px] text-slate-400">Notes</label>
            <textarea
              name="notes"
              value={form.notes}
              onChange={onChange}
              className="mt-1 w-full border border-slate-700 rounded-xl px-3 py-2 bg-slate-900/40 text-sm min-h-[90px]"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-700 hover:bg-slate-900 text-sm"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={submit}
            disabled={saving}
            className="px-4 py-2 rounded-xl bg-emerald-500 text-black text-sm font-semibold hover:bg-emerald-400 disabled:opacity-60"
          >
            {saving ? "Submitting..." : "Submit Offer"}
          </button>
        </div>
      </div>
    </div>
  );
}
