"use client";

import { useState, useContext } from "react";
import Link from "next/link";
import { AuthContext } from "../context/AuthContext";

export default function LayoutShell({ children }) {
  const { user, logoutUser, loading } = useContext(AuthContext);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // While loading auth state, just show fallback
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-300">
        Loading...
      </div>
    );
  }

  // For public pages (login/register), render without nav/shell
  const path = typeof window !== "undefined" ? window.location.pathname : "";
  const isAuthPage =
    path.startsWith("/auth/login") || path.startsWith("/auth/register");

  if (!user && isAuthPage) {
    return <div>{children}</div>;
  }

  // If no user and not on auth page -> redirect hint
  if (!user && !isAuthPage) {
    if (typeof window !== "undefined") {
      if (path !== "/auth/login") {
        window.location.href = "/auth/login";
      }
    }
    return null;
  }

  // Authenticated layout with navbar + sidebar
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
      >
        <div className="mb-8">
          <h1 className="text-xl font-bold tracking-tight text-emerald-400">
            Service Portal
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            {user ? user.role : "Guest"}
          </p>
        </div>

        <nav className="flex flex-col gap-2 text-sm">
          <SidebarLink href="/dashboard" label="Dashboard" />

          {user && user.role === "ProjectManager" && (
            <SidebarLink href="/requests" label="PM Requests" />
          )}

          {user && user.role === "ProcurementOfficer" && (
            <SidebarLink
              href="/requests?view=procurement"
              label="Procurement Review"
            />
          )}

          {user && user.role === "ResourcePlanner" && (
            <SidebarLink href="/requests?view=planner" label="Planner Tools" />
          )}

          <SidebarLink href="/service-orders" label="Service Orders" />
        </nav>

        <div className="mt-auto text-xs text-slate-500">
          © {new Date().getFullYear()} Service Management
        </div>
      </aside>

      {/* MAIN AREA */}
      <div className="flex-1 flex flex-col">
        {/* NAVBAR */}
        <header className="bg-slate-900/80 backdrop-blur border-b border-slate-800 py-3 px-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Hamburger for mobile */}
            <button
              className="md:hidden p-2 rounded bg-slate-800"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              ☰
            </button>

            <div>
              <h2 className="text-base font-semibold tracking-tight">
                Service Management Portal
              </h2>
              <p className="text-[11px] text-slate-400 hidden md:block">
                End-to-end workflow for service requests and provider management.
              </p>
            </div>
          </div>

          {/* Right side */}
          {user && (
            <div className="flex items-center gap-3">
              <span className="hidden sm:inline text-xs text-slate-300">
                {user.name}
              </span>
              <span className="px-3 py-1 text-xs rounded-full bg-emerald-600/10 border border-emerald-600/40 text-emerald-300">
                {user.role}
              </span>
              <button
                onClick={logoutUser}
                className="px-3 py-1 bg-red-500 text-black rounded hover:bg-red-600 text-xs sm:text-sm"
              >
                Logout
              </button>
            </div>
          )}
        </header>

        <main className="p-4 md:p-6 max-w-7xl mx-auto w-full">{children}</main>
      </div>
    </div>
  );
}

function SidebarLink({ href, label }) {
  return (
    <Link
      href={href}
      className="px-3 py-2 rounded-lg hover:bg-slate-800 hover:border-slate-700 border border-transparent transition"
    >
      {label}
    </Link>
  );
}
