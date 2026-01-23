"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import toast from "react-hot-toast";
import { apiGet, apiPost } from "../lib/api";
import { AuthContext } from "./AuthContext";

export const NotificationContext = createContext({
  unreadCount: 0,
  refreshUnread: async () => {},
  refreshList: async () => {},
  notifications: [],
  loading: false,
  markRead: async () => {},
  markAllRead: async () => {},
});

function pickList(res) {
  // supports {data:[...]} or [...]
  const d = res?.data;
  if (Array.isArray(d)) return d;
  if (Array.isArray(d?.data)) return d.data;
  return [];
}

export function NotificationProvider({ children }) {
  const { authHeaders, loading: authLoading, user } = useContext(AuthContext);

  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);

  const isReady = useMemo(() => {
    return !authLoading && !!user?.role && !!authHeaders?.["x-user-role"];
  }, [authLoading, user?.role, authHeaders]);

  const refreshUnread = useCallback(async () => {
    if (!isReady) return;
    try {
      const r = await apiGet("/notifications/unread-count", {
        headers: authHeaders,
      });
      setUnreadCount(Number(r?.data?.unreadCount || 0));
    } catch {
      // silent
    }
  }, [authHeaders, isReady]);

  const refreshList = useCallback(
    async ({ unreadOnly = false } = {}) => {
      if (!isReady) return;
      setLoading(true);
      try {
        const r = await apiGet("/notifications", {
          headers: authHeaders,
          params: { page: 1, limit: 50, unreadOnly },
        });
        setNotifications(pickList(r));
      } catch (e) {
        toast.error(e?.response?.data?.error || "Failed to load notifications");
        setNotifications([]);
      } finally {
        setLoading(false);
      }
    },
    [authHeaders, isReady],
  );

  const markRead = useCallback(
    async (id) => {
      if (!isReady || !id) return;
      try {
        await apiPost(
          `/notifications/${id}/read`,
          {},
          { headers: authHeaders },
        );
        setNotifications((prev) =>
          prev.map((n) =>
            String(n?._id) === String(id)
              ? { ...n, read: true, readAt: new Date() }
              : n,
          ),
        );
        refreshUnread();
      } catch (e) {
        toast.error(e?.response?.data?.error || "Failed to mark read");
      }
    },
    [authHeaders, isReady, refreshUnread],
  );

  const markAllRead = useCallback(async () => {
    if (!isReady) return;
    try {
      await apiPost("/notifications/read-all", {}, { headers: authHeaders });
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, read: true, readAt: new Date() })),
      );
      setUnreadCount(0);
      toast.success("All notifications marked as read");
    } catch (e) {
      toast.error(e?.response?.data?.error || "Failed to mark all read");
    }
  }, [authHeaders, isReady]);

  // ✅ Poll unread count
  useEffect(() => {
    if (!isReady) return;

    refreshUnread();
    const t = setInterval(refreshUnread, 15000); // 15 sec

    return () => clearInterval(t);
  }, [isReady, refreshUnread]);

  // ✅ Load latest list once after login
  useEffect(() => {
    if (!isReady) return;
    refreshList({ unreadOnly: false });
  }, [isReady, refreshList]);

  return (
    <NotificationContext.Provider
      value={{
        unreadCount,
        notifications,
        loading,
        refreshUnread,
        refreshList,
        markRead,
        markAllRead,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}
