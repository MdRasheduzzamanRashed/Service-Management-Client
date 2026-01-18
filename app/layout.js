import "./globals.css";
import { Inter } from "next/font/google";
import Navbar from "../components/Navbar";
import { AuthProvider } from "../context/AuthContext";
import { ToastProvider } from "../context/ToastContext";
import { NotificationProvider } from "../context/NotificationContext";

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
            </NotificationProvider>
          </ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}