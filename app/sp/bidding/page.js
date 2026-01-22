"use client";

import { useEffect, useMemo, useState, useContext } from "react";
import toast from "react-hot-toast";
import { AuthContext } from "../../../context/AuthContext";
import { apiGet, apiPost } from "../../../lib/api";

export default function SPBiddingPage() {
  const { user, authHeaders } = useContext(AuthContext);
  const role = String(user?.role || "").toUpperCase();

  const [list, setList] = useState([]);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const [open, setOpen] = useState(false);
  const [activeReq, setActiveReq] = useState(null);

  async function load() {
    try {
      setErr("");
      setLoading(true);
      const res = await apiGet("/requests/bidding"); // public endpoint
      setList(Array.isArray(res?.data) ? res.data : []);
    } catch (e) {
      setErr(e?.response?.data?.error || "Failed to load bidding requests");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  if (!user) return <div className="p-4 text-slate-300">Login first</div>;
  if (role !== "SERVICE_PROVIDER")
    return (
      <div className="p-4 text-red-300">Only SERVICE_PROVIDER can access</div>
    );

  return (
    <main className="space-y-4 p-4">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-100">
            Open Bidding Requests
          </h1>
          <p className="text-xs text-slate-400">
            Submit offers against each request.
          </p>
        </div>

        <button
          onClick={load}
          className="px-3 py-2 rounded-xl border border-slate-700 text-sm text-slate-200 hover:bg-slate-800"
        >
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      {err && <p className="text-xs text-red-400">{err}</p>}

      <div className="overflow-x-auto rounded-xl border border-slate-800">
        <table className="min-w-[900px] w-full text-sm">
          <thead className="bg-slate-950/60 text-[11px] text-slate-400">
            <tr>
              <th className="px-3 py-2 text-left">Title</th>
              <th className="px-3 py-2 text-left">Project</th>
              <th className="px-3 py-2 text-left">Max Offers</th>
              <th className="px-3 py-2 text-left">Started</th>
              <th className="px-3 py-2 text-right">Action</th>
            </tr>
          </thead>

          <tbody>
            {list.map((r) => (
              <tr
                key={r._id}
                className="border-t border-slate-800 hover:bg-slate-950/30"
              >
                <td className="px-3 py-2 text-slate-100">
                  {r.title || "Untitled"}
                </td>
                <td className="px-3 py-2 text-slate-300">
                  {r.projectName || r.projectId || "—"}
                </td>
                <td className="px-3 py-2 text-slate-300">
                  {r.maxOffers ?? "—"}
                </td>
                <td className="px-3 py-2 text-slate-300">
                  {r.biddingStartedAt
                    ? new Date(r.biddingStartedAt).toLocaleString()
                    : "—"}
                </td>
                <td className="px-3 py-2 text-right">
                  <button
                    className="px-3 py-1.5 rounded-lg bg-emerald-500 text-black text-xs hover:bg-emerald-400"
                    onClick={() => {
                      setActiveReq(r);
                      setOpen(true);
                    }}
                  >
                    Submit Offer
                  </button>
                </td>
              </tr>
            ))}

            {!loading && list.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-xs text-slate-400">
                  No bidding requests.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {open && activeReq && (
        <OfferModal
          reqDoc={activeReq}
          onClose={() => setOpen(false)}
          onSubmit={async (payload) => {
            const tId = toast.loading("Submitting offer...");
            try {
              await apiPost("/offers", payload, { headers: authHeaders });
              toast.success("Offer submitted!", { id: tId });
              setOpen(false);
              load(); // refresh list if needed
            } catch (e) {
              toast.error(e?.response?.data?.error || "Submit failed", {
                id: tId,
              });
              throw e;
            }
          }}
        />
      )}
    </main>
  );
}

function OfferModal({ reqDoc, onClose, onSubmit }) {
  const [price, setPrice] = useState("");
  const [deliveryDays, setDeliveryDays] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const rolesText = useMemo(() => {
    const roles = Array.isArray(reqDoc.roles) ? reqDoc.roles : [];
    return roles
      .map((x) => x?.roleName)
      .filter(Boolean)
      .join(", ");
  }, [reqDoc]);

  async function submit() {
    try {
      setErr("");
      setSaving(true);

      const rolesProvided = (reqDoc.roles || []).map((r) => ({
        roleName: r.roleName,
        domain: r.domain,
        technology: r.technology,
        experienceLevel: r.experienceLevel,
        manDays: r.manDays,
        onsiteDays: r.onsiteDays,
      }));

      await onSubmit({
        requestId: reqDoc._id,
        price: price ? Number(price) : null,
        currency: "EUR",
        deliveryDays: deliveryDays ? Number(deliveryDays) : null,
        rolesProvided,
        notes,
      });
    } catch (e) {
      setErr(e?.response?.data?.error || "Submit failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
      <div className="w-full max-w-xl rounded-2xl border border-slate-800 bg-slate-950 p-4 space-y-3">
        <div className="flex justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-100">
              Submit Offer
            </h3>
            <p className="text-xs text-slate-400">{reqDoc.title}</p>
            <p className="text-[11px] text-slate-500 mt-1">
              Roles: {rolesText || "—"}
            </p>
          </div>
          <button onClick={onClose} className="text-slate-300 hover:text-white">
            ✕
          </button>
        </div>

        {err && <p className="text-xs text-red-400">{err}</p>}

        <div className="grid grid-cols-2 gap-2">
          <input
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="Price (EUR)"
            className="border border-slate-700 rounded-xl px-3 py-2 bg-slate-900 text-sm text-slate-100"
          />
          <input
            value={deliveryDays}
            onChange={(e) => setDeliveryDays(e.target.value)}
            placeholder="Delivery days"
            className="border border-slate-700 rounded-xl px-3 py-2 bg-slate-900 text-sm text-slate-100"
          />
        </div>

        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notes / proposal"
          className="w-full border border-slate-700 rounded-xl px-3 py-2 bg-slate-900 text-sm text-slate-100 min-h-[90px]"
        />

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-3 py-2 rounded-xl border border-slate-700 text-sm text-slate-200"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={saving}
            className="px-3 py-2 rounded-xl bg-emerald-500 text-black text-sm disabled:opacity-60"
          >
            {saving ? "Submitting..." : "Submit"}
          </button>
        </div>
      </div>
    </div>
  );
}
