"use client";

import Link from "next/link";
import { useContext, useEffect, useMemo, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { AuthContext } from "../context/AuthContext";
import { NotificationContext } from "../context/NotificationContext";

function normalizeRole(raw) {
  const s = String(raw || "").trim();
  if (!s) return "";
  const upper = s.toUpperCase().replace(/\s+/g, "_");
  const noUnderscore = upper.replace(/_/g, "");
  const map = {
    PROJECTMANAGER: "PROJECT_MANAGER",
    PROJECT_MANAGER: "PROJECT_MANAGER",
    PROCUREMENTOFFICER: "PROCUREMENT_OFFICER",
    PROCUREMENT_OFFICER: "PROCUREMENT_OFFICER",
    RESOURCEPLANNER: "RESOURCE_PLANNER",
    RESOURCE_PLANNER: "RESOURCE_PLANNER",
    SYSTEMADMIN: "SYSTEM_ADMIN",
    SYSTEM_ADMIN: "SYSTEM_ADMIN",
    ADMIN: "SYSTEM_ADMIN",

    // optional
    SERVICEPROVIDER: "SERVICE_PROVIDER",
    SERVICE_PROVIDER: "SERVICE_PROVIDER",
  };
  return map[noUnderscore] || map[upper] || upper;
}

// parse "/requests?view=my" => { basePath: "/requests", query: {view:"my"} }
function parseHref(href) {
  const [basePath, qs] = String(href || "").split("?");
  const query = {};
  if (qs) {
    const sp = new URLSearchParams(qs);
    for (const [k, v] of sp.entries()) query[k] = v;
  }
  return { basePath: basePath || "/", query };
}

function isActiveNav(itemHref, pathname, sp) {
  const { basePath, query } = parseHref(itemHref);

  const pathMatch =
    pathname === basePath ||
    (basePath !== "/" && pathname.startsWith(basePath + "/"));

  if (!pathMatch) return false;

  for (const key of Object.keys(query)) {
    if ((sp.get(key) || "") !== String(query[key])) return false;
  }

  // prevent BOTH "My Requests" and "All Requests" active
  if (basePath === "/requests") {
    const currentView = (sp.get("view") || "").toLowerCase();
    const itemView = (query.view || "").toLowerCase();

    if (!itemView && currentView) return false;
  }

  return true;
}

export default function Navbar() {
  const { user, logoutUser, loading } = useContext(AuthContext);
  const { unreadCount } = useContext(NotificationContext);

  const pathname = usePathname();
  const sp = useSearchParams();

  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname, sp]);

  const isLoggedIn = !!user?.role || !!user?.token;

  const role = useMemo(() => normalizeRole(user?.role), [user?.role]);
  const name = user?.name || user?.displayUsername || user?.username || "User";
  const position = user?.position || role || "";

  const isPM = role === "PROJECT_MANAGER";
  const isRP = role === "RESOURCE_PLANNER";
  const isPO = role === "PROCUREMENT_OFFICER";
  const isAdmin = role === "SYSTEM_ADMIN";
  const isProvider = role === "SERVICE_PROVIDER";

  const canSeeAdminMenu = isPM || isRP || isPO || isAdmin;

  const navItems = useMemo(() => {
    if (!isLoggedIn) {
      return [
        { href: "/auth/login", label: "Login" },
        { href: "/auth/register", label: "Register" },
      ];
    }

    if (isPM) {
      return [
        { href: "/dashboard", label: "Dashboard" },
        { href: "/projects", label: "Projects" },
        { href: "/contracts", label: "Contracts" },
        { href: "/requests?view=my", label: "My Requests" },
        { href: "/requests", label: "All Requests" },
      ];
    }

    if (isProvider) {
      return [{ href: "/sp/bidding", label: "Bidding Requests" }];
    }

    if (canSeeAdminMenu) {
      return [
        { href: "/dashboard", label: "Dashboard" },
        { href: "/projects", label: "Projects" },
        { href: "/contracts", label: "Contracts" },
        { href: "/requests", label: "All Requests" },

        // ✅ only PO can see orders menu
        ...(isPO ? [{ href: "/orders", label: "My Orders" }] : []),
      ];
    }

    return [{ href: "/dashboard", label: "Dashboard" }];
  }, [isLoggedIn, isPM, isProvider, canSeeAdminMenu, isPO]);

  return (
    <header className="sticky top-0 z-40 border-b border-slate-800 bg-slate-950/80 backdrop-blur">
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-3 flex items-center justify-between gap-3">
        {/* LEFT */}
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-full border border-emerald-500/50 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300"
          >
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-[11px] text-black">
              SM
            </span>
            <span>Service Portal</span>
          </Link>

          {!loading && isLoggedIn && (
            <div className="hidden sm:flex flex-col">
              <span className="text-[11px] text-slate-200">{name}</span>
              <span className="text-[10px] text-slate-400">
                {position || "—"}
              </span>
            </div>
          )}
        </div>

        {/* MIDDLE */}
        <nav className="hidden md:flex items-center gap-2 text-xs">
          {!loading ? (
            navItems.map((item) => (
              <NavLink
                key={item.href}
                href={item.href}
                label={item.label}
                active={isActiveNav(item.href, pathname, sp)}
              />
            ))
          ) : (
            <span className="text-[11px] text-slate-400">Loading...</span>
          )}
        </nav>

        {/* RIGHT */}
        <div className="flex items-center gap-2">
          {!loading && isLoggedIn && (
            <>
              <Link
                href="/notifications"
                className="relative p-2 rounded-full border border-slate-700 hover:border-emerald-400 hover:bg-slate-800 transition"
                title="Notifications"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4 text-slate-200"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="1.6"
                >
                  <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>

                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] px-1 rounded-full bg-emerald-500 text-[9px] font-semibold text-black flex items-center justify-center">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </Link>

              <button
                onClick={logoutUser}
                className="px-2 py-1 rounded-full border border-slate-700 hover:border-red-400 hover:bg-slate-800 transition"
                title="Logout"
                type="button"
              >
                Logout
              </button>
            </>
          )}

          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="md:hidden h-9 w-9 flex items-center justify-center rounded-lg border border-slate-700 bg-slate-900 text-slate-200"
            disabled={loading}
            type="button"
            aria-label="Menu"
          >
            ☰
          </button>
        </div>
      </div>

      {/* MOBILE MENU */}
      {menuOpen && !loading && (
        <div className="border-t border-slate-800 bg-slate-950 md:hidden">
          <div className="px-4 py-3 space-y-1">
            {navItems.map((item) => (
              <MobileLink
                key={item.href}
                href={item.href}
                label={item.label}
                onClick={() => setMenuOpen(false)}
              />
            ))}

            {isLoggedIn && (
              <button
                onClick={logoutUser}
                className="mt-2 w-full text-left text-xs text-red-400 px-2 py-2 rounded hover:bg-slate-900"
                type="button"
              >
                Logout
              </button>
            )}
          </div>
        </div>
      )}
    </header>
  );
}

function NavLink({ href, label, active }) {
  return (
    <Link
      href={href}
      className={
        "px-3 py-1.5 rounded-lg text-xs transition " +
        (active
          ? "bg-slate-800 text-emerald-200"
          : "hover:bg-slate-800 text-slate-200")
      }
    >
      {label}
    </Link>
  );
}

function MobileLink({ href, label, onClick }) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="block px-2 py-2 rounded hover:bg-slate-800 text-slate-200 text-sm"
    >
      {label}
    </Link>
  );
}
