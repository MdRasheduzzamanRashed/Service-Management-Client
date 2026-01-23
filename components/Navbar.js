import { Suspense } from "react";
import NavbarClient from "./NavbarClient";

export default function Navbar() {
  return (
    <Suspense
      fallback={
        <header className="sticky top-0 z-40 border-b border-slate-800 bg-slate-950/80 backdrop-blur">
          <div className="max-w-7xl mx-auto px-4 md:px-6 py-3 text-xs text-slate-400">
            Loading...
          </div>
        </header>
      }
    >
      <NavbarClient />
    </Suspense>
  );
}
