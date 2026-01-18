"use client";

import {
  createContext,
  useEffect,
  useMemo,
  useState,
  useCallback,
} from "react";

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // ✅ stable id normalize
  const normalizeId = useCallback((raw) => {
    if (!raw) return null;
    if (typeof raw === "string") return raw;
    if (raw?.$oid) return String(raw.$oid);
    try {
      return String(raw);
    } catch {
      return null;
    }
  }, []);

  // ✅ normalize user payload (supports server variations)
  const normalizeUser = useCallback(
    (u) => {
      if (!u || typeof u !== "object") return null;

      const _id = normalizeId(u._id || u.id || u.userId);
      const role = u.role || u.userRole || null;

      // token name variations
      const token = u.token || u.accessToken || u.jwt || null;

      // IMPORTANT:
      // - username should be the login username (normalized in DB)
      // - displayUsername can be shown in UI only
      const username = u.username || null;
      const displayUsername = u.displayUsername || u.display_name || null;

      return {
        ...u,
        _id,
        role,
        token,
        username,
        displayUsername,
      };
    },
    [normalizeId]
  );

  // ✅ load from localStorage once
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

  // ✅ login
  const loginUser = useCallback(
    (data) => {
      if (typeof window === "undefined") return;

      const normalized = normalizeUser(data);

      // recommended strict validation
      if (!normalized?.token || !normalized?._id || !normalized?.role) {
        console.warn("loginUser(): missing token/_id/role", normalized);
      }

      window.localStorage.setItem("user", JSON.stringify(normalized));
      setUser(normalized);
    },
    [normalizeUser]
  );

  // ✅ logout
  const logoutUser = useCallback(() => {
    if (typeof window === "undefined") return;

    window.localStorage.removeItem("user");
    setUser(null);
    window.location.assign("/auth/login");
  }, []);

  // ✅ axios headers
  const authHeaders = useMemo(() => {
    if (!user?.token) return {};

    const headers = {
      Authorization: `Bearer ${user.token}`,
    };

    if (user?._id) headers["x-user-id"] = String(user._id);
    if (user?.role) headers["x-user-role"] = String(user.role);

    // use real username, not displayUsername
    if (user?.username) headers["x-username"] = String(user.username);

    return headers;
  }, [user]);

  const isLoggedIn = !!user?.token;

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
