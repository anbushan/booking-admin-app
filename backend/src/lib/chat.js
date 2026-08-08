import { prisma } from "./prisma.js";

// Chat only exists for the pre-trip coordination window — from the
// moment the platform fee is paid (CONFIRMED) until the trip actually
// starts (IN_PROGRESS) or the booking falls through to any terminal
// state first. Once the trip is under way they're physically together,
// and once it's over there's nothing left to coordinate — so this gets
// called at both edges of that window (trip start, and every terminal
// transition), not just at the end. Safe no-op if there's nothing to
// delete (most bookings never had a chat at all).
export async function clearChatForBooking(bookingId) {
  await prisma.chatMessage.deleteMany({ where: { bookingId } });
}
