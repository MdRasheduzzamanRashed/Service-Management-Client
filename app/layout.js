import "./globals.css";
import { Inter } from "next/font/google";
import Navbar from "../components/Navbar";
import { AuthProvider } from "../context/AuthContext";
import { ToastProvider } from "../context/ToastContext";
import { NotificationProvider } from "../context/NotificationContext";
import { Toaster } from "react-hot-toast";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "Service Management Portal",
  description: "Workflow platform",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={inter.className}>
      <body className="bg-slate-950 text-slate-100">
        <AuthProvider>
          <ToastProvider>
            <NotificationProvider>
              <Navbar />
              <main className="max-w-7xl mx-auto p-4 md:p-6">{children}</main>

              {/* ✅ react-hot-toast global toaster */}
              <Toaster
                position="top-right"
                toastOptions={{
                  duration: 3500,
                  style: {
                    borderRadius: "14px",
                    background: "#0f172a",
                    color: "#e2e8f0",
                    border: "1px solid rgba(148,163,184,.25)",
                  },
                }}
              />
            </NotificationProvider>
          </ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
