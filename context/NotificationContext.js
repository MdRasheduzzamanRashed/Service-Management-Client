// context/NotificationContext.jsx
"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { usePathname } from "next/navigation";
import { AuthContext } from "./AuthContext";
import { apiGet } from "../lib/api";

export const NotificationContext = createContext({
  unreadCount: 0,
  refreshUnread: async () => {},
  setUnreadCount: () => {},
});

export function NotificationProvider({ children }) {
  const pathname = usePathname();
  const { authHeaders, loading: authLoading, user } = useContext(AuthContext);

  const [unreadCount, setUnreadCount] = useState(0);
  const [lastError, setLastError] = useState("");

  const timerRef = useRef(null);
  const inFlightRef = useRef(false);

  const isLoggedIn = !!user?.token || !!user?.role;
  const headersReady = !!authHeaders?.["x-user-role"];
  const usernameReady = !!authHeaders?.["x-username"];

  // ✅ who should fetch notifications?
  // - admin roles use role-based notifications (x-user-role)
  // - PM "my" notifications need x-username for toUsername targeting
  const canFetch = isLoggedIn && !authLoading && headersReady;

  const refreshUnread = useCallback(async () => {
    if (!canFetch) return;
    if (inFlightRef.current) return;

    // If your backend sends some notifications by username only, keep this:
    // (role-based will work without username too)
    // If you want strict: require usernameReady; but that can hide badge.
    // We'll allow it.
    inFlightRef.current = true;

    try {
      setLastError("");

      const res = await apiGet("/notifications", {
        headers: authHeaders,
        params: {
          unreadOnly: 1,
          limit: 100,
        },
      });

      const data = res?.data;
      const rows = Array.isArray(data?.data) ? data.data : [];

      // unreadOnly already returns unread items, but still safe:
      const c = rows.filter((n) => !n?.read).length;
      setUnreadCount(c);
    } catch (e) {
      // do not spam UI, just keep badge stable
      setLastError(
        e?.response?.data?.error || e?.message || "Failed to load unread",
      );
    } finally {
      inFlightRef.current = false;
    }
  }, [authHeaders, canFetch]);

  // ✅ If user opens notifications page, immediately clear badge
  useEffect(() => {
    if (pathname === "/notifications") {
      setUnreadCount(0);
    }
  }, [pathname]);

  // ✅ Start polling
  useEffect(() => {
    // cleanup
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;

    if (!canFetch) {
      setUnreadCount(0);
      return;
    }

    // initial fetch
    refreshUnread();

    // poll every 20s (you can change)
    timerRef.current = setInterval(() => {
      refreshUnread();
    }, 20000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
    };
  }, [canFetch, refreshUnread]);

  const value = useMemo(
    () => ({
      unreadCount,
      refreshUnread,
      setUnreadCount,
      lastError, // optional (not required in navbar)
    }),
    [unreadCount, refreshUnread, lastError],
  );

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}
