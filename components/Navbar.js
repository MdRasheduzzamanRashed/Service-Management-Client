"use client";

import Link from "next/link";
import { useContext, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { AuthContext } from "../context/AuthContext";
import { NotificationContext } from "../context/NotificationContext";

export default function Navbar() {
  const { user, logoutUser, loading } = useContext(AuthContext);
  const { unreadCount } = useContext(NotificationContext);

  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  const isLoggedIn = !!user;
  const role = user?.role || "";
  const name = user?.name || "User";
  const position = user?.position || role;

  const isPM = role === "PROJECT_MANAGER" || role === "ProjectManager";
  const isAdmin =
    role === "RESOURCE_PLANNER" ||
    role === "PROCUREMENT_OFFICER" ||
    role === "SYSTEM_ADMIN" ||
    role === "ResourcePlanner" ||
    role === "ProcurementOfficer" ||
    role === "System";

  const navItems = isLoggedIn
    ? isPM
      ? [
          { href: "/dashboard", label: "Dashboard" },
          { href: "/projects", label: "Projects" }, // ✅ ADDED
          { href: "/contact", label: "Contact" },
          { href: "/requests?view=my", label: "My Requests" },
          { href: "/requests", label: "All Requests" },
        ]
      : isAdmin
      ? [
          { href: "/dashboard", label: "Dashboard" },
          { href: "/projects", label: "Projects" }, // ✅ ADDED
          { href: "/contact", label: "Contact" },
          { href: "/requests", label: "All Requests" },
        ]
      : []
    : [
        { href: "/auth/login", label: "Login" },
        { href: "/auth/register", label: "Register" },
      ];

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

          {isLoggedIn && (
            <div className="hidden sm:flex flex-col">
              <span className="text-[11px] text-slate-200">{name}</span>
              <span className="text-[10px] text-slate-400">{position}</span>
            </div>
          )}
        </div>

        {/* MIDDLE */}
        <nav className="hidden md:flex items-center gap-2 text-xs">
          {!loading &&
            navItems.map((item) => (
              <NavLink key={item.href} href={item.href} label={item.label} />
            ))}
          {loading && (
            <span className="text-[11px] text-slate-400">Loading...</span>
          )}
        </nav>

        {/* RIGHT */}
        <div className="flex items-center gap-2">
          {!loading && isLoggedIn && (
            <>
              {/* Notifications */}
              <Link
                href="/notifications"
                className="relative p-2 rounded-full border border-slate-700 hover:border-emerald-400 hover:bg-slate-800 transition"
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

              {/* Logout */}
              <button
                onClick={logoutUser}
                className="px-2 py-1 rounded-full border border-slate-700 hover:border-red-400 hover:bg-slate-800 transition"
                title="Logout"
              >
                Logout
              </button>
            </>
          )}

          {/* Mobile menu */}
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="md:hidden h-9 w-9 flex items-center justify-center rounded-lg border border-slate-700 bg-slate-900 text-slate-200"
            disabled={loading}
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

function NavLink({ href, label }) {
  return (
    <Link
      href={href}
      className="px-3 py-1.5 rounded-lg hover:bg-slate-800 text-slate-200 text-xs transition"
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
