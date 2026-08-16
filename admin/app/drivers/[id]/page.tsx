import { prisma } from "../../../lib/prisma";
import { getSession, requireRole } from "../../../lib/session";
import { redirect } from "next/navigation";
import AdminShell from "../../../components/AdminShell";
import { EmptyState } from "../../../components/EmptyState";
import { PageHeader } from "../../../components/PageHeader";
import { StatCard } from "../../../components/StatCard";
import { Badge } from "../../../components/Badge";
import { Car, ArrowLeft, Wallet, Route, AlertTriangle } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function DriverDetailPage({ params }: { params: { id: string } }) {
  const session = getSession();
  if (!requireRole(session, ["support", "verification"])) {
    redirect("/login");
  }

  const driver = await prisma.user.findUnique({ where: { id: params.id } });
  if (!driver || driver.role !== "DRIVER") redirect("/users");

  const [vehicles, documents, rides, completedBookings, strikes, ekoVerification] = await Promise.all([
    prisma.vehicle.findMany({ where: { driverId: params.id }, include: { verification: true } }),
    prisma.document.findMany({ where: { userId: params.id } }),
    prisma.ride.findMany({ where: { driverId: params.id }, orderBy: { travelDate: "desc" }, take: 10 }),
    prisma.booking.findMany({
      where: { status: "COMPLETED", ride: { driverId: params.id } },
    }),
    prisma.driverStrike.findMany({ where: { driverId: params.id }, orderBy: { createdAt: "desc" } }),
    // The real, paid license-verification path this app actually runs on
    // (see backend/src/lib/eko.js) — separate from the legacy Document
    // review below, which predates it and is still used by
    // /drivers/verification-queue.
    prisma.driverVerification.findUnique({ where: { driverId: params.id } }),
  ]);

  // Earnings = remaining fare only — the platform fee never reaches the
  // driver, so it's excluded (mirrors GET /api/rides/earnings).
  const totalEarnings = completedBookings.reduce((sum, b) => sum + Number(b.remainingFareAmount || 0), 0);
  const isVerified = documents.length > 0 && documents.every((d) => d.status === "APPROVED");

  const strikeConfig = await prisma.appConfig.findFirst();
  const rollingWindowDays = strikeConfig?.strikeRollingWindowDays ?? 30;
  const rollingCutoff = new Date(Date.now() - rollingWindowDays * 24 * 60 * 60 * 1000);
  const activeStrikeCount = strikes.filter((s) => s.createdAt >= rollingCutoff).length;
  const isBlocked = !!driver.strikeBlockedUntil && driver.strikeBlockedUntil > new Date();

  return (
    <AdminShell activeHref="/users">
      <div style={{ padding: 24 }}>
        <a href="/users" style={{ fontSize: 13, color: "#5F5E5A", display: "inline-flex", alignItems: "center", gap: 4 }}>
          <ArrowLeft size={14} /> Back to users
        </a>
        <div style={{ marginTop: 12 }}>
          <PageHeader icon={Car} title={driver.name || driver.phone} />
        </div>
        <div style={{ fontSize: 13, color: "#5F5E5A", marginTop: -12, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span>{driver.phone} · {driver.ratingAvg ? `${driver.ratingAvg.toFixed(1)} rating` : "No rating yet"}</span>
          <Badge tone={isVerified ? "success" : "warning"}>{isVerified ? "Verified" : "Verification pending"}</Badge>
          {isBlocked && <Badge tone="danger">{`Blocked until ${driver.strikeBlockedUntil!.toLocaleString()}`}</Badge>}
          {!isBlocked && driver.strikeFlagged && <Badge tone="warning">Final warning issued</Badge>}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginTop: 20 }}>
          <StatCard icon={Wallet} label="Total earnings" value={`Rs ${totalEarnings.toLocaleString()}`} tone="success" />
          <StatCard icon={Route} label="Trips completed" value={completedBookings.length} tone="accent" />
          <StatCard icon={Car} label="Vehicles" value={vehicles.length} tone="neutral" />
          <StatCard icon={AlertTriangle} label={`Strikes (last ${rollingWindowDays}d)`} value={activeStrikeCount} tone={activeStrikeCount > 0 ? "warning" : "neutral"} />
        </div>

        <h2 style={{ fontSize: 15, fontWeight: 500, marginTop: 24 }}>Strikes</h2>
        {strikes.map((s) => (
          <div key={s.id} style={{ fontSize: 13, padding: "8px 0", borderBottom: "1px solid #E3E1D8" }}>
            {s.reason === "NO_SHOW" ? "No-show" : "Late cancellation"} — {s.createdAt.toLocaleString()}
            {s.bookingId && (
              <>
                {" "}
                (<a href={`/bookings/${s.bookingId}`} style={{ color: "#0C447C" }}>booking</a>)
              </>
            )}
          </div>
        ))}
        {strikes.length === 0 && <EmptyState title="No strikes on record" />}

        <h2 style={{ fontSize: 15, fontWeight: 500, marginTop: 24 }}>License verification (paid, Eko)</h2>
        {ekoVerification ? (
          <div style={{ fontSize: 13, padding: "10px 0", borderBottom: "1px solid #E3E1D8" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <Badge>{ekoVerification.paymentStatus}</Badge>
              <Badge>{ekoVerification.licenseStatus}</Badge>
              {ekoVerification.amountPaidInr != null && <span style={{ color: "#5F5E5A" }}>Rs {ekoVerification.amountPaidInr.toString()} paid{ekoVerification.paidAt ? ` on ${ekoVerification.paidAt.toLocaleDateString()}` : ""}</span>}
            </div>
            {ekoVerification.licenseVerifiedAt && (
              <div style={{ color: "#888780", marginTop: 4 }}>Verified {ekoVerification.licenseVerifiedAt.toLocaleString()}</div>
            )}
            {ekoVerification.licenseEkoResponse != null && (
              <details style={{ marginTop: 6 }}>
                <summary style={{ cursor: "pointer", color: "#0C447C", fontSize: 12 }}>Raw Eko response</summary>
                <pre style={{ fontSize: 11, background: "#F1EFE8", padding: 8, borderRadius: 6, overflowX: "auto", marginTop: 4 }}>
                  {JSON.stringify(ekoVerification.licenseEkoResponse, null, 2)}
                </pre>
              </details>
            )}
          </div>
        ) : (
          <EmptyState title="Never started a paid license check" />
        )}

        <h2 style={{ fontSize: 15, fontWeight: 500, marginTop: 24 }}>Vehicles &amp; RC verification (paid, Eko)</h2>
        {vehicles.map((v) => (
          <div key={v.id} style={{ fontSize: 13, padding: "10px 0", borderBottom: "1px solid #E3E1D8" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
              <span>{v.make} {v.model} — {v.regNumber}</span>
              {v.verification ? (
                <div style={{ display: "flex", gap: 6 }}>
                  <Badge>{v.verification.paymentStatus}</Badge>
                  <Badge>{v.verification.rcStatus}</Badge>
                </div>
              ) : (
                <Badge tone="neutral">No RC check started</Badge>
              )}
            </div>
            {v.verification?.rcEkoResponse != null && (
              <details style={{ marginTop: 6 }}>
                <summary style={{ cursor: "pointer", color: "#0C447C", fontSize: 12 }}>Raw Eko response</summary>
                <pre style={{ fontSize: 11, background: "#F1EFE8", padding: 8, borderRadius: 6, overflowX: "auto", marginTop: 4 }}>
                  {JSON.stringify(v.verification.rcEkoResponse, null, 2)}
                </pre>
              </details>
            )}
          </div>
        ))}
        {vehicles.length === 0 && <EmptyState title="No vehicles added yet" />}

        <h2 style={{ fontSize: 15, fontWeight: 500, marginTop: 24 }}>Documents (legacy manual review)</h2>
        {documents.map((d) => (
          <div key={d.id} style={{ fontSize: 13, padding: "8px 0", borderBottom: "1px solid #E3E1D8", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
            <span>{d.docType}</span>
            <Badge>{d.status}</Badge>
          </div>
        ))}
        {documents.length === 0 && <EmptyState title="No documents uploaded yet" />}

        <h2 style={{ fontSize: 15, fontWeight: 500, marginTop: 24 }}>Recent rides</h2>
        {rides.map((r) => (
          <div key={r.id} style={{ fontSize: 13, padding: "8px 0", borderBottom: "1px solid #E3E1D8", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
            <a href={`/rides/${r.id}`} style={{ color: "#0C447C" }}>
              {r.sourceAddress} to {r.destAddress}
            </a>
            <Badge>{r.status}</Badge>
          </div>
        ))}
        {rides.length === 0 && <EmptyState title="No rides published yet" />}
      </div>
    </AdminShell>
  );
}
