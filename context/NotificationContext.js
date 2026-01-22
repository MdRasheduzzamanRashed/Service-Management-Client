"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { io } from "socket.io-client";
import { AuthContext } from "./AuthContext";
import { ToastContext } from "./ToastContext";
import { API_BASE, apiGet } from "../lib/api";

export const NotificationContext = createContext({
  unreadCount: 0,
  notifications: [],
  clearUnread: () => {},
  reloadNotifications: async () => {},
});

let socket = null;
const SOCKET_URL = API_BASE || "";

function keyOf(n) {
  return (
    n?.uniqKey ||
    (n?._id ? String(n._id) : "") ||
    (n?.id ? String(n.id) : "") ||
    `${n?.type || "N"}:${n?.requestId || ""}:${n?.createdAt || ""}:${n?.title || ""}`
  );
}

function mergeUnique(primary = [], secondary = []) {
  const out = [];
  const seen = new Set();

  // primary first (realtime newest), then secondary (history)
  for (const item of [...primary, ...secondary]) {
    const k = keyOf(item);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(item);
  }

  // newest first
  out.sort((a, b) => new Date(b?.createdAt || 0) - new Date(a?.createdAt || 0));
  return out;
}

export function NotificationProvider({ children }) {
  const { user, authHeaders } = useContext(AuthContext);
  const { showToast } = useContext(ToastContext);

  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // avoid duplicate connect/register handlers
  const registeredRef = useRef(false);
  const handlersAttachedRef = useRef(false);

  const toastTypeFor = useMemo(() => {
    return (type) => {
      const t = String(type || "").toUpperCase();

      // your DB notification types
      if (t === "REQUEST_EXPIRED") return "warning";
      if (t === "REQUEST_REACTIVATED") return "success";

      // your socket types (existing)
      const typeMap = {
        RequestCreated: "info",
        RequestSubmitted: "info",
        ProcurementApproved: "success",
        ProcurementRejected: "error",
        OfferSubmitted: "info",
        OfferSelected: "success",
        ServiceOrderCreated: "success",
        ServiceOrderExtended: "warning",
        ServiceOrderSubstitution: "warning",
      };
      return typeMap[type] || "info";
    };
  }, []);

  const reloadNotifications = async () => {
    if (!user) return;
    try {
      // expects API to return: {notifications: [...]}
      const res = await apiGet("/notifications", { headers: authHeaders });
      const apiList = Array.isArray(res?.data?.notifications)
        ? res.data.notifications
        : Array.isArray(res?.data)
          ? res.data
          : [];

      setNotifications((prev) => mergeUnique(prev, apiList));
    } catch {
      // silent here; page can show error if needed
    }
  };

  // 1) Reset when logout
  useEffect(() => {
    if (!user) {
      registeredRef.current = false;
      handlersAttachedRef.current = false;

      if (socket) {
        socket.disconnect();
        socket = null;
      }

      setNotifications([]);
      setUnreadCount(0);
      return;
    }
  }, [user]);

  // 2) Load initial notifications from DB when login
  useEffect(() => {
    if (!user) return;

    (async () => {
      await reloadNotifications();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.token]); // reload when token changes

  // 3) Socket connect + realtime notifications
  useEffect(() => {
    if (!user) return;

    if (!socket) {
      const opts = {
        // your backend CORS has credentials: false, so keep this false
        withCredentials: false,
        transports: ["websocket", "polling"],
      };

      socket = SOCKET_URL ? io(SOCKET_URL, opts) : io(opts);
    }

    // attach handlers once
    if (!handlersAttachedRef.current) {
      handlersAttachedRef.current = true;

      socket.on("connect", () => {
        // register once per session (avoid repeated emits)
        if (registeredRef.current) return;
        registeredRef.current = true;

        socket.emit("register", {
          role: user.role,
          email: user.email,
          username: user.username,
        });
      });

      socket.on("notification", (notif) => {
        setNotifications((prev) => mergeUnique([notif, ...prev], []));
        setUnreadCount((c) => c + 1);

        showToast({
          title: notif.title || "Notification",
          type: toastTypeFor(notif.type),
          link: notif.requestId
            ? `/requests/${notif.requestId}`
            : notif.relatedOfferId
              ? `/offers/${notif.relatedOfferId}`
              : null,
        });
      });
    }

    return () => {
      // do NOT disconnect here (would break other pages);
      // just remove the notification handler if you want,
      // but we keep it stable to avoid re-adding on route changes.
    };
  }, [user, showToast, toastTypeFor]);

  function clearUnread() {
    setUnreadCount(0);
  }

  return (
    <NotificationContext.Provider
      value={{
        unreadCount,
        notifications,
        clearUnread,
        reloadNotifications,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}
