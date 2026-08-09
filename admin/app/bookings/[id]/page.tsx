import { prisma } from "../../../lib/prisma";
import { getSession, requireRole } from "../../../lib/session";
import { redirect } from "next/navigation";
import AdminShell from "../../../components/AdminShell";
import { PageHeader } from "../../../components/PageHeader";
import { Badge } from "../../../components/Badge";
import { Ticket, ArrowLeft } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function BookingDetailPage({ params }: { params: { id: string } }) {
  const session = getSession();
  if (!requireRole(session, ["support"])) {
    redirect("/login");
  }

  const booking = await prisma.booking.findUnique({
    where: { id: params.id },
    include: {
      ride: { include: { driver: { select: { name: true, phone: true } } } },
      passenger: { select: { name: true, phone: true } },
      refund: true,
    },
  });
  if (!booking) redirect("/bookings");

  const fullFare = Number(booking.ride.pricePerSeat) * booking.seatsBooked;

  return (
    <AdminShell activeHref="/bookings">
      <div style={{ padding: 24 }}>
        <a href="/bookings" style={{ fontSize: 13, color: "#5F5E5A", display: "inline-flex", alignItems: "center", gap: 4 }}>
          <ArrowLeft size={14} /> Back to bookings
        </a>
        <div style={{ marginTop: 12 }}>
          <PageHeader icon={Ticket} title={`Booking ${booking.id.slice(0, 8)}`} />
        </div>

        <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, fontSize: 13 }}>
          <div>
            <div style={{ color: "#888780" }}>Passenger</div>
            <div>{booking.passenger.name || booking.passenger.phone}</div>
          </div>
          <div>
            <div style={{ color: "#888780" }}>Driver</div>
            <div>{booking.ride.driver.name || booking.ride.driver.phone}</div>
          </div>
          <div>
            <div style={{ color: "#888780" }}>Route</div>
            <div>{booking.ride.sourceAddress} to {booking.ride.destAddress}</div>
          </div>
          <div>
            <div style={{ color: "#888780" }}>Full fare</div>
            <div>Rs {fullFare}</div>
          </div>
          <div>
            <div style={{ color: "#888780" }}>Platform fee (in-app)</div>
            <div>{booking.platformFeeAmount != null ? `Rs ${Number(booking.platformFeeAmount)}` : "—"}</div>
          </div>
          <div>
            <div style={{ color: "#888780" }}>Remaining fare (cash/UPI to driver)</div>
            <div>
              {booking.remainingFareAmount != null ? `Rs ${Number(booking.remainingFareAmount)}` : "—"}
              {booking.remainingFareAmount != null && (
                <span style={{ color: booking.remainingFareCollectedAt ? "#3B6D11" : "#854F0B", marginLeft: 6 }}>
                  ({booking.remainingFareCollectedAt ? "collected" : "not yet confirmed"})
                </span>
              )}
            </div>
          </div>
          <div>
            <div style={{ color: "#888780" }}>Status</div>
            <div><Badge>{booking.status}</Badge></div>
          </div>
          {booking.cancelledBy && (
            <div>
              <div style={{ color: "#888780" }}>Cancelled by</div>
              <div>
                {booking.cancelledBy} — {booking.cancelReason || "—"}
                {booking.cancelledAt && <> · {booking.cancelledAt.toLocaleString()}</>}
              </div>
            </div>
          )}
          <div>
            <div style={{ color: "#888780" }}>Trip completed</div>
            <div>{booking.tripCompletedAt?.toLocaleString() || "—"}</div>
          </div>
        </div>

        {booking.refund && (
          <>
            <h2 style={{ fontSize: 15, fontWeight: 500, marginTop: 24 }}>Refund</h2>
            <div style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 8 }}>
              <span>Rs {Number(booking.refund.amount)}</span>
              <Badge>{booking.refund.status}</Badge>
              <span>estimated by {booking.refund.estimatedCompletionAt.toLocaleDateString()}</span>
            </div>
          </>
        )}
      </div>
    </AdminShell>
  );
}
