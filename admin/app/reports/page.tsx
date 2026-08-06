import { prisma } from "../../lib/prisma";
import { getSession, requireRole } from "../../lib/session";
import { redirect } from "next/navigation";
import AdminShell from "../../components/AdminShell";

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
  const paidThisMonth = await prisma.booking.findMany({
    where: { platformFeePaidAt: { gte: startOfMonth } },
  });

  const revenueThisMonth = paidThisMonth.reduce(
    (sum, b) => sum + Number(b.platformFeeAmount || 0),
    0
  );

  const [totalBookings, cancelledBookings, paymentPending] = await Promise.all([
    prisma.booking.count(),
    prisma.booking.count({ where: { status: "CANCELLED" } }),
    prisma.booking.count({ where: { status: "PAYMENT_PENDING" } }),
  ]);

  const stats = [
    { label: "Revenue this month", value: `Rs ${revenueThisMonth.toLocaleString()}` },
    { label: "Trips paid this month", value: paidThisMonth.length },
    { label: "Total bookings (all time)", value: totalBookings },
    { label: "Cancelled bookings", value: cancelledBookings },
    { label: "Payment-pending bookings", value: paymentPending },
  ];

  return (
    <AdminShell activeHref="/reports">
      <div style={{ padding: 24, fontFamily: "sans-serif" }}>
        <h1 style={{ fontSize: 20, fontWeight: 500 }}>Reports</h1>
        <p style={{ fontSize: 13, color: "#5F5E5A" }}>
          Revenue counts only bookings with a webhook-confirmed payment
          capture — not trips merely marked complete.
        </p>

        <a
          href="/reports/export"
          style={{
            display: "inline-block",
            marginTop: 8,
            fontSize: 13,
            background: "#1A1A18",
            color: "#fff",
            borderRadius: 6,
            padding: "8px 14px",
            textDecoration: "none",
          }}
        >
          Export paid bookings as CSV
        </a>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginTop: 16 }}>
          {stats.map((s) => (
            <div key={s.label} style={{ background: "#F1EFE8", borderRadius: 8, padding: 16 }}>
              <div style={{ fontSize: 13, color: "#5F5E5A" }}>{s.label}</div>
              <div style={{ fontSize: 22, fontWeight: 500, marginTop: 4 }}>{s.value}</div>
            </div>
          ))}
        </div>
      </div>
    </AdminShell>
  );
}
