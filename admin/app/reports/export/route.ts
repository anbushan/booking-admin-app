import { prisma } from "../../../lib/prisma";
import { getSession, requireRole } from "../../../lib/session";

function toCsv(rows: string[][]) {
  return rows
    .map((row) =>
      row
        .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
        .join(",")
    )
    .join("\n");
}

export async function GET() {
  const session = getSession();
  if (!requireRole(session, ["finance"])) {
    return new Response("Not permitted", { status: 403 });
  }

  // Revenue here is the platform fee actually captured, not the full
  // fare — the remaining fare is settled directly between passenger and
  // driver and never reaches the platform.
  const bookings = await prisma.booking.findMany({
    where: { platformFeePaidAt: { not: null } },
    include: {
      ride: { select: { sourceAddress: true, destAddress: true } },
      passenger: { select: { name: true, phone: true } },
    },
    orderBy: { platformFeePaidAt: "desc" },
    take: 1000,
  });

  const header = ["Booking ID", "Passenger", "Route", "Seats", "Platform Fee (Rs)", "Fee Paid At"];
  const rows = bookings.map((b) => [
    b.id,
    b.passenger.name || b.passenger.phone,
    `${b.ride.sourceAddress} to ${b.ride.destAddress}`,
    String(b.seatsBooked),
    String(Number(b.platformFeeAmount || 0)),
    b.platformFeePaidAt?.toISOString() || "",
  ]);

  const csv = toCsv([header, ...rows]);

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="revenue-report-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
