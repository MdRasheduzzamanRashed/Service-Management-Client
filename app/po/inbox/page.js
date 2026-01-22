"use client";

import { useEffect, useState, useContext } from "react";
import Link from "next/link";
import { AuthContext } from "../../../context/AuthContext";
import { apiGet, apiPost } from "../../../lib/api";

export default function POInboxPage() {
  const { user, authHeaders } = useContext(AuthContext);
  const role = String(user?.role || "").toUpperCase();

  const [list, setList] = useState([]);
  const [err, setErr] = useState("");

  useEffect(() => {
    async function load() {
      try {
        setErr("");
        const res = await apiGet("/requests", {
          headers: authHeaders,
          params: { status: "SENT_TO_PO" },
        });
        setList(Array.isArray(res?.data) ? res.data : []);
      } catch (e) {
        setErr(e?.response?.data?.error || "Failed to load PO inbox");
      }
    }
    if (user) load();
  }, [user, authHeaders]);

  if (!user) return <div className="p-4 text-slate-300">Login first</div>;
  if (role !== "PROCUREMENT_OFFICER")
    return (
      <div className="p-4 text-red-300">
        Only PROCUREMENT_OFFICER can access
      </div>
    );

  return (
    <main className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold">PO Inbox</h1>
        <p className="text-xs text-slate-400">Requests waiting for ordering.</p>
      </div>

      {err && <p className="text-xs text-red-400">{err}</p>}

      <div className="overflow-x-auto rounded-xl border border-slate-800">
        <table className="min-w-[900px] w-full text-sm">
          <thead className="bg-slate-950/60 text-[11px] text-slate-400">
            <tr>
              <th className="px-3 py-2">Title</th>
              <th className="px-3 py-2">Recommended Offer</th>
              <th className="px-3 py-2">Sent At</th>
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
                  {r.recommendedOfferId || "—"}
                </td>
                <td className="px-3 py-2 text-slate-300">
                  {r.sentToPoAt ? new Date(r.sentToPoAt).toLocaleString() : "—"}
                </td>
                <td className="px-3 py-2 text-right">
                  <div className="flex justify-end gap-2">
                    <Link
                      href={`/requests/${r._id}`}
                      className="text-xs px-2 py-1 rounded-lg border border-slate-700 hover:bg-slate-800"
                    >
                      View
                    </Link>
                    <button
                      className="text-xs px-2 py-1 rounded-lg bg-emerald-500 text-black hover:bg-emerald-400"
                      onClick={async () => {
                        await apiPost(
                          `/requests/${r._id}/order`,
                          { offerId: r.recommendedOfferId },
                          { headers: authHeaders },
                        );
                        alert("Ordered!");
                        window.location.reload();
                      }}
                    >
                      Order
                    </button>
                  </div>
                </td>
              </tr>
            ))}

            {list.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-xs text-slate-400">
                  No requests in PO inbox.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
