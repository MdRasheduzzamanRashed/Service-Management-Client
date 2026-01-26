"use client";

import { useEffect, useMemo, useState, useContext } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AuthContext } from "../context/AuthContext";

/* =========================
   Helpers
========================= */
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

function roleLabel(role) {
  const r = normalizeRole(role);
  if (!r) return "GUEST";
  return r;
}

function isActive(pathname, href) {
  if (!pathname) return false;
  const base = String(href || "").split("?")[0] || "/";
  return pathname === base || (base !== "/" && pathname.startsWith(base + "/"));
}

/* =========================
   LayoutShell
========================= */
export default function LayoutShell({ children }) {
  const { user, logoutUser, loading } = useContext(AuthContext);

  const pathname = usePathname();
  const router = useRouter();

  const [sidebarOpen, setSidebarOpen] = useState(false);

  const isAuthPage = useMemo(() => {
    const p = pathname || "";
    return p.startsWith("/auth/login") || p.startsWith("/auth/register");
  }, [pathname]);

  const isLoggedIn = !!user?.token || !!user?.role;

  const role = useMemo(() => normalizeRole(user?.role), [user?.role]);

  const isPM = role === "PROJECT_MANAGER";
  const isPO = role === "PROCUREMENT_OFFICER";
  const isRP = role === "RESOURCE_PLANNER";
  const isAdmin = role === "SYSTEM_ADMIN";
  const isProvider = role === "SERVICE_PROVIDER";

  useEffect(() => {
    // close sidebar when route changes
    setSidebarOpen(false);
  }, [pathname]);

  useEffect(() => {
    // ✅ redirect if not logged in and not on auth page
    if (!loading && !isLoggedIn && !isAuthPage) {
      router.replace("/auth/login");
    }
  }, [loading, isLoggedIn, isAuthPage, router]);

  // While loading auth state, show fallback
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-300">
        Loading...
      </div>
    );
  }

  // Public pages (login/register): render without shell
  if (!isLoggedIn && isAuthPage) {
    return <div>{children}</div>;
  }

  // If no user and not on auth page -> we triggered router.replace, return nothing
  if (!isLoggedIn && !isAuthPage) {
    return null;
  }

  // Sidebar items by role (✅ swapped responsibilities ready)
  const sidebarItems = useMemo(() => {
    // Provider (public bidding)
    if (isProvider) {
      return [{ href: "/sp/bidding", label: "Bidding Requests" }];
    }

    // PM
    if (isPM) {
      return [
        { href: "/dashboard", label: "Dashboard" },
        { href: "/projects", label: "Projects" },
        { href: "/contracts", label: "Contracts" },
        { href: "/requests?view=my", label: "My Requests" },
        { href: "/requests", label: "All Requests" },
        { href: "/notifications", label: "Notifications" },
      ];
    }

    // PO (review + recommend now)
    if (isPO) {
      return [
        { href: "/dashboard", label: "Dashboard" },
        { href: "/projects", label: "Projects" },
        { href: "/contracts", label: "Contracts" },
        { href: "/requests?status=IN_REVIEW", label: "Review (IN_REVIEW)" },
        { href: "/requests/bid-evaluation", label: "Bid Evaluation" },
        { href: "/requests", label: "All Requests" },
        { href: "/orders", label: "My Orders" },
        { href: "/notifications", label: "Notifications" },
      ];
    }

    // RP (ordering role after SENT_TO_PO)
    if (isRP) {
      return [
        { href: "/dashboard", label: "Dashboard" },
        { href: "/projects", label: "Projects" },
        { href: "/contracts", label: "Contracts" },
        { href: "/requests?status=SENT_TO_PO", label: "Ready to Order" },
        { href: "/orders", label: "Orders" },
        { href: "/requests", label: "All Requests" },
        { href: "/notifications", label: "Notifications" },
      ];
    }

    // Admin
    if (isAdmin) {
      return [
        { href: "/dashboard", label: "Dashboard" },
        { href: "/projects", label: "Projects" },
        { href: "/contracts", label: "Contracts" },
        { href: "/requests", label: "All Requests" },
        { href: "/orders", label: "Orders" },
        { href: "/notifications", label: "Notifications" },
      ];
    }

    // Fallback
    return [{ href: "/dashboard", label: "Dashboard" }];
  }, [isProvider, isPM, isPO, isRP, isAdmin]);

  const displayName =
    user?.name || user?.displayUsername || user?.username || "User";
  const displayRole = roleLabel(user?.role);

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-30 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* SIDEBAR */}
      <aside
        className={
          "fixed md:static z-40 bg-slate-900 border-r border-slate-800 w-64 h-full p-6 flex flex-col transition-transform duration-300 " +
          (sidebarOpen ? "translate-x-0" : "-translate-x-64 md:translate-x-0")
        }
        aria-label="Sidebar"
      >
        <div className="mb-8">
          <h1 className="text-xl font-bold tracking-tight text-emerald-400">
            Service Portal
          </h1>
          <p className="text-xs text-slate-400 mt-1">{displayRole}</p>
        </div>

        <nav className="flex flex-col gap-2 text-sm">
          {sidebarItems.map((item) => (
            <SidebarLink
              key={item.href}
              href={item.href}
              label={item.label}
              active={isActive(pathname, item.href)}
            />
          ))}
        </nav>

        <div className="mt-auto text-xs text-slate-500">
          © {new Date().getFullYear()} Service Management
        </div>
      </aside>

      {/* MAIN AREA */}
      <div className="flex-1 flex flex-col">
        {/* NAVBAR */}
        <header className="bg-slate-900/80 backdrop-blur border-b border-slate-800 py-3 px-4 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            {/* Hamburger for mobile */}
            <button
              className="md:hidden p-2 rounded bg-slate-800"
              onClick={() => setSidebarOpen((v) => !v)}
              type="button"
              aria-label="Toggle menu"
            >
              ☰
            </button>

            <div className="min-w-0">
              <h2 className="text-base font-semibold tracking-tight truncate">
                Service Management Portal
              </h2>
              <p className="text-[11px] text-slate-400 hidden md:block">
                End-to-end workflow for service requests and provider
                management.
              </p>
            </div>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-3">
            <span className="hidden sm:inline text-xs text-slate-300">
              {displayName}
            </span>

            <span className="px-3 py-1 text-xs rounded-full bg-emerald-600/10 border border-emerald-600/40 text-emerald-300">
              {displayRole}
            </span>

            <button
              onClick={logoutUser}
              className="px-3 py-1 bg-red-500 text-black rounded hover:bg-red-600 text-xs sm:text-sm"
              type="button"
              title="Logout"
            >
              Logout
            </button>
          </div>
        </header>

        <main className="p-4 md:p-6 max-w-7xl mx-auto w-full">{children}</main>
      </div>
    </div>
  );
}

function SidebarLink({ href, label, active }) {
  return (
    <Link
      href={href}
      className={
        "px-3 py-2 rounded-lg border transition " +
        (active
          ? "bg-slate-800 border-slate-700 text-emerald-200"
          : "border-transparent hover:bg-slate-800 hover:border-slate-700 text-slate-200")
      }
    >
      {label}
    </Link>
  );
}
