"use client";

import { useEffect, useState, useContext, useMemo } from "react";
import { useRouter } from "next/navigation";
import { AuthContext } from "../../../context/AuthContext";
import { API_BASE, API_FALLBACK_BASE, apiPost } from "../../../lib/api";


export default function LoginPage() {
  const router = useRouter();
  const { user, loading: authLoading, loginUser } = useContext(AuthContext);

  const [form, setForm] = useState({ username: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [popup, setPopup] = useState({
    open: false,
    title: "",
    message: "",
    actionText: "",
    actionHref: "",
  });

  useEffect(() => {
    if (authLoading) return;
    if (user) router.replace("/dashboard");
  }, [authLoading, user, router]);

  function openPopup({ title, message, actionText, actionHref }) {
    setPopup({
      open: true,
      title,
      message,
      actionText: actionText || "",
      actionHref: actionHref || "",
    });
  }

  function closePopup() {
    setPopup((p) => ({ ...p, open: false }));
  }

  const canSubmit = useMemo(() => {
    return form.username.trim().length > 0 && form.password.trim().length > 0;
  }, [form.username, form.password]);

  async function handleLogin(e) {
    e.preventDefault();
    setError("");
    closePopup();

    if (!API_BASE && !API_FALLBACK_BASE) {
      setError(
        "API URL is missing. Set NEXT_PUBLIC_API_BASE in Vercel environment variables.",
      );
      return;
    }

    setLoading(true);

    try {
      const payload = {
        username: form.username.trim().toLowerCase(),
        password: form.password,
      };

      // ✅ Style 1 endpoint
      const res = await apiPost("/auth/login", payload, {
        headers: { "Content-Type": "application/json" },
        withCredentials: true, // safe even if you don't use cookies
      });

      const rawUser = res.data?.user || {};
      const token = res.data?.token || "";

      const rawId = rawUser._id || rawUser.id || rawUser.userId;
      const normalizedId =
        typeof rawId === "string"
          ? rawId
          : rawId?.$oid
            ? String(rawId.$oid)
            : rawId
              ? String(rawId)
              : null;

      if (!normalizedId || !rawUser.role || !token) {
        throw new Error("Invalid user payload from server");
      }

      loginUser({ ...rawUser, _id: normalizedId, token });
      router.push("/dashboard");
    } catch (err) {
      console.error("Login error:", err);

      const status = err?.response?.status;
      const msg =
        err?.response?.data?.error ||
        err?.message ||
        "Login failed. Please try again.";

      setError(msg);

      if (status === 400 || status === 401) {
        openPopup({
          title: "Login failed",
          message:
            "Username or password is incorrect, or your account is not registered yet. If you haven’t registered, please create an account first.",
          actionText: "Go to Register",
          actionHref: "/auth/register",
        });
      } else if (status === 403) {
        openPopup({
          title: "Access denied",
          message:
            "You are not authorized to use this system. Please contact admin.",
        });
      } else if (status === 503) {
        openPopup({
          title: "Service unavailable",
          message: "Server is unavailable right now. Please try again later.",
        });
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-950 p-6">
      {/* Popup */}
      {popup.open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={closePopup}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold text-slate-100">
              {popup.title}
            </h2>
            <p className="mt-2 text-sm text-slate-300">{popup.message}</p>

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                className="flex-1 rounded-lg bg-slate-800 py-2 text-sm text-slate-200 hover:bg-slate-700"
                onClick={closePopup}
              >
                Close
              </button>

              {popup.actionHref ? (
                <a
                  href={popup.actionHref}
                  className="flex-1 rounded-lg bg-emerald-500 py-2 text-center text-sm font-medium text-black hover:bg-emerald-400"
                >
                  {popup.actionText || "Continue"}
                </a>
              ) : null}
            </div>
          </div>
        </div>
      )}

      <form
        onSubmit={handleLogin}
        className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4"
      >
        <h1 className="text-xl font-semibold text-slate-100">Login</h1>

        {error && (
          <p className="text-xs text-red-400 border border-red-500/40 bg-red-500/10 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <div className="space-y-1">
          <label className="text-xs text-slate-300">Username</label>
          <input
            type="text"
            required
            value={form.username}
            onChange={(e) =>
              setForm((f) => ({ ...f, username: e.target.value }))
            }
            className="w-full px-3 py-2 rounded-lg bg-slate-800 text-sm border border-slate-700 focus:outline-none focus:border-emerald-400"
            placeholder="e.g. pm_john"
            autoComplete="username"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs text-slate-300">Password</label>
          <input
            type="password"
            required
            value={form.password}
            onChange={(e) =>
              setForm((f) => ({ ...f, password: e.target.value }))
            }
            className="w-full px-3 py-2 rounded-lg bg-slate-800 text-sm border border-slate-700 focus:outline-none focus:border-emerald-400"
            autoComplete="current-password"
          />
        </div>

        <button
          type="submit"
          disabled={loading || !canSubmit}
          className="w-full py-2 rounded-lg bg-emerald-500 text-black text-sm font-medium hover:bg-emerald-400 disabled:opacity-60"
        >
          {loading ? "Logging in..." : "Login"}
        </button>

        <p className="text-xs text-slate-400 text-center">
          No account?{" "}
          <a href="/auth/register" className="text-emerald-400 hover:underline">
            Register
          </a>
        </p>
      </form>
    </main>
  );
}
