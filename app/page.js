"use client";

import { useContext, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AuthContext } from "../context/AuthContext";

export default function Home() {
  const { user, loading } = useContext(AuthContext);
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (user) router.replace("/dashboard");
    else router.replace("/auth/login");
  }, [user, loading, router]);

  return (
    <main className="min-h-screen flex items-center justify-center text-slate-300">
      Redirecting...
    </main>
  );
}
