import { prisma } from "../../lib/prisma";
import { getSession, requireRole } from "../../lib/session";
import { redirect } from "next/navigation";
import AdminShell from "../../components/AdminShell";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = getSession();
  if (!requireRole(session, ["finance", "verification", "support"])) {
    redirect("/login");
  }

  const [totalUsers, totalDrivers, totalPassengers, activeRides, totalBookings] =
    await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { role: "DRIVER" } }),
      prisma.user.count({ where: { role: "PASSENGER" } }),
      // "Active" = still open for booking OR a trip is currently
      // underway on it — PUBLISHED alone under-counts once a ride's
      // trip has started (it moves to IN_PROGRESS and stops being
      // publicly bookable, but it's still very much active).
      prisma.ride.count({ where: { status: { in: ["PUBLISHED", "IN_PROGRESS"] } } }),
      prisma.booking.count(),
    ]);

  // "Paid" now means the platform fee was captured — the only amount
  // ever charged in-app (the remaining fare is settled directly between
  // passenger and driver).
  const revenueResult = await prisma.booking.aggregate({
    where: { platformFeePaidAt: { not: null } },
    _count: true,
  });

  const stats = [
    { label: "Total users", value: totalUsers },
    { label: "Drivers", value: totalDrivers },
    { label: "Passengers", value: totalPassengers },
    { label: "Active rides", value: activeRides },
    { label: "Total bookings", value: totalBookings },
    { label: "Fee-paid bookings", value: revenueResult._count },
  ];

  return (
    <AdminShell activeHref="/dashboard">
    <div style={{ padding: 24, fontFamily: "sans-serif" }}>
      <h1 style={{ fontSize: 20, fontWeight: 500 }}>Dashboard</h1>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: 12,
          marginTop: 16,
        }}
      >
        {stats.map((s) => (
          <div
            key={s.label}
            style={{
              background: "#F1EFE8",
              borderRadius: 8,
              padding: 16,
            }}
          >
            <div style={{ fontSize: 13, color: "#5F5E5A" }}>{s.label}</div>
            <div style={{ fontSize: 24, fontWeight: 500, marginTop: 4 }}>{s.value}</div>
          </div>
        ))}
      </div>
    </div>
    </AdminShell>
  );
}
