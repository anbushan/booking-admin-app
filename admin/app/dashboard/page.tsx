import { prisma } from "../../lib/prisma";
import { getSession, requireRole } from "../../lib/session";
import { redirect } from "next/navigation";
import AdminShell from "../../components/AdminShell";
import { PageHeader } from "../../components/PageHeader";
import { StatCard } from "../../components/StatCard";
import { LayoutDashboard, Users, Car, UserCheck, Route, Wallet } from "lucide-react";

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
    { label: "Total users", value: totalUsers, icon: Users, tone: "accent" as const },
    { label: "Drivers", value: totalDrivers, icon: Car, tone: "success" as const },
    { label: "Passengers", value: totalPassengers, icon: UserCheck, tone: "accent" as const },
    { label: "Active rides", value: activeRides, icon: Route, tone: "warning" as const },
    { label: "Total bookings", value: totalBookings, icon: LayoutDashboard, tone: "neutral" as const },
    { label: "Fee-paid bookings", value: revenueResult._count, icon: Wallet, tone: "success" as const },
  ];

  return (
    <AdminShell activeHref="/dashboard">
    <div style={{ padding: 24 }}>
      <PageHeader icon={LayoutDashboard} title="Dashboard" subtitle="What's happening across the platform right now." />
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 12,
        }}
      >
        {stats.map((s) => (
          <StatCard key={s.label} icon={s.icon} label={s.label} value={s.value} tone={s.tone} />
        ))}
      </div>
    </div>
    </AdminShell>
  );
}
