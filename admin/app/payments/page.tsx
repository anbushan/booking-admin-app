import { prisma } from "../../lib/prisma";
import { getSession, requireRole } from "../../lib/session";
import { redirect } from "next/navigation";
import AdminShell from "../../components/AdminShell";
import { PageHeader } from "../../components/PageHeader";
import { Badge } from "../../components/Badge";
import { CreditCard } from "lucide-react";
import Pagination from "../../components/Pagination";
import { EmptyState } from "../../components/EmptyState";
import { SearchFilterBar } from "../../components/SearchFilterBar";
import { SortableTh } from "../../components/SortableTh";

export const dynamic = "force-dynamic";
const PAGE_SIZE = 25;
const SORT_FIELDS: Record<string, string> = { date: "createdAt", fee: "platformFeeAmount", paidAt: "platformFeePaidAt" };

// "Payments" here means the platform fee — the only amount ever charged
// in-app. A booking shows up once the fee has been captured, or is
// mid-flight/retrying.
export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: { page?: string; q?: string; status?: string; sortBy?: string; sortDir?: string };
}) {
  const session = getSession();
  if (!requireRole(session, ["finance"])) {
    redirect("/login");
  }

  const page = Math.max(1, Number(searchParams.page || 1));
  const { q, status, sortBy, sortDir } = searchParams;

  const paymentRelevant = { OR: [{ platformFeePaidAt: { not: null } }, { status: { in: ["CHARGE_ATTEMPTED", "PAYMENT_PENDING"] } }] };
  const where = {
    AND: [
      paymentRelevant,
      status ? { status } : {},
      q
        ? {
            OR: [
              { passenger: { name: { contains: q, mode: "insensitive" as const } } },
              { passenger: { phone: { contains: q } } },
            ],
          }
        : {},
    ],
  };
  const orderField = SORT_FIELDS[sortBy || ""] || "createdAt";
  const orderDir = sortDir === "asc" ? "asc" : "desc";

  const [payments, total] = await Promise.all([
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
    <AdminShell activeHref="/payments">
      <div style={{ padding: 24 }}>
        <PageHeader icon={CreditCard} title="Payment history" subtitle={`${total} total`} />
        <p style={{ fontSize: 13, color: "#5F5E5A" }}>
          Platform-fee payments — captured, attempted, or pending retry.
          The remaining fare is settled directly between passenger and
          driver and never appears here.
        </p>

        <SearchFilterBar
          basePath="/payments"
          q={q}
          searchPlaceholder="Search passenger..."
          filters={[
            {
              name: "status",
              label: "All statuses",
              value: status,
              options: [
                { value: "CONFIRMED", label: "Confirmed" },
                { value: "IN_PROGRESS", label: "In progress" },
                { value: "COMPLETED", label: "Completed" },
                { value: "CHARGE_ATTEMPTED", label: "Charge attempted" },
                { value: "PAYMENT_PENDING", label: "Payment pending" },
              ],
            },
          ]}
        />

        <table style={{ width: "100%", marginTop: 8, borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "1px solid #E3E1D8" }}>
              <th style={{ padding: "8px 4px" }}>Passenger</th>
              <th style={{ padding: "8px 4px" }}>Route</th>
              <SortableTh label="Platform fee" field="fee" currentSortBy={sortBy} currentSortDir={sortDir} basePath="/payments" extraParams={extraParams} />
              <SortableTh label="Paid at" field="paidAt" currentSortBy={sortBy} currentSortDir={sortDir} basePath="/payments" extraParams={extraParams} />
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
                <td style={{ padding: "8px 4px" }}><Badge>{p.status}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
        {payments.length === 0 && <EmptyState title="No payments match" />}
        <Pagination page={page} totalPages={totalPages} basePath="/payments" extraParams={{ ...extraParams, sortBy, sortDir }} />
      </div>
    </AdminShell>
  );
}
