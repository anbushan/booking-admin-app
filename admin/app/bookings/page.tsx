import { prisma } from "../../lib/prisma";
import { getSession, requireRole } from "../../lib/session";
import { redirect } from "next/navigation";
import Link from "next/link";
import AdminShell from "../../components/AdminShell";
import { PageHeader } from "../../components/PageHeader";
import { Badge } from "../../components/Badge";
import { Ticket } from "lucide-react";
import Pagination from "../../components/Pagination";
import { EmptyState } from "../../components/EmptyState";
import { SearchFilterBar } from "../../components/SearchFilterBar";
import { SortableTh } from "../../components/SortableTh";
import { ListRow } from "../../components/ListRow";

export const dynamic = "force-dynamic";
const PAGE_SIZE = 25;

const BOOKING_STATUSES = [
  "BOOKED", "AWAITING_PAYMENT", "CHARGE_ATTEMPTED", "PAYMENT_PENDING",
  "CONFIRMED", "IN_PROGRESS", "COMPLETED", "CANCELLED", "STOPPED", "REJECTED", "EXPIRED",
];
const SORT_FIELDS: Record<string, string> = { date: "createdAt", fee: "platformFeeAmount" };

export default async function BookingsPage({
  searchParams,
}: {
  searchParams: { page?: string; q?: string; status?: string; sortBy?: string; sortDir?: string };
}) {
  const session = getSession();
  if (!requireRole(session, ["support"])) {
    redirect("/login");
  }

  const page = Math.max(1, Number(searchParams.page || 1));
  const { q, status, sortBy, sortDir } = searchParams;

  const where = {
    ...(status ? { status } : {}),
    ...(q
      ? {
          OR: [
            { passenger: { name: { contains: q, mode: "insensitive" as const } } },
            { passenger: { phone: { contains: q } } },
            { ride: { sourceAddress: { contains: q, mode: "insensitive" as const } } },
            { ride: { destAddress: { contains: q, mode: "insensitive" as const } } },
          ],
        }
      : {}),
  };
  const orderField = SORT_FIELDS[sortBy || ""] || "createdAt";
  const orderDir = sortDir === "asc" ? "asc" : "desc";

  const [bookings, total] = await Promise.all([
    prisma.booking.findMany({
      where,
      include: {
        ride: { select: { sourceAddress: true, destAddress: true, pricePerSeat: true } },
        passenger: { select: { name: true, phone: true } },
      },
      orderBy: { [orderField]: orderDir },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.booking.count({ where }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const extraParams = { q, status };

  return (
    <AdminShell activeHref="/bookings">
      <div style={{ padding: 24 }}>
        <PageHeader icon={Ticket} title="All bookings" subtitle={`${total} total`} />

        <SearchFilterBar
          basePath="/bookings"
          q={q}
          searchPlaceholder="Search passenger or route..."
          filters={[{ name: "status", label: "All statuses", value: status, options: BOOKING_STATUSES.map((s) => ({ value: s, label: s.replaceAll("_", " ") })) }]}
        />

        <table className="admin-table-responsive" style={{ width: "100%", marginTop: 8, borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "1px solid #E3E1D8" }}>
              <th style={{ padding: "8px 4px" }}>Passenger</th>
              <th style={{ padding: "8px 4px" }}>Route</th>
              <th style={{ padding: "8px 4px" }}>Fare</th>
              <SortableTh label="Platform fee" field="fee" currentSortBy={sortBy} currentSortDir={sortDir} basePath="/bookings" extraParams={extraParams} />
              <SortableTh label="Booked" field="date" currentSortBy={sortBy} currentSortDir={sortDir} basePath="/bookings" extraParams={extraParams} />
              <th style={{ padding: "8px 4px" }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {bookings.map((b) => (
              <tr key={b.id} style={{ borderBottom: "1px solid #E3E1D8" }}>
                <td style={{ padding: "8px 4px" }}>
                  <Link href={`/bookings/${b.id}`} style={{ color: "#0C447C" }}>
                    {b.passenger.name || b.passenger.phone}
                  </Link>
                </td>
                <td style={{ padding: "8px 4px" }}>{b.ride.sourceAddress} to {b.ride.destAddress}</td>
                <td style={{ padding: "8px 4px" }}>Rs {Number(b.ride.pricePerSeat) * b.seatsBooked}</td>
                <td style={{ padding: "8px 4px" }}>{b.platformFeeAmount != null ? `Rs ${Number(b.platformFeeAmount)}` : "—"}</td>
                <td style={{ padding: "8px 4px" }}>{b.createdAt.toLocaleDateString()}</td>
                <td style={{ padding: "8px 4px" }}><Badge>{b.status}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="admin-row-list">
          {bookings.map((b) => (
            <ListRow
              key={b.id}
              left={
                <>
                  <Link href={`/bookings/${b.id}`} style={{ color: "#0C447C", fontWeight: 500 }}>
                    {b.passenger.name || b.passenger.phone}
                  </Link>
                  <div style={{ fontSize: 12, color: "#888780", marginTop: 4 }}>
                    {b.ride.sourceAddress} to {b.ride.destAddress} · {b.createdAt.toLocaleDateString()}
                  </div>
                </>
              }
              right={
                <>
                  <span style={{ fontSize: 12, color: "#5F5E5A" }}>
                    Rs {Number(b.ride.pricePerSeat) * b.seatsBooked}
                    {b.platformFeeAmount != null && ` (fee Rs ${Number(b.platformFeeAmount)})`}
                  </span>
                  <Badge>{b.status}</Badge>
                </>
              }
            />
          ))}
        </div>
        {bookings.length === 0 && <EmptyState title="No bookings match" />}
        <Pagination page={page} totalPages={totalPages} basePath="/bookings" extraParams={{ ...extraParams, sortBy, sortDir }} />
      </div>
    </AdminShell>
  );
}
