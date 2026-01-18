"use client";

import { useEffect, useRef, useState, useContext } from "react";
import axios from "axios";
import { useRouter } from "next/navigation";
import { AuthContext } from "../../../context/AuthContext";

const API = "http://localhost:8000";

export default function RegisterPage() {
  const router = useRouter();
  const { loginUser } = useContext(AuthContext);

  const [form, setForm] = useState({ email: "", password: "" });

  // ✅ companyName removed
  const [prefill, setPrefill] = useState({
    name: "",
    username: "",
    role: "",
  });

  const [loading, setLoading] = useState(false);
  const [prefillLoading, setPrefillLoading] = useState(false);
  const [error, setError] = useState("");

  const [popup, setPopup] = useState({
    open: false,
    title: "",
    message: "",
    actionText: "",
    actionHref: "",
  });

  const lastPrefillEmailRef = useRef("");

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

  // ✅ Prefill (debounced + race-safe)
  useEffect(() => {
    const email = form.email.trim().toLowerCase();

    // reset when email changes
    setPrefill({ name: "", username: "", role: "" });
    setError("");
    closePopup();

    if (!email || !email.includes("@")) return;

    const t = setTimeout(async () => {
      lastPrefillEmailRef.current = email;

      setPrefillLoading(true);
      try {
        const res = await axios.get(`${API}/api/auth/prefill`, {
          params: { email },
        });

        if (lastPrefillEmailRef.current !== email) return;

        setPrefill({
          name: res.data?.name || "",
          username: res.data?.username || "",
          role: res.data?.role || "",
        });
      } catch (err) {
        if (lastPrefillEmailRef.current !== email) return;

        const status = err?.response?.status;
        const msg =
          err?.response?.data?.error ||
          (status === 503
            ? "Employees service unavailable. Try again later."
            : "Unable to verify email");

        setError(msg);

        if (status === 403) {
          openPopup({
            title: "Unauthorized Email",
            message:
              msg ||
              "This email is not found in employee records, so registration is not allowed.",
            actionText: "Go to Login",
            actionHref: "/auth/login",
          });
        }

        if (status === 503) {
          openPopup({
            title: "Service unavailable",
            message:
              "Employee verification service is down right now. Please try again in a few minutes.",
          });
        }
      } finally {
        if (lastPrefillEmailRef.current === email) setPrefillLoading(false);
      }
    }, 450);

    return () => clearTimeout(t);
  }, [form.email]);

  async function handleRegister(e) {
    e.preventDefault();
    setError("");
    closePopup();
    setLoading(true);

    try {
      const email = form.email.trim().toLowerCase();

      if (!prefill?.username) {
        setLoading(false);
        return openPopup({
          title: "Not verified",
          message:
            "Please enter a valid employee email and wait for verification.",
        });
      }

      const res = await axios.post(`${API}/api/auth/register`, {
        email,
        password: form.password,
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
      const status = err?.response?.status;
      const msg = err?.response?.data?.error || "Registration failed";
      setError(msg);

      if (status === 403) {
        openPopup({
          title: "Registration denied",
          message: msg,
          actionText: "Go to Login",
          actionHref: "/auth/login",
        });
      } else if (status === 400 && msg.toLowerCase().includes("already")) {
        openPopup({
          title: "Already registered",
          message:
            "This account is already registered. Please login with your username and password.",
          actionText: "Go to Login",
          actionHref: "/auth/login",
        });
      } else if (status === 503) {
        openPopup({
          title: "Service unavailable",
          message:
            "Employee verification service is unavailable right now. Please try again later.",
        });
      }
    } finally {
      setLoading(false);
    }
  }

  const verified = !!prefill.username;
  const canRegister = verified && form.password.trim().length >= 4;

  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-slate-950">
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
        onSubmit={handleRegister}
        className="w-full max-w-md bg-slate-900 p-6 rounded-2xl border border-slate-800 space-y-4"
      >
        <h1 className="text-xl font-semibold text-slate-100">Create Account</h1>

        {error && (
          <p className="text-xs text-red-400 border border-red-500/40 bg-red-500/10 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <div className="space-y-1">
          <label className="text-xs text-slate-300">Email</label>
          <input
            required
            type="email"
            value={form.email}
            className="w-full px-3 py-2 rounded-lg bg-slate-800 text-sm border border-slate-700 focus:outline-none focus:border-emerald-400"
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            placeholder="name@workforce.com"
            autoComplete="email"
          />
          <p className="text-[11px] text-slate-500">
            We verify your email from employee system and auto-fill username &
            role.
          </p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-950/30 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-400">Employee Details</p>

            {prefillLoading ? (
              <span className="text-[11px] text-slate-500">Checking...</span>
            ) : verified ? (
              <span className="text-[11px] text-emerald-400">Verified</span>
            ) : (
              <span className="text-[11px] text-slate-500">Not verified</span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] text-slate-500">Name</label>
              <input
                value={prefill.name}
                readOnly
                className="mt-1 w-full px-2 py-2 rounded-lg bg-slate-800/60 text-sm border border-slate-800 text-slate-200"
                placeholder="Auto-filled"
              />
            </div>

            <div>
              <label className="text-[11px] text-slate-500">Username</label>
              <input
                value={prefill.username}
                readOnly
                className="mt-1 w-full px-2 py-2 rounded-lg bg-slate-800/60 text-sm border border-slate-800 text-slate-200"
                placeholder="Auto-filled"
              />
            </div>

            <div className="col-span-2">
              <label className="text-[11px] text-slate-500">Role</label>
              <input
                value={prefill.role}
                readOnly
                className="mt-1 w-full px-2 py-2 rounded-lg bg-slate-800/60 text-sm border border-slate-800 text-slate-200"
                placeholder="Auto-filled"
              />
            </div>
          </div>

          {verified && (
            <p className="text-[11px] text-slate-500">
              After registration you will login with{" "}
              <span className="text-slate-200">username</span> + password.
            </p>
          )}
        </div>

        <div className="space-y-1">
          <label className="text-xs text-slate-300">Password</label>
          <input
            required
            type="password"
            value={form.password}
            className="w-full px-3 py-2 rounded-lg bg-slate-800 text-sm border border-slate-700 focus:outline-none focus:border-emerald-400"
            onChange={(e) =>
              setForm((f) => ({ ...f, password: e.target.value }))
            }
            autoComplete="new-password"
            disabled={!verified}
          />
          {!verified && (
            <p className="text-[11px] text-slate-500">
              Enter a valid employee email first to unlock password field.
            </p>
          )}
        </div>

        <button
          disabled={loading || !canRegister}
          className="w-full bg-emerald-500 py-2 rounded-lg text-black text-sm font-medium hover:bg-emerald-400 disabled:opacity-60"
        >
          {loading ? "Creating..." : "Create Account"}
        </button>

        <p className="text-xs text-slate-400 text-center">
          Already have an account?{" "}
          <a href="/auth/login" className="text-emerald-400 hover:underline">
            Login
          </a>
        </p>
      </form>
    </main>
  );
}
