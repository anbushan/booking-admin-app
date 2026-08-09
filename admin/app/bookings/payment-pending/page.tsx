import { prisma } from "../../../lib/prisma";
import { getSession, requireRole } from "../../../lib/session";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import AdminShell from "../../../components/AdminShell";
import { PageHeader } from "../../../components/PageHeader";
import { Badge } from "../../../components/Badge";
import { Clock } from "lucide-react";
import { EmptyState } from "../../../components/EmptyState";
import Pagination from "../../../components/Pagination";
import { SubmitButton } from "../../../components/SubmitButton";
import { redirectWithToast } from "../../../lib/toastRedirect";

export const dynamic = "force-dynamic";
const PAGE_SIZE = 25;

// Admin cannot complete a Razorpay Checkout itself — that requires the
// passenger's own device. What admin *can* do is nudge them to retry
// from their app, where POST /api/payments/:bookingId/retry creates a
// fresh order. This action sends that reminder honestly, rather than
// pretending to trigger the charge directly from here.
async function sendRetryReminder(formData: FormData) {
  "use server";
  const bookingId = formData.get("bookingId") as string;
  const passengerId = formData.get("passengerId") as string;
  const amount = formData.get("amount") as string;

  await prisma.notification.create({
    data: {
      userId: passengerId,
      type: "PAYMENT_FAILED",
      title: "Payment reminder",
      body: `Your platform fee payment of Rs ${amount} didn't go through — please retry from your booking before the pay window closes.`,
    },
  });

  revalidatePath("/bookings/payment-pending");
  redirectWithToast("/bookings/payment-pending", "Reminder sent.");
}

export default async function PaymentPendingPage({ searchParams }: { searchParams: { page?: string } }) {
  const session = getSession();
  if (!requireRole(session, ["finance"])) {
    redirect("/login");
  }

  const page = Math.max(1, Number(searchParams.page || 1));
  const where = { status: { in: ["AWAITING_PAYMENT", "CHARGE_ATTEMPTED", "PAYMENT_PENDING"] } };

  const [bookings, total] = await Promise.all([
    prisma.booking.findMany({
      where,
      include: {
        ride: { include: { driver: { select: { name: true } } } },
        passenger: { select: { name: true, phone: true } },
      },
      orderBy: { expiresAt: "asc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.booking.count({ where }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <AdminShell activeHref="/bookings/payment-pending">
      <div style={{ padding: 24 }}>
        <PageHeader icon={Clock} title="Payment-pending bookings" subtitle={`${total} total`} />
        <p style={{ fontSize: 13, color: "#5F5E5A" }}>
          Driver-accepted bookings where the passenger's platform-fee
          payment hasn't succeeded yet (still within the pay window, in
          flight, or failed and awaiting retry).
        </p>

        <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 10 }}>
          {bookings.map((b) => {
            const amount = Number(b.platformFeeAmount || 0);
            return (
              <div
                key={b.id}
                style={{ border: "1px solid #E3E1D8", borderRadius: 8, padding: 16, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}
              >
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, display: "flex", alignItems: "center", gap: 8 }}>
                    <span>{b.passenger.name || b.passenger.phone} · Rs {amount} fee</span>
                    <Badge>{b.status}</Badge>
                  </div>
                  <div style={{ fontSize: 12, color: "#888780", marginTop: 4 }}>
                    Driver {b.ride.driver.name || "—"} · pay window expires{" "}
                    {b.expiresAt?.toLocaleString() || "—"}
                  </div>
                </div>
                <form action={sendRetryReminder}>
                  <input type="hidden" name="bookingId" value={b.id} />
                  <input type="hidden" name="passengerId" value={b.passengerId} />
                  <input type="hidden" name="amount" value={amount} />
                  <SubmitButton className="admin-btn admin-btn-secondary" pendingLabel="Sending...">
                    Send retry reminder
                  </SubmitButton>
                </form>
              </div>
            );
          })}
          {bookings.length === 0 && (
            <EmptyState title="Nothing pending right now" />
          )}
        </div>
        <Pagination page={page} totalPages={totalPages} basePath="/bookings/payment-pending" />
      </div>
    </AdminShell>
  );
}
