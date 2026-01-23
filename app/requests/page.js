import { Suspense } from "react";
import RequestsClient from "./RequestsClient";

export default function RequestsPage() {
  return (
    <Suspense fallback={<div className="p-6 text-slate-300">Loading…</div>}>
      <RequestsClient />
    </Suspense>
  );
}
