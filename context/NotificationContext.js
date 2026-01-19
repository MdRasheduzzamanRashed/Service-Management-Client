"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { io } from "socket.io-client";
import { AuthContext } from "./AuthContext";
import { ToastContext } from "./ToastContext";
import { API_BASE } from "../lib/api";

export const NotificationContext = createContext({
  unreadCount: 0,
  notifications: [],
  clearUnread: () => {}
});

let socket = null;
const SOCKET_URL = API_BASE || "";

export function NotificationProvider({ children }) {
  const { user } = useContext(AuthContext);
  const { showToast } = useContext(ToastContext);

  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user) {
      if (socket) {
        socket.disconnect();
        socket = null;
      }
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    if (!socket) {
      const opts = {
        withCredentials: true,
        transports: ["websocket", "polling"],
      };

      socket = SOCKET_URL ? io(SOCKET_URL, opts) : io(opts);
    }

    socket.on("connect", () => {
      socket.emit("register", {
        role: user.role,
        email: user.email
      });
    });

    socket.on("notification", (notif) => {
      setNotifications((prev) => [notif, ...prev]);
      setUnreadCount((c) => c + 1);

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

      const toastType = typeMap[notif.type] || "info";

      showToast({
        title: notif.title,
        type: toastType,
        link: notif.requestId
          ? `/requests/${notif.requestId}`
          : notif.relatedOfferId
          ? `/offers/${notif.relatedOfferId}`
          : null
      });
    });

    return () => {
      if (socket) {
        socket.off("notification");
      }
    };
  }, [user, showToast]);

  function clearUnread() {
    setUnreadCount(0);
  }

  return (
    <NotificationContext.Provider value={{ unreadCount, notifications, clearUnread }}>
      {children}
    </NotificationContext.Provider>
  );
}
