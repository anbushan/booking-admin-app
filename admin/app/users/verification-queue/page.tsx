import { prisma } from "../../../lib/prisma";
import { getSession, requireRole } from "../../../lib/session";
import { redirect } from "next/navigation";
import AdminShell from "../../../components/AdminShell";
import { PageHeader } from "../../../components/PageHeader";
import { Badge } from "../../../components/Badge";
import { ShieldCheck } from "lucide-react";
import { EmptyState } from "../../../components/EmptyState";
import Pagination from "../../../components/Pagination";

export const dynamic = "force-dynamic";
const PAGE_SIZE = 25;

// The passenger-side counterpart to /drivers/verification-queue and
// /drivers/vehicle-verification-queue — reads PassengerVerification
// (real, paid Aadhaar e-KYC via Eko, OTP-consent based — see
// backend/src/lib/eko.js) rather than the legacy Document review path,
// since Aadhaar was never part of that manual-upload system to begin
// with. Read-only: unlike the Document queue there's nothing to
// approve/reject here — Eko already decided VERIFIED/FAILED, this is
// for support/dispute lookups (a stuck CHARGE_ATTEMPTED, a FAILED
// result someone's asking about) rather than a review action.
export default async function PassengerVerificationQueuePage({ searchParams }: { searchParams: { page?: string } }) {
  const session = getSession();
  if (!requireRole(session, ["verification", "support"])) {
    redirect("/login");
  }

  const page = Math.max(1, Number(searchParams.page || 1));

  const [records, total] = await Promise.all([
    prisma.passengerVerification.findMany({
      include: { user: { select: { id: true, name: true, phone: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.passengerVerification.count(),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <AdminShell activeHref="/users/verification-queue">
      <div style={{ padding: 24 }}>
        <PageHeader icon={ShieldCheck} title="Passenger verification (Aadhaar)" subtitle={`${total} record(s)`} />

        <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 12 }}>
          {records.map((rec) => (
            <div
              key={rec.id}
              style={{
                border: "1px solid #E3E1D8",
                borderRadius: 8,
                padding: 16,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
                <div>
                  <a href={`/users/${rec.user.id}`} style={{ fontWeight: 500, fontSize: 14, color: "#0C447C" }}>
                    {rec.user.name || rec.user.phone}
                  </a>
                  <div style={{ fontSize: 12, color: "#888780", marginTop: 4 }}>
                    Record created {rec.createdAt.toLocaleDateString()}
                    {rec.aadhaarVerifiedAt && ` · resolved ${rec.aadhaarVerifiedAt.toLocaleString()}`}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <Badge>{rec.paymentStatus}</Badge>
                  <Badge>{rec.aadhaarStatus}</Badge>
                  {rec.amountPaidInr != null && <Badge tone="neutral">{`Rs ${rec.amountPaidInr.toString()}`}</Badge>}
                </div>
              </div>
              {rec.aadhaarEkoResponse != null && (
                <details style={{ marginTop: 8 }}>
                  <summary style={{ cursor: "pointer", color: "#0C447C", fontSize: 12 }}>Raw Eko response</summary>
                  <pre style={{ fontSize: 11, background: "#F1EFE8", padding: 8, borderRadius: 6, overflowX: "auto", marginTop: 4 }}>
                    {JSON.stringify(rec.aadhaarEkoResponse, null, 2)}
                  </pre>
                </details>
              )}
            </div>
          ))}
          {records.length === 0 && <EmptyState title="No passenger verification attempts yet" />}
        </div>
        <Pagination page={page} totalPages={totalPages} basePath="/users/verification-queue" />
      </div>
    </AdminShell>
  );
}
