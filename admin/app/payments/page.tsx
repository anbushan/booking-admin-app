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
  if (["PAYMENT_PENDING", "CHARGE_ATTEMPTED", "AWAITING_PAYMENT"].includes(status)) return "#854F0B";
  return "#5F5E5A";
}

// "Payments" here means the platform fee — the only amount ever charged
// in-app. A booking shows up once the fee has been captured, or is
// mid-flight/retrying.
export default async function PaymentsPage({ searchParams }: { searchParams: { page?: string } }) {
  const session = getSession();
  if (!requireRole(session, ["finance"])) {
    redirect("/login");
  }

  const page = Math.max(1, Number(searchParams.page || 1));
  const where = {
    OR: [
      { platformFeePaidAt: { not: null } },
      { status: { in: ["CHARGE_ATTEMPTED", "PAYMENT_PENDING"] } },
    ],
  };

  const [payments, total] = await Promise.all([
    prisma.booking.findMany({
      where,
      include: {
        ride: { select: { sourceAddress: true, destAddress: true, pricePerSeat: true } },
        passenger: { select: { name: true, phone: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.booking.count({ where }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <AdminShell activeHref="/payments">
      <div style={{ padding: 24, fontFamily: "sans-serif" }}>
        <h1 style={{ fontSize: 20, fontWeight: 500 }}>Payment history</h1>
        <p style={{ fontSize: 13, color: "#5F5E5A" }}>
          Platform-fee payments — captured, attempted, or pending retry.
          The remaining fare is settled directly between passenger and
          driver and never appears here.
        </p>

        <table style={{ width: "100%", marginTop: 16, borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "1px solid #E3E1D8" }}>
              <th style={{ padding: "8px 4px" }}>Passenger</th>
              <th style={{ padding: "8px 4px" }}>Route</th>
              <th style={{ padding: "8px 4px" }}>Platform fee</th>
              <th style={{ padding: "8px 4px" }}>Paid at</th>
              <th style={{ padding: "8px 4px" }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {payments.map((p) => (
              <tr key={p.id} style={{ borderBottom: "1px solid #E3E1D8" }}>
                <td style={{ padding: "8px 4px" }}>
                  <a href={`/bookings/${p.id}`} style={{ color: "#0C447C" }}>
                    {p.passenger.name || p.passenger.phone}
                  </a>
                </td>
                <td style={{ padding: "8px 4px" }}>{p.ride.sourceAddress} to {p.ride.destAddress}</td>
                <td style={{ padding: "8px 4px" }}>{p.platformFeeAmount != null ? `Rs ${Number(p.platformFeeAmount)}` : "—"}</td>
                <td style={{ padding: "8px 4px" }}>{p.platformFeePaidAt?.toLocaleDateString() || "—"}</td>
                <td style={{ padding: "8px 4px", color: statusColor(p.status) }}>{p.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {payments.length === 0 && <EmptyState title="No payments yet" />}
        <Pagination page={page} totalPages={totalPages} basePath="/payments" />
      </div>
    </AdminShell>
  );
}
