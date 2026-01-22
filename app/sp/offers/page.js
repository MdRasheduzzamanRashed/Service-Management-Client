"use client";

import { useMemo, useState } from "react";
import { getAllMockOffers } from "@/lib/providerOffersMock";

export default function ProviderOffersPage() {
  const [reload, setReload] = useState(0);

  const all = useMemo(() => {
    const store = getAllMockOffers();
    return Object.values(store || {});
  }, [reload]);

  return (
    <main className="space-y-4">
      <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4 flex items-end justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-100">
            Service Provider — My Mock Offers
          </h1>
          <p className="text-xs text-slate-400">
            Stored in localStorage (testing)
          </p>
        </div>

        <button
          type="button"
          onClick={() => setReload((x) => x + 1)}
          className="px-3 py-2 rounded-xl border border-slate-700 text-sm hover:bg-slate-800"
        >
          Refresh
        </button>
      </div>

      <div className="space-y-3">
        {all.map((entry) => (
          <div
            key={entry.requestId}
            className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4"
          >
            <div className="text-sm text-slate-200 font-semibold">
              Request:{" "}
              <span className="text-emerald-300">{entry.requestId}</span>
            </div>
            <div className="text-xs text-slate-400 mt-1">
              maxOffers:{" "}
              <span className="text-slate-200">{entry.maxOffers}</span> • saved
              offers:{" "}
              <span className="text-slate-200">
                {(entry.bestOffers || []).length}
              </span>
            </div>

            <div className="mt-3 overflow-x-auto rounded-xl border border-slate-800">
              <table className="min-w-[850px] w-full text-sm">
                <thead className="bg-slate-950/60 text-[11px] text-slate-400">
                  <tr className="text-left">
                    <th className="px-3 py-2">Supplier</th>
                    <th className="px-3 py-2">Price</th>
                    <th className="px-3 py-2">Delivery Days</th>
                    <th className="px-3 py-2">Submitted</th>
                    <th className="px-3 py-2">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {(entry.bestOffers || []).map((o) => (
                    <tr key={o.offerId} className="border-t border-slate-800">
                      <td className="px-3 py-2 text-slate-100">
                        {o.supplierName}
                      </td>
                      <td className="px-3 py-2 text-slate-300">
                        {o.priceTotal} {o.currency || "EUR"}
                      </td>
                      <td className="px-3 py-2 text-slate-300">
                        {o.deliveryDays}
                      </td>
                      <td className="px-3 py-2 text-slate-300">
                        {new Date(o.submittedAt).toLocaleString()}
                      </td>
                      <td className="px-3 py-2 text-slate-300">
                        {o.notes || "—"}
                      </td>
                    </tr>
                  ))}

                  {(entry.bestOffers || []).length === 0 && (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-3 py-4 text-xs text-slate-400"
                      >
                        No offers yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ))}

        {all.length === 0 && (
          <div className="text-xs text-slate-400 p-4">
            No offers stored yet. Go to{" "}
            <span className="text-slate-200">/provider/bidding</span> and submit
            some offers.
          </div>
        )}
      </div>
    </main>
  );
}
