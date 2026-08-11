import { prisma } from "../../lib/prisma";
import { getSession, requireRole } from "../../lib/session";
import { redirect } from "next/navigation";
import AdminShell from "../../components/AdminShell";

import { PageHeader } from "../../components/PageHeader";
import { StatCard } from "../../components/StatCard";
import { BarChart3, Wallet, Route, LayoutDashboard, XCircle, Clock } from "lucide-react";
export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const session = getSession();
  if (!requireRole(session, ["finance"])) {
    redirect("/login");
  }

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  // Platform revenue is the fee, not the full fare — the remaining fare
  // is settled directly between passenger and driver and never reaches
  // the platform.
  //
  // PERFORMANCE: this used to fetch every full Booking row paid this
  // month just to sum one column and count them — aggregate() does both
  // in the database in one query instead of transferring every row over
  // the wire to reduce() in JS. Rolled into the same Promise.all as the
  // three counts below so all four run in parallel rather than one more
  // sequential round trip.
  const [paidThisMonth, totalBookings, cancelledBookings, paymentPending] = await Promise.all([
    prisma.booking.aggregate({
      where: { platformFeePaidAt: { gte: startOfMonth } },
      _sum: { platformFeeAmount: true },
      _count: true,
    }),
    prisma.booking.count(),
    prisma.booking.count({ where: { status: "CANCELLED" } }),
    prisma.booking.count({ where: { status: "PAYMENT_PENDING" } }),
  ]);

  const revenueThisMonth = Number(paidThisMonth._sum.platformFeeAmount || 0);

  const stats = [
    { label: "Revenue this month", value: `Rs ${revenueThisMonth.toLocaleString()}`, icon: Wallet, tone: "success" as const },
    { label: "Trips paid this month", value: paidThisMonth._count, icon: Route, tone: "accent" as const },
    { label: "Total bookings (all time)", value: totalBookings, icon: LayoutDashboard, tone: "neutral" as const },
    { label: "Cancelled bookings", value: cancelledBookings, icon: XCircle, tone: "neutral" as const },
    { label: "Payment-pending bookings", value: paymentPending, icon: Clock, tone: "warning" as const },
  ];

  return (
    <AdminShell activeHref="/reports">
      <div style={{ padding: 24, fontFamily: "sans-serif" }}>
        <PageHeader icon={BarChart3} title="Reports" />
        <p style={{ fontSize: 13, color: "#5F5E5A" }}>
          Revenue counts only bookings with a webhook-confirmed payment
          capture — not trips merely marked complete.
        </p>

        <a href="/reports/export" className="admin-btn admin-btn-primary" style={{ marginTop: 8, width: "fit-content" }}>
          Export paid bookings as CSV
        </a>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginTop: 16 }}>
          {stats.map((s) => (
            <StatCard key={s.label} icon={s.icon} label={s.label} value={s.value} tone={s.tone} />
          ))}
        </div>
      </div>
    </AdminShell>
  );
}
