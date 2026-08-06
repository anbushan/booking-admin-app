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

  const bookings = await prisma.booking.findMany({
    where: { status: "PAID" },
    include: {
      ride: { select: { sourceAddress: true, destAddress: true, pricePerSeat: true } },
      passenger: { select: { name: true, phone: true } },
    },
    orderBy: { tripCompletedAt: "desc" },
    take: 1000,
  });

  const header = ["Booking ID", "Passenger", "Route", "Seats", "Amount (Rs)", "Trip Completed"];
  const rows = bookings.map((b) => [
    b.id,
    b.passenger.name || b.passenger.phone,
    `${b.ride.sourceAddress} to ${b.ride.destAddress}`,
    String(b.seatsBooked),
    String(Number(b.ride.pricePerSeat) * b.seatsBooked),
    b.tripCompletedAt?.toISOString() || "",
  ]);

  const csv = toCsv([header, ...rows]);

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="revenue-report-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
