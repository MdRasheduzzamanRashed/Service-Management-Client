"use client";

import { createContext } from "react";
import toast from "react-hot-toast";

export const ToastContext = createContext({
  showToast: () => {},
});

export function ToastProvider({ children }) {
  function showToast({ title, type = "info", link = null }) {
    const options = {
      duration: 3500,
      style: {
        borderRadius: "14px",
        background: "#0f172a",
        color: "#e2e8f0",
        border: "1px solid rgba(148,163,184,.25)",
      },
    };

    const content = link ? (
      <div className="flex flex-col gap-1">
        <span>{title}</span>
        <span className="text-xs underline opacity-80">Open related item</span>
      </div>
    ) : (
      title
    );

    let t;

    switch (type) {
      case "success":
        t = toast.success(content, options);
        break;
      case "error":
        t = toast.error(content, options);
        break;
      case "warning":
        t = toast(content, { ...options, icon: "⚠️" });
        break;
      default:
        t = toast(content, options);
    }

    if (link) {
      setTimeout(() => {
        const el = document.querySelector(`[data-toast-id="${t}"]`);
        if (el) el.onclick = () => window.location.assign(link);
      }, 100);
    }
  }

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
    </ToastContext.Provider>
  );
}
