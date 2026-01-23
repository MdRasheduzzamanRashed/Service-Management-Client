"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import toast from "react-hot-toast";
import { io } from "socket.io-client";
import { AuthContext } from "./AuthContext";
import { apiGet } from "../lib/api";

export const NotificationContext = createContext({
  unreadCount: 0,
  refreshUnread: async () => {},
});

export function NotificationProvider({ children }) {
  const { authHeaders, user } = useContext(AuthContext);

  const [unreadCount, setUnreadCount] = useState(0);
  const socketRef = useRef(null);

  const role = useMemo(() => user?.role || "", [user?.role]);
  const username = useMemo(() => user?.username || "", [user?.username]);

  async function refreshUnread() {
    if (!authHeaders?.["x-user-role"]) return;
    try {
      const res = await apiGet("/notifications/unread-count", {
        headers: authHeaders,
      });
      setUnreadCount(Number(res?.data?.unreadCount || 0));
    } catch {
      // ignore
    }
  }

  // polling fallback (every 20s)
  useEffect(() => {
    refreshUnread();
    const t = setInterval(refreshUnread, 20000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authHeaders?.["x-user-role"], authHeaders?.["x-username"]]);

  // realtime socket (optional)
  useEffect(() => {
    if (!user?.token) return;
    // connect to same API host
    const base =
      process.env.NEXT_PUBLIC_API_BASE ||
      "https://service-management-server.onrender.com";
    const s = io(base, { transports: ["websocket", "polling"] });
    socketRef.current = s;

    s.on("connect", () => {
      s.emit("join", { username, role });
    });

    s.on("notification:new", (n) => {
      // increase counter
      setUnreadCount((c) => c + 1);

      // toast
      toast((t) => (
        <div className="text-sm">
          <div className="font-semibold text-slate-100">
            {n?.title || "Notification"}
          </div>
          <div className="text-slate-300 text-xs mt-1">{n?.message || ""}</div>
        </div>
      ));
    });

    return () => {
      s.disconnect();
      socketRef.current = null;
    };
  }, [user?.token, username, role]);

  return (
    <NotificationContext.Provider value={{ unreadCount, refreshUnread }}>
      {children}
    </NotificationContext.Provider>
  );
}
