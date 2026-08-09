import { prisma } from "../../../lib/prisma";
import { getSession, requireRole } from "../../../lib/session";
import { redirect } from "next/navigation";
import AdminShell from "../../../components/AdminShell";
import { PageHeader } from "../../../components/PageHeader";
import { CalendarRange } from "lucide-react";
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

  // Platform revenue is the fee captured, not the full fare — the
  // remaining fare is settled directly between passenger and driver.
  const bookings = await prisma.booking.findMany({
    where: {
      platformFeePaidAt: { gte: startOfDay(from), lte: to },
    },
    orderBy: { platformFeePaidAt: "asc" },
  });

  const buckets = new Map<string, { revenue: number; trips: number }>();
  for (const b of bookings) {
    if (!b.platformFeePaidAt) continue;
    const key =
      groupBy === "month"
        ? `${b.platformFeePaidAt.getFullYear()}-${String(b.platformFeePaidAt.getMonth() + 1).padStart(2, "0")}`
        : b.platformFeePaidAt.toISOString().slice(0, 10);
    const existing = buckets.get(key) || { revenue: 0, trips: 0 };
    existing.revenue += Number(b.platformFeeAmount || 0);
    existing.trips += 1;
    buckets.set(key, existing);
  }
  const rows = Array.from(buckets.entries()).sort((a, b) => (a[0] < b[0] ? 1 : -1));
  // Chart reads left-to-right chronologically (oldest first) — the
  // table below stays newest-first since that's what you scan first
  // when checking "how did we do recently", but a trend line/bar chart
  // reads backwards if it doesn't go the normal time direction.
  const chartRows = [...rows].reverse();
  const maxRevenue = Math.max(1, ...rows.map(([, d]) => d.revenue));

  return (
    <AdminShell activeHref="/reports/daily">
      <div style={{ padding: 24, fontFamily: "sans-serif" }}>
        <PageHeader icon={CalendarRange} title="Daily / monthly report" />

        <form method="get" style={{ display: "flex", gap: 8, marginTop: 16, alignItems: "center", fontSize: 13, flexWrap: "wrap" }}>
          <input type="date" name="from" defaultValue={from.toISOString().slice(0, 10)} className="admin-input" />
          <span>to</span>
          <input type="date" name="to" defaultValue={to.toISOString().slice(0, 10)} className="admin-input" />
          <select name="groupBy" defaultValue={groupBy} className="admin-select">
            <option value="day">By day</option>
            <option value="month">By month</option>
          </select>
          <button type="submit" className="admin-btn admin-btn-primary">
            Apply
          </button>
        </form>

        {chartRows.length > 0 && (
          <div style={{ marginTop: 20, background: "#fff", border: "1px solid #E3E1D8", borderRadius: 10, padding: "16px 16px 4px" }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#5F5E5A", marginBottom: 12 }}>Revenue trend</div>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 120 }}>
              {chartRows.map(([key, data]) => (
                <div key={key} title={`${key}: Rs ${data.revenue.toLocaleString()}`} style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-end", height: "100%" }}>
                  <div
                    style={{
                      background: "#185FA5",
                      borderRadius: "3px 3px 0 0",
                      height: `${Math.max(2, (data.revenue / maxRevenue) * 100)}%`,
                    }}
                  />
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 4, marginTop: 6, paddingBottom: 10 }}>
              {chartRows.map(([key]) => (
                <div key={key} style={{ flex: 1, fontSize: 10, color: "#888780", textAlign: "center", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {groupBy === "month" ? key.slice(5) : key.slice(5)}
                </div>
              ))}
            </div>
          </div>
        )}

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
