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
  //
  // PERFORMANCE: this used to fetch every full Booking row in range
  // (every column, unbounded — a widened date range had no cap) just to
  // sum one column and count rows in JS. That's a textbook case for
  // letting the database do it: date_trunc + GROUP BY does the same
  // aggregation server-side, over an index (see the new
  // Booking_platformFeePaidAt_idx migration) instead of a full scan, and
  // transfers back one row per day/month instead of one row per booking.
  // `groupBy` is coerced to a fixed "day"|"month" literal above, so it's
  // safe to interpolate — Prisma's tagged template still parameterizes
  // it as a bound value, not string-concatenated SQL.
  const truncUnit = groupBy === "month" ? "month" : "day";
  const buckets = await prisma.$queryRaw<{ bucket: Date; trips: bigint; revenue: unknown }[]>`
    SELECT date_trunc(${truncUnit}, "platformFeePaidAt") AS bucket,
           COUNT(*)::int AS trips,
           COALESCE(SUM("platformFeeAmount"), 0) AS revenue
    FROM "Booking"
    WHERE "platformFeePaidAt" >= ${startOfDay(from)} AND "platformFeePaidAt" <= ${to}
    GROUP BY bucket
    ORDER BY bucket ASC
  `;
  const rows = buckets
    .map((b): [string, { revenue: number; trips: number }] => [
      groupBy === "month" ? b.bucket.toISOString().slice(0, 7) : b.bucket.toISOString().slice(0, 10),
      { revenue: Number(b.revenue), trips: Number(b.trips) },
    ])
    .sort((a, b) => (a[0] < b[0] ? 1 : -1));
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
