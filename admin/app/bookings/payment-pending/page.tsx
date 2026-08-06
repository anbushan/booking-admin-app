import { prisma } from "../../../lib/prisma";
import { getSession, requireRole } from "../../../lib/session";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import AdminShell from "../../../components/AdminShell";
import { EmptyState } from "../../../components/EmptyState";

export const dynamic = "force-dynamic";

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
}

export default async function PaymentPendingPage() {
  const session = getSession();
  if (!requireRole(session, ["finance"])) {
    redirect("/login");
  }

  const bookings = await prisma.booking.findMany({
    where: { status: { in: ["AWAITING_PAYMENT", "CHARGE_ATTEMPTED", "PAYMENT_PENDING"] } },
    include: {
      ride: { include: { driver: { select: { name: true } } } },
      passenger: { select: { name: true, phone: true } },
    },
    orderBy: { expiresAt: "asc" },
  });

  return (
    <AdminShell activeHref="/bookings/payment-pending">
      <div style={{ padding: 24, fontFamily: "sans-serif" }}>
        <h1 style={{ fontSize: 20, fontWeight: 500 }}>Payment-pending bookings</h1>
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
                style={{ border: "1px solid #E3E1D8", borderRadius: 8, padding: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}
              >
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>
                    {b.passenger.name || b.passenger.phone} · Rs {amount} fee · {b.status}
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
                  <button
                    type="submit"
                    style={{ background: "#fff", border: "1px solid #E3E1D8", borderRadius: 6, padding: "8px 14px", fontSize: 13 }}
                  >
                    Send retry reminder
                  </button>
                </form>
              </div>
            );
          })}
          {bookings.length === 0 && (
            <EmptyState title="Nothing pending right now" />
          )}
        </div>
      </div>
    </AdminShell>
  );
}
