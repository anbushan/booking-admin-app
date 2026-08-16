import Link from "next/link";
import { prisma } from "../../lib/prisma";
import { getSession, requireRole } from "../../lib/session";
import { redirect } from "next/navigation";
import AdminShell from "../../components/AdminShell";
import { PageHeader } from "../../components/PageHeader";
import { StatCard } from "../../components/StatCard";
import { LayoutDashboard, Users, Car, UserCheck, Route, Wallet, ShieldCheck, AlertTriangle, RotateCcw, Flag } from "lucide-react";

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

  // Actionable counts, not just totals — each one is a real queue
  // someone needs to work through, so it links straight there instead
  // of just reporting a number nobody can act on from this page.
  const [pendingDriverVerifications, pendingVehicleVerifications, pendingPassengerVerifications, openSosAlerts, pendingRefunds, flaggedReviews] =
    await Promise.all([
      prisma.driverVerification.count({ where: { licenseStatus: { in: ["PENDING"] }, paymentStatus: "PAID" } }),
      prisma.vehicleVerification.count({ where: { rcStatus: { in: ["PENDING"] }, paymentStatus: { in: ["PAID", "WAIVED"] } } }),
      prisma.passengerVerification.count({ where: { aadhaarStatus: "PENDING" } }),
      prisma.sosAlert.count({ where: { status: "OPEN" } }),
      prisma.refund.count({ where: { status: { in: ["INITIATED", "PROCESSING"] } } }),
      prisma.review.count({ where: { flagged: true } }),
    ]);

  const attention = [
    { label: "Open SOS alerts", value: openSosAlerts, icon: AlertTriangle, tone: openSosAlerts > 0 ? "warning" as const : "neutral" as const, href: "/sos-alerts" },
    { label: "Pending driver checks", value: pendingDriverVerifications, icon: ShieldCheck, tone: "neutral" as const, href: "/drivers/verification-queue" },
    { label: "Pending vehicle checks", value: pendingVehicleVerifications, icon: ShieldCheck, tone: "neutral" as const, href: "/drivers/vehicle-verification-queue" },
    { label: "Pending passenger checks", value: pendingPassengerVerifications, icon: ShieldCheck, tone: "neutral" as const, href: "/users/verification-queue" },
    { label: "Refunds in progress", value: pendingRefunds, icon: RotateCcw, tone: "neutral" as const, href: "/refunds" },
    { label: "Flagged reviews", value: flaggedReviews, icon: Flag, tone: flaggedReviews > 0 ? "warning" as const : "neutral" as const, href: "/reviews/flagged" },
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

      <h2 style={{ fontSize: 15, fontWeight: 500, marginTop: 28, marginBottom: 12 }}>Needs attention</h2>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 12,
        }}
      >
        {attention.map((s) => (
          <Link key={s.label} href={s.href} style={{ textDecoration: "none", color: "inherit" }}>
            <StatCard icon={s.icon} label={s.label} value={s.value} tone={s.tone} />
          </Link>
        ))}
      </div>
    </div>
    </AdminShell>
  );
}
