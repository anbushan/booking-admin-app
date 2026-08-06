"use client";

import AdminShell from "../../../components/AdminShell";
import { ErrorState } from "../../../components/ErrorState";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <AdminShell activeHref="/drivers/verification-queue">
      <div style={{ padding: 24, fontFamily: "sans-serif" }}>
        <h1 style={{ fontSize: 20, fontWeight: 500 }}>Driver verification queue</h1>
        <ErrorState message="Couldn't load the verification queue." onRetry={reset} />
      </div>
    </AdminShell>
  );
}
