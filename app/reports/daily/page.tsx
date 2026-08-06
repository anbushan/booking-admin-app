import { prisma } from "../../../lib/prisma";
import { getSession, requireRole } from "../../../lib/session";
import { redirect } from "next/navigation";
import AdminShell from "../../../components/AdminShell";
import { EmptyState } from "../../../components/EmptyState";

export const dynamic = "force-dynamic";

function startOfDay(d: Date) {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  return r;
}

export default async function DailyReportPage({
  searchParams,
}: {
  searchParams: { from?: string; to?: string; groupBy?: string };
}) {
  const session = getSession();
  if (!requireRole(session, ["finance"])) {
    redirect("/login");
  }

  const groupBy = searchParams.groupBy === "month" ? "month" : "day";
  const to = searchParams.to ? new Date(searchParams.to) : new Date();
  const from = searchParams.from
    ? new Date(searchParams.from)
    : new Date(to.getTime() - 13 * 24 * 60 * 60 * 1000); // default: last 14 days

  const bookings = await prisma.booking.findMany({
    where: {
      status: "PAID",
      tripCompletedAt: { gte: startOfDay(from), lte: to },
    },
    include: { ride: { select: { pricePerSeat: true } } },
    orderBy: { tripCompletedAt: "asc" },
  });

  const buckets = new Map<string, { revenue: number; trips: number }>();
  for (const b of bookings) {
    if (!b.tripCompletedAt) continue;
    const key =
      groupBy === "month"
        ? `${b.tripCompletedAt.getFullYear()}-${String(b.tripCompletedAt.getMonth() + 1).padStart(2, "0")}`
        : b.tripCompletedAt.toISOString().slice(0, 10);
    const existing = buckets.get(key) || { revenue: 0, trips: 0 };
    existing.revenue += Number(b.ride.pricePerSeat) * b.seatsBooked;
    existing.trips += 1;
    buckets.set(key, existing);
  }
  const rows = Array.from(buckets.entries()).sort((a, b) => (a[0] < b[0] ? 1 : -1));

  return (
    <AdminShell activeHref="/reports/daily">
      <div style={{ padding: 24, fontFamily: "sans-serif" }}>
        <h1 style={{ fontSize: 20, fontWeight: 500 }}>Daily / monthly report</h1>

        <form method="get" style={{ display: "flex", gap: 8, marginTop: 16, alignItems: "center", fontSize: 13 }}>
          <input type="date" name="from" defaultValue={from.toISOString().slice(0, 10)} style={{ height: 34, border: "1px solid #E3E1D8", borderRadius: 6, padding: "0 8px" }} />
          <span>to</span>
          <input type="date" name="to" defaultValue={to.toISOString().slice(0, 10)} style={{ height: 34, border: "1px solid #E3E1D8", borderRadius: 6, padding: "0 8px" }} />
          <select name="groupBy" defaultValue={groupBy} style={{ height: 34 }}>
            <option value="day">By day</option>
            <option value="month">By month</option>
          </select>
          <button type="submit" style={{ background: "#1A1A18", color: "#fff", border: "none", borderRadius: 6, padding: "8px 14px" }}>
            Apply
          </button>
        </form>

        <table style={{ width: "100%", marginTop: 16, borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "1px solid #E3E1D8" }}>
              <th style={{ padding: "8px 4px" }}>{groupBy === "month" ? "Month" : "Date"}</th>
              <th style={{ padding: "8px 4px" }}>Trips</th>
              <th style={{ padding: "8px 4px" }}>Revenue</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([key, data]) => (
              <tr key={key} style={{ borderBottom: "1px solid #E3E1D8" }}>
                <td style={{ padding: "8px 4px" }}>{key}</td>
                <td style={{ padding: "8px 4px" }}>{data.trips}</td>
                <td style={{ padding: "8px 4px" }}>Rs {data.revenue.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <EmptyState title="No paid trips in this range" />}
      </div>
    </AdminShell>
  );
}
