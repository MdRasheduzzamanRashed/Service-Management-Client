// context/AuthContext.jsx
"use client";

import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

export const AuthContext = createContext(null);

/* =========================
   Normalizers
========================= */
function normalizeId(raw) {
  if (!raw) return null;
  if (typeof raw === "string") return raw;
  if (raw?.$oid) return String(raw.$oid);
  try {
    return String(raw);
  } catch {
    return null;
  }
}

function normalizeRole(raw) {
  const s = String(raw || "").trim();
  if (!s) return "";
  return s.toUpperCase().replace(/\s+/g, "_");
}

function normalizeUsername(raw) {
  const s = String(raw || "").trim();
  if (!s) return "";
  return s.toLowerCase();
}

// If you only have "John Doe", create a safe fallback username
function slugUsername(raw) {
  const s = String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return s || "";
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  /* =========================
     Normalize user payload
  ========================= */
  const normalizeUser = useCallback((payload) => {
    if (!payload || typeof payload !== "object") return null;

    // ✅ accept { token, user:{...} } OR { ...user, token }
    const base =
      payload.user && typeof payload.user === "object"
        ? { ...payload.user, token: payload.token || payload.user.token }
        : payload;

    const _id = normalizeId(base._id || base.id || base.userId);

    // ✅ role
    const role = normalizeRole(base.role || base.userRole);

    // ✅ token
    const token = base.token || base.accessToken || base.jwt || null;

    // ✅ display name (nice to show in UI)
    const displayUsername =
      base.displayUsername ||
      base.display_name ||
      base.fullName ||
      base.name ||
      null;

    // ✅ username (IMPORTANT for your backend auth headers)
    // Priority: username -> handle -> email prefix -> employeeId -> displayUsername slug
    let usernameRaw =
      base.username ||
      base.userName ||
      base.handle ||
      (base.email ? String(base.email).split("@")[0] : "") ||
      base.employeeId ||
      displayUsername ||
      "";

    // normalize + slug fallback
    let username = normalizeUsername(usernameRaw);
    if (!username) username = slugUsername(usernameRaw);

    // If still empty, keep null (so you can detect and force re-login)
    username = username || null;

    return {
      ...base,
      _id,
      role: role || null,
      token,
      username,
      displayUsername: displayUsername || username || null,
    };
  }, []);

  /* =========================
     Load from localStorage
  ========================= */
  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const saved = window.localStorage.getItem("user");
      if (!saved) {
        setUser(null);
        return;
      }

      const parsed = JSON.parse(saved);
      setUser(normalizeUser(parsed));
    } catch {
      // corrupted storage
      window.localStorage.removeItem("user");
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, [normalizeUser]);

  // optional: sync across tabs
  useEffect(() => {
    if (typeof window === "undefined") return;

    function onStorage(e) {
      if (e.key !== "user") return;
      try {
        const next = e.newValue ? normalizeUser(JSON.parse(e.newValue)) : null;
        setUser(next);
      } catch {
        setUser(null);
      }
    }

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [normalizeUser]);

  /* =========================
     Actions
  ========================= */
  const loginUser = useCallback(
    (data) => {
      if (typeof window === "undefined") return;
      const normalized = normalizeUser(data);
      window.localStorage.setItem("user", JSON.stringify(normalized));
      setUser(normalized);
    },
    [normalizeUser],
  );

  const logoutUser = useCallback(() => {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem("user");
    setUser(null);
    window.location.assign("/auth/login");
  }, []);

  /* =========================
     Headers for backend
  ========================= */
  const authHeaders = useMemo(() => {
    const headers = {};

    // If you later enforce JWT middleware, keep this:
    if (user?.token) headers.Authorization = `Bearer ${user.token}`;

    if (user?.role) headers["x-user-role"] = normalizeRole(user.role);

    // Your routes frequently require this:
    if (user?.username)
      headers["x-username"] = normalizeUsername(user.username);

    return headers;
  }, [user?.token, user?.role, user?.username]);

  const isLoggedIn = !!(user?.token || user?.role);

  return (
    <AuthContext.Provider
      value={{
        user,
        setUser,
        loading,
        isLoggedIn,
        role: user?.role || null,
        username: user?.username || null,
        displayUsername: user?.displayUsername || null,
        loginUser,
        logoutUser,
        authHeaders,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
