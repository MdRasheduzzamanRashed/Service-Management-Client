"use client";

import { useContext, useState } from "react";
import axios from "axios";
import { AuthContext } from "../../context/AuthContext";

const API = "http://localhost:8000";

export default function SettingsPage() {
  const { user } = useContext(AuthContext);

  const [form, setForm] = useState({
    oldPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const [msg, setMsg] = useState("");

  async function handlePasswordChange(e) {
    e.preventDefault();
    setMsg("");

    if (form.newPassword !== form.confirmPassword) {
      return setMsg("New passwords do not match");
    }

    try {
      const res = await axios.post(API + "/change-password", {
        email: user.email,
        oldPassword: form.oldPassword,
        newPassword: form.newPassword,
      });

      setMsg(res.data.message);
      setForm({ oldPassword: "", newPassword: "", confirmPassword: "" });
    } catch (err) {
      setMsg(err?.response?.data?.error || "Error updating password");
    }
  }

  return (
    <div className="max-w-xl mx-auto space-y-8">
      <h1 className="text-xl font-bold">Settings</h1>

      {/* PROFILE INFORMATION */}
      <div className="bg-slate-900 p-5 rounded-xl border border-slate-800">
        <h2 className="text-lg font-semibold mb-4">Profile Information</h2>

        <p className="text-sm text-slate-300">
          <strong>Name:</strong> {user.name}
        </p>

        <p className="text-sm text-slate-300 mt-1">
          <strong>Company:</strong> {user.companyName}
        </p>

        <p className="text-sm text-slate-300 mt-1">
          <strong>Email:</strong> {user.email}
        </p>

        <p className="text-sm text-slate-300 mt-1">
          <strong>Role:</strong> {user.role}
        </p>
      </div>

      {/* CHANGE PASSWORD */}
      <form
        onSubmit={handlePasswordChange}
        className="bg-slate-900 p-5 rounded-xl border border-slate-800 space-y-3"
      >
        <h2 className="text-lg font-semibold">Change Password</h2>

        {msg && <p className="text-xs text-emerald-400">{msg}</p>}

        <div className="space-y-1">
          <label className="text-xs text-slate-300">Old Password</label>
          <input
            type="password"
            className="w-full p-2 bg-slate-800 rounded text-sm"
            required
            onChange={(e) => setForm({ ...form, oldPassword: e.target.value })}
            value={form.oldPassword}
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs text-slate-300">New Password</label>
          <input
            type="password"
            className="w-full p-2 bg-slate-800 rounded text-sm"
            required
            onChange={(e) => setForm({ ...form, newPassword: e.target.value })}
            value={form.newPassword}
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs text-slate-300">Confirm Password</label>
          <input
            type="password"
            className="w-full p-2 bg-slate-800 rounded text-sm"
            required
            onChange={(e) =>
              setForm({ ...form, confirmPassword: e.target.value })
            }
            value={form.confirmPassword}
          />
        </div>

        <button className="w-full bg-emerald-500 py-2 rounded text-black text-sm font-medium hover:bg-emerald-400">
          Update Password
        </button>
      </form>
    </div>
  );
}
