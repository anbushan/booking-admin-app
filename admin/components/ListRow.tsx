import { type ReactNode } from "react";

// Extracted from the row-card shape already hand-rolled in ~11 list
// pages (promo-codes, reviews, referrals, etc.) that never used a
// <table> at all and so already reflow correctly on narrow screens.
// Used here specifically as the mobile-width alternative to the 5 list
// pages that DO use a real <table> (users/rides/bookings/payments) —
// those keep their table for tablet/desktop (plenty of room there) and
// swap to this under the .admin-row-list breakpoint in globals.css.
//
// Two generic slots rather than a rigid column schema — each page's
// primary content (name, route, badges) goes in `left`, secondary
// content (amounts, dates, a status pill) in `right`, matching how the
// existing hand-rolled rows are already split.
export function ListRow({ left, right }: { left: ReactNode; right: ReactNode }) {
  return (
    <div style={{ border: "1px solid #E3E1D8", borderRadius: 8, padding: 16, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
      <div style={{ minWidth: 0 }}>{left}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>{right}</div>
    </div>
  );
}
