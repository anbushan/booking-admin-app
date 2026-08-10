// A driver can have several rides published at once, each collecting
// its own requests/bookings — shown as one flat list, those all
// interleaved together with nothing marking which item belongs to
// which trip. This groups by the specific ride (its date/time + route)
// so each section reads as "here's everything for Friday 6:30 PM to
// Chennai" instead of one undifferentiated pile, the same idea
// NotificationsScreen already uses (grouped by day) applied to the
// screens where the more useful grouping is "which ride", not just
// "which day".
export type RideGroup<T> = { key: string; title: string; subtitle: string; data: T[] };

function formatRideDate(date: Date) {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfTarget = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const diffDays = Math.round((startOfTarget - startOfToday) / 86400000);
  const dayLabel =
    diffDays === 0 ? "Today" :
    diffDays === 1 ? "Tomorrow" :
    diffDays === -1 ? "Yesterday" :
    date.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
  const time = date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return `${dayLabel} · ${time}`;
}

export function groupByRide<T extends { ride?: { travelDate?: string; sourceAddress?: string; destAddress?: string } | null }>(
  items: T[]
): RideGroup<T>[] {
  const order: string[] = [];
  const groups = new Map<string, RideGroup<T> & { sortKey: number }>();

  for (const item of items) {
    const ride = item.ride;
    const key = ride ? `${ride.travelDate || "?"}|${ride.sourceAddress || ""}|${ride.destAddress || ""}` : "no-ride";
    if (!groups.has(key)) {
      const date = ride?.travelDate ? new Date(ride.travelDate) : null;
      groups.set(key, {
        key,
        title: date ? formatRideDate(date) : "Date unavailable",
        subtitle: ride ? `${ride.sourceAddress} to ${ride.destAddress}` : "",
        data: [],
        sortKey: date ? date.getTime() : Number.MAX_SAFE_INTEGER,
      });
      order.push(key);
    }
    groups.get(key)!.data.push(item);
  }

  return order
    .map((k) => groups.get(k)!)
    .sort((a, b) => a.sortKey - b.sortKey)
    .map(({ sortKey, ...rest }) => rest);
}
