"use client";

import { createContext, useState } from "react";

export const ToastContext = createContext({
  showToast: () => {}
});

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  function showToast({ title, type = "info", link = null }) {
    const id = Date.now();

    const toast = { id, title, type, link };

    setToasts((prev) => {
      const arr = [...prev, toast];
      return arr.length > 5 ? arr.slice(arr.length - 5) : arr;
    });

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 6000);
  }

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}

      <div className="fixed top-4 right-4 z-50 space-y-3 w-72">
        {toasts.map((toast) => (
          <ToastCard key={toast.id} {...toast} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastCard({ title, type, link }) {
  const colors = {
    success: "bg-emerald-500 text-black",
    info: "bg-blue-500 text-white",
    warning: "bg-amber-400 text-black",
    error: "bg-red-500 text-white",
  };

  const cls = colors[type] || colors.info;

  return (
    <div
      onClick={() => link && window.location.assign(link)}
      className={cls + " cursor-pointer px-4 py-3 rounded-xl shadow-lg animate-toast-in border border-black/10"}
    >
      <p className="text-sm font-medium">{title}</p>
      {link && (
        <p className="text-xs opacity-80 mt-1 underline">Open related item</p>
      )}
    </div>
  );
}