"use client";

import { useContext, useState } from "react";
import { AuthContext } from "../../context/AuthContext";
import { API_BASE, API_FALLBACK_BASE, apiPost } from "../../lib/api";

export default function SettingsPage() {
  const { user } = useContext(AuthContext);

  const [form, setForm] = useState({
    oldPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const [msg, setMsg] = useState("");
  const [errMsg, setErrMsg] = useState("");
  const [loading, setLoading] = useState(false);

  async function handlePasswordChange(e) {
    e.preventDefault();
    setMsg("");
    setErrMsg("");

    if (!API_BASE && !API_FALLBACK_BASE) {
      setErrMsg(
        "API base URL missing. Set NEXT_PUBLIC_API_BASE in your environment variables.",
      );
      return;
    }

    if (!user?.username) {
      setErrMsg("Username not found in session. Please login again.");
      return;
    }

    if (form.newPassword !== form.confirmPassword) {
      setErrMsg("New passwords do not match");
      return;
    }

    setLoading(true);
    try {
      const res = await apiPost(
        "/auth/change-password",
        {
          username: user.username, // ✅ login uses username
          oldPassword: form.oldPassword,
          newPassword: form.newPassword,
        },
        {
          headers: { "Content-Type": "application/json" },
          withCredentials: true,
        },
      );

      setMsg(res.data?.message || "Password updated successfully");
      setForm({ oldPassword: "", newPassword: "", confirmPassword: "" });
    } catch (err) {
      setErrMsg(err?.response?.data?.error || "Error updating password");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-xl mx-auto space-y-8">
      <h1 className="text-xl font-bold text-slate-100">Settings</h1>

      {/* PROFILE INFORMATION */}
      <div className="bg-slate-900 p-5 rounded-xl border border-slate-800">
        <h2 className="text-lg font-semibold mb-4 text-slate-100">
          Profile Information
        </h2>

        <p className="text-sm text-slate-300">
          <strong>Name:</strong> {user?.name || "-"}
        </p>

        <p className="text-sm text-slate-300 mt-1">
          <strong>Username:</strong> {user?.username || "-"}
        </p>

        <p className="text-sm text-slate-300 mt-1">
          <strong>Email:</strong> {user?.email || "-"}
        </p>

        <p className="text-sm text-slate-300 mt-1">
          <strong>Role:</strong> {user?.role || "-"}
        </p>

        {!!user?.department && (
          <p className="text-sm text-slate-300 mt-1">
            <strong>Department:</strong> {user.department}
          </p>
        )}

        {!!user?.position && (
          <p className="text-sm text-slate-300 mt-1">
            <strong>Position:</strong> {user.position}
          </p>
        )}
      </div>

      {/* CHANGE PASSWORD */}
      <form
        onSubmit={handlePasswordChange}
        className="bg-slate-900 p-5 rounded-xl border border-slate-800 space-y-3"
      >
        <h2 className="text-lg font-semibold text-slate-100">
          Change Password
        </h2>

        {msg && (
          <p className="text-xs text-emerald-400 border border-emerald-500/30 bg-emerald-500/10 rounded px-3 py-2">
            {msg}
          </p>
        )}

        {errMsg && (
          <p className="text-xs text-red-400 border border-red-500/30 bg-red-500/10 rounded px-3 py-2">
            {errMsg}
          </p>
        )}

        <div className="space-y-1">
          <label className="text-xs text-slate-300">Old Password</label>
          <input
            type="password"
            className="w-full p-2 bg-slate-800 rounded text-sm border border-slate-700 focus:outline-none focus:border-emerald-400"
            required
            onChange={(e) => setForm({ ...form, oldPassword: e.target.value })}
            value={form.oldPassword}
            autoComplete="current-password"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs text-slate-300">New Password</label>
          <input
            type="password"
            className="w-full p-2 bg-slate-800 rounded text-sm border border-slate-700 focus:outline-none focus:border-emerald-400"
            required
            onChange={(e) => setForm({ ...form, newPassword: e.target.value })}
            value={form.newPassword}
            autoComplete="new-password"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs text-slate-300">Confirm Password</label>
          <input
            type="password"
            className="w-full p-2 bg-slate-800 rounded text-sm border border-slate-700 focus:outline-none focus:border-emerald-400"
            required
            onChange={(e) =>
              setForm({ ...form, confirmPassword: e.target.value })
            }
            value={form.confirmPassword}
            autoComplete="new-password"
          />
        </div>

        <button
          disabled={loading}
          className="w-full bg-emerald-500 py-2 rounded text-black text-sm font-medium hover:bg-emerald-400 disabled:opacity-60"
        >
          {loading ? "Updating..." : "Update Password"}
        </button>
      </form>
    </div>
  );
}
