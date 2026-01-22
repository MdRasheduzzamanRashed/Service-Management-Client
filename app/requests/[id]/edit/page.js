"use client";

import { useParams, useRouter } from "next/navigation";
import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { AuthContext } from "../../../../context/AuthContext";
import ServiceRequestForm from "../../../../components/ServiceRequestForm";
import { apiGet, apiPut } from "../../../../lib/api";

function normalizeRole(raw) {
  return String(raw || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_");
}

export default function EditRequestPage() {
  const { id } = useParams();
  const router = useRouter();

  const { user, authHeaders, loading: authLoading } = useContext(AuthContext);

  const [req, setReq] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const role = useMemo(() => normalizeRole(user?.role), [user?.role]);

  // ✅ for edit you MUST have x-user-role + x-username (backend checks ownership)
  const headersReady = useMemo(() => {
    return (
      !authLoading &&
      !!authHeaders?.["x-user-role"] &&
      !!authHeaders?.["x-username"]
    );
  }, [authLoading, authHeaders]);

  const load = useCallback(async () => {
    if (!id) return;
    if (!headersReady) return;

    setError("");
    setLoading(true);
    try {
      const res = await apiGet(`/requests/${id}`, { headers: authHeaders });
      setReq(res?.data || null);
    } catch (e) {
      setReq(null);
      setError(
        e?.response?.data?.error || e?.message || "Failed to load request",
      );
    } finally {
      setLoading(false);
    }
  }, [id, headersReady, authHeaders]);

  useEffect(() => {
    load();
  }, [load]);

  const onSubmit = useCallback(
    async (payload) => {
      if (!id) return;
      setSaving(true);
      setError("");
      try {
        await apiPut(`/requests/${id}`, payload, { headers: authHeaders });
        router.push(`/requests/${id}`); // back to detail
      } catch (e) {
        setError(e?.response?.data?.error || e?.message || "Update failed");
      } finally {
        setSaving(false);
      }
    },
    [id, authHeaders, router],
  );

  if (!headersReady) {
    return (
      <main className="p-4">
        <p className="text-xs text-amber-300">
          Missing auth headers (x-user-role / x-username). Logout/login again.
        </p>
      </main>
    );
  }

  if (role !== "PROJECT_MANAGER") {
    return (
      <main className="p-4">
        <p className="text-xs text-red-400">Only PROJECT_MANAGER can edit.</p>
      </main>
    );
  }

  if (loading || !req) {
    return (
      <main className="p-4 space-y-3">
        {error ? (
          <p className="text-xs text-red-400">{error}</p>
        ) : (
          <p className="text-xs text-slate-300">Loading draft…</p>
        )}
      </main>
    );
  }

  // ✅ only draft editable (matches backend)
  if (String(req.status || "").toUpperCase() !== "DRAFT") {
    return (
      <main className="p-4 space-y-3">
        <p className="text-xs text-amber-300">
          This request is not DRAFT. Only DRAFT can be edited.
        </p>
        <button
          className="px-3 py-1.5 text-xs rounded-lg border border-slate-700 text-slate-200 hover:bg-slate-800"
          onClick={() => router.push(`/requests/${id}`)}
          type="button"
        >
          Back
        </button>
      </main>
    );
  }

  return (
    <main className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Edit Draft</h1>
        <button
          type="button"
          onClick={() => router.push(`/requests/${id}`)}
          className="px-3 py-1.5 text-xs rounded-lg border border-slate-700 text-slate-200 hover:bg-slate-800"
        >
          Back
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-700/40 bg-red-950/40 px-4 py-2 text-sm text-red-200">
          {error}
        </div>
      )}

      <ServiceRequestForm
        mode="edit"
        initialRequest={req}
        saving={saving}
        onSubmit={onSubmit}
        onCancel={() => router.push(`/requests/${id}`)}
      />
    </main>
  );
}
