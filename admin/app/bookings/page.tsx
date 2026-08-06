import { prisma } from "../../lib/prisma";
import { getSession, requireRole } from "../../lib/session";
import { redirect } from "next/navigation";
import AdminShell from "../../components/AdminShell";
import Pagination from "../../components/Pagination";
import { EmptyState } from "../../components/EmptyState";

export const dynamic = "force-dynamic";
const PAGE_SIZE = 25;

function statusColor(status: string) {
  if (["CONFIRMED", "IN_PROGRESS", "COMPLETED"].includes(status)) return "#3B6D11";
  if (["AWAITING_PAYMENT", "PAYMENT_PENDING", "CHARGE_ATTEMPTED"].includes(status)) return "#854F0B";
  if (["CANCELLED", "REJECTED", "EXPIRED", "STOPPED"].includes(status)) return "#A32D2D";
  return "#5F5E5A";
}

export default async function BookingsPage({ searchParams }: { searchParams: { page?: string } }) {
  const session = getSession();
  if (!requireRole(session, ["support"])) {
    redirect("/login");
  }

  const page = Math.max(1, Number(searchParams.page || 1));

  const [bookings, total] = await Promise.all([
    prisma.booking.findMany({
      include: {
        ride: { select: { sourceAddress: true, destAddress: true, pricePerSeat: true } },
        passenger: { select: { name: true, phone: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.booking.count(),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <AdminShell activeHref="/bookings">
      <div style={{ padding: 24, fontFamily: "sans-serif" }}>
        <h1 style={{ fontSize: 20, fontWeight: 500 }}>All bookings</h1>

        <table style={{ width: "100%", marginTop: 16, borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "1px solid #E3E1D8" }}>
              <th style={{ padding: "8px 4px" }}>Passenger</th>
              <th style={{ padding: "8px 4px" }}>Route</th>
              <th style={{ padding: "8px 4px" }}>Fare</th>
              <th style={{ padding: "8px 4px" }}>Platform fee</th>
              <th style={{ padding: "8px 4px" }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {bookings.map((b) => (
              <tr key={b.id} style={{ borderBottom: "1px solid #E3E1D8" }}>
                <td style={{ padding: "8px 4px" }}>
                  <a href={`/bookings/${b.id}`} style={{ color: "#0C447C" }}>
                    {b.passenger.name || b.passenger.phone}
                  </a>
                </td>
                <td style={{ padding: "8px 4px" }}>{b.ride.sourceAddress} to {b.ride.destAddress}</td>
                <td style={{ padding: "8px 4px" }}>Rs {Number(b.ride.pricePerSeat) * b.seatsBooked}</td>
                <td style={{ padding: "8px 4px" }}>{b.platformFeeAmount != null ? `Rs ${Number(b.platformFeeAmount)}` : "—"}</td>
                <td style={{ padding: "8px 4px", color: statusColor(b.status) }}>{b.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {bookings.length === 0 && <EmptyState title="No bookings yet" />}
        <Pagination page={page} totalPages={totalPages} basePath="/bookings" />
      </div>
    </AdminShell>
  );
}
