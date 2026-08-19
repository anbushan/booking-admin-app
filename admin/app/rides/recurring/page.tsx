import { prisma } from "../../../lib/prisma";
import { getSession, requireRole } from "../../../lib/session";
import { redirect } from "next/navigation";
import Link from "next/link";
import AdminShell from "../../../components/AdminShell";
import { PageHeader } from "../../../components/PageHeader";
import { Badge } from "../../../components/Badge";
import { Repeat } from "lucide-react";
import { EmptyState } from "../../../components/EmptyState";
import Pagination from "../../../components/Pagination";

export const dynamic = "force-dynamic";
const PAGE_SIZE = 25;
const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function formatDays(daysOfWeek: number[]) {
  if (daysOfWeek.length === 7) return "Every day";
  if (daysOfWeek.length === 5 && [1, 2, 3, 4, 5].every((d) => daysOfWeek.includes(d))) return "Weekdays";
  return [...daysOfWeek].sort().map((d) => DAY_LABELS[d]).join(", ");
}

// Read-only visibility into "repeat this ride every weekday" series
// (see backend/src/lib/recurringRides.js + cron/generateRecurringRides.js)
// — previously had zero admin surface at all, unlike a one-off ride.
export default async function RecurringRidesPage({ searchParams }: { searchParams: { page?: string } }) {
  const session = getSession();
  if (!requireRole(session, ["support"])) {
    redirect("/login");
  }

  const page = Math.max(1, Number(searchParams.page || 1));

  const [templates, total] = await Promise.all([
    prisma.recurringRideTemplate.findMany({
      include: {
        driver: { select: { id: true, name: true, phone: true } },
        // Next few upcoming occurrences this template has already
        // generated — not a live re-derivation, just what's really in
        // the Ride table right now, same as the driver's own
        // ManageRecurringRidesScreen shows.
        generatedRides: {
          where: { travelDate: { gte: new Date() } },
          orderBy: { travelDate: "asc" },
          take: 5,
          select: { id: true, travelDate: true, status: true },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.recurringRideTemplate.count(),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <AdminShell activeHref="/rides/recurring">
      <div style={{ padding: 24 }}>
        <PageHeader icon={Repeat} title="Recurring rides" subtitle={`${total} series`} />

        <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 12 }}>
          {templates.map((tpl) => (
            <div key={tpl.id} style={{ border: "1px solid #E3E1D8", borderRadius: 8, padding: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
                <div>
                  <div style={{ fontWeight: 500, fontSize: 14 }}>
                    {tpl.sourceAddress} to {tpl.destAddress}
                  </div>
                  <div style={{ fontSize: 12, color: "#888780", marginTop: 4 }}>
                    <Link href={`/drivers/${tpl.driver.id}`} style={{ color: "#0C447C" }}>{tpl.driver.name || tpl.driver.phone}</Link>
                    {" · "}{formatDays(tpl.daysOfWeek)} at {tpl.departureTime}
                    {" · "}Rs {tpl.pricePerSeat.toString()}/seat · {tpl.seatsAvailable} seats
                  </div>
                </div>
                <Badge tone={tpl.active ? "success" : "neutral"}>{tpl.active ? "Active" : "Paused/stopped"}</Badge>
              </div>
              <div style={{ marginTop: 8, fontSize: 12, color: "#5F5E5A" }}>
                {tpl.generatedRides.length === 0 ? (
                  "No upcoming occurrences generated yet"
                ) : (
                  <>
                    Next: {tpl.generatedRides.map((r) => (
                      <a key={r.id} href={`/rides/${r.id}`} style={{ color: "#0C447C", marginRight: 8 }}>
                        {r.travelDate.toLocaleDateString()}{r.status !== "PUBLISHED" ? ` (${r.status.toLowerCase()})` : ""}
                      </a>
                    ))}
                  </>
                )}
              </div>
            </div>
          ))}
          {templates.length === 0 && <EmptyState title="No recurring ride series yet" />}
        </div>
        <Pagination page={page} totalPages={totalPages} basePath="/rides/recurring" />
      </div>
    </AdminShell>
  );
}
