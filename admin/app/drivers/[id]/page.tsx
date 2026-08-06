import { prisma } from "../../../lib/prisma";
import { getSession, requireRole } from "../../../lib/session";
import { redirect } from "next/navigation";
import AdminShell from "../../../components/AdminShell";
import { EmptyState } from "../../../components/EmptyState";

export const dynamic = "force-dynamic";

export default async function DriverDetailPage({ params }: { params: { id: string } }) {
  const session = getSession();
  if (!requireRole(session, ["support", "verification"])) {
    redirect("/login");
  }

  const driver = await prisma.user.findUnique({ where: { id: params.id } });
  if (!driver || driver.role !== "DRIVER") redirect("/users");

  const [vehicles, documents, rides, completedBookings, strikes] = await Promise.all([
    prisma.vehicle.findMany({ where: { driverId: params.id } }),
    prisma.document.findMany({ where: { userId: params.id } }),
    prisma.ride.findMany({ where: { driverId: params.id }, orderBy: { travelDate: "desc" }, take: 10 }),
    prisma.booking.findMany({
      where: { status: "COMPLETED", ride: { driverId: params.id } },
    }),
    prisma.driverStrike.findMany({ where: { driverId: params.id }, orderBy: { createdAt: "desc" } }),
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
      <div style={{ padding: 24, fontFamily: "sans-serif" }}>
        <a href="/users" style={{ fontSize: 13, color: "#5F5E5A" }}>{"< Back to users"}</a>
        <h1 style={{ fontSize: 20, fontWeight: 500, marginTop: 8 }}>{driver.name || driver.phone}</h1>
        <div style={{ fontSize: 13, color: "#5F5E5A", marginTop: 4 }}>
          {driver.phone} · {driver.ratingAvg ? `${driver.ratingAvg.toFixed(1)} rating` : "No rating yet"}
        </div>
        <span
          style={{
            display: "inline-block",
            marginTop: 8,
            fontSize: 12,
            padding: "2px 8px",
            borderRadius: 6,
            background: isVerified ? "#EAF3DE" : "#FAEEDA",
            color: isVerified ? "#3B6D11" : "#854F0B",
          }}
        >
          {isVerified ? "Verified" : "Verification pending"}
        </span>
        {isBlocked && (
          <span style={{ display: "inline-block", marginTop: 8, marginLeft: 8, fontSize: 12, padding: "2px 8px", borderRadius: 6, background: "#FBE1E1", color: "#A32D2D" }}>
            Blocked until {driver.strikeBlockedUntil!.toLocaleString()}
          </span>
        )}
        {!isBlocked && driver.strikeFlagged && (
          <span style={{ display: "inline-block", marginTop: 8, marginLeft: 8, fontSize: 12, padding: "2px 8px", borderRadius: 6, background: "#FAEEDA", color: "#854F0B" }}>
            Final warning issued
          </span>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginTop: 20 }}>
          <div style={{ background: "#F1EFE8", borderRadius: 8, padding: 16 }}>
            <div style={{ fontSize: 12, color: "#888780" }}>Total earnings</div>
            <div style={{ fontSize: 20, fontWeight: 500 }}>Rs {totalEarnings.toLocaleString()}</div>
          </div>
          <div style={{ background: "#F1EFE8", borderRadius: 8, padding: 16 }}>
            <div style={{ fontSize: 12, color: "#888780" }}>Trips completed</div>
            <div style={{ fontSize: 20, fontWeight: 500 }}>{completedBookings.length}</div>
          </div>
          <div style={{ background: "#F1EFE8", borderRadius: 8, padding: 16 }}>
            <div style={{ fontSize: 12, color: "#888780" }}>Vehicles</div>
            <div style={{ fontSize: 20, fontWeight: 500 }}>{vehicles.length}</div>
          </div>
          <div style={{ background: "#F1EFE8", borderRadius: 8, padding: 16 }}>
            <div style={{ fontSize: 12, color: "#888780" }}>Strikes (last {rollingWindowDays}d)</div>
            <div style={{ fontSize: 20, fontWeight: 500 }}>{activeStrikeCount}</div>
          </div>
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

        <h2 style={{ fontSize: 15, fontWeight: 500, marginTop: 24 }}>Documents</h2>
        {documents.map((d) => (
          <div key={d.id} style={{ fontSize: 13, padding: "8px 0", borderBottom: "1px solid #E3E1D8" }}>
            {d.docType} — {d.status}
          </div>
        ))}
        {documents.length === 0 && <EmptyState title="No documents uploaded yet" />}

        <h2 style={{ fontSize: 15, fontWeight: 500, marginTop: 24 }}>Recent rides</h2>
        {rides.map((r) => (
          <div key={r.id} style={{ fontSize: 13, padding: "8px 0", borderBottom: "1px solid #E3E1D8" }}>
            <a href={`/rides/${r.id}`} style={{ color: "#0C447C" }}>
              {r.sourceAddress} to {r.destAddress}
            </a>{" "}
            — {r.status}
          </div>
        ))}
        {rides.length === 0 && <EmptyState title="No rides published yet" />}
      </div>
    </AdminShell>
  );
}
