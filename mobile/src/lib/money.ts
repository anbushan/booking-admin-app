// Single formatter for every rupee amount shown in the app. Prisma
// Decimal fields come back over JSON as plain numbers that can carry
// any number of decimal places (or none) depending on what happened to
// be stored — "150", "150.5", "149.999" all showed up raw in different
// screens before this existed, so the same underlying fare could read
// differently depending on which screen you were on. Every money
// display should route through this instead of interpolating the raw
// value directly.
export function formatInr(value: number | string | null | undefined): string {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return "0.00";
  return n.toFixed(2);
}
