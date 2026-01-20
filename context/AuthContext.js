"use client";

import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

export const AuthContext = createContext(null);

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

/** IMPORTANT: match backend role normalize */
function normalizeRole(raw) {
  return String(raw || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_");
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const normalizeUser = useCallback((u) => {
    if (!u || typeof u !== "object") return null;

    const _id = normalizeId(u._id || u.id || u.userId);
    const role = normalizeRole(u.role || u.userRole);

    const token = u.token || u.accessToken || u.jwt || null;
    const username = u.username || null;
    const displayUsername = u.displayUsername || u.display_name || null;

    return { ...u, _id, role, token, username, displayUsername };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const saved = window.localStorage.getItem("user");
      setUser(saved ? normalizeUser(JSON.parse(saved)) : null);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, [normalizeUser]);

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

  const authHeaders = useMemo(() => {
    const headers = {};
    if (user?.token) headers.Authorization = `Bearer ${user.token}`;
    if (user?.role) headers["x-user-role"] = normalizeRole(user.role);
    if (user?.username) headers["x-username"] = String(user.username);
    return headers;
  }, [user]);

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
