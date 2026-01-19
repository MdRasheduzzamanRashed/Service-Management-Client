"use client";

import { useEffect, useState } from "react";
import { apiGet } from "../lib/api";

export default function OffersList({ requestId }) {
  const [offers, setOffers] = useState([]);
  const [error, setError] = useState("");

  async function load() {
    try {
      const res = await apiGet(`/offers/${requestId}`);
      setOffers(res.data);
    } catch (err) {
      setError(err?.response?.data?.error || "Error loading offers");
    }
  }

  useEffect(() => {
    if (requestId) load();
  }, [requestId]);

  if (error) {
    return <p className="text-xs text-red-400">{error}</p>;
  }

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold">Supplier Offers</h3>
      {offers.map((o) => (
        <div
          key={o._id}
          className="border border-slate-800 rounded-xl px-3 py-2 text-xs bg-slate-900/70"
        >
          <div className="flex items-center justify-between">
            <span className="font-medium">{o.providerName}</span>
            <span>
              {o.price} {o.currency}
            </span>
          </div>
          {o.notes && (
            <p className="text-[11px] text-slate-300 mt-1">{o.notes}</p>
          )}
        </div>
      ))}
      {offers.length === 0 && (
        <p className="text-xs text-slate-400">No offers yet.</p>
      )}
    </div>
  );
}
