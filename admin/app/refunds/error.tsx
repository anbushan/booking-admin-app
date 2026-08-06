"use client";

import AdminShell from "../../components/AdminShell";
import { ErrorState } from "../../components/ErrorState";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <AdminShell activeHref="/refunds">
      <div style={{ padding: 24, fontFamily: "sans-serif" }}>
        <h1 style={{ fontSize: 20, fontWeight: 500 }}>Refunds</h1>
        <ErrorState message="Couldn't load refunds." onRetry={reset} />
      </div>
    </AdminShell>
  );
}
