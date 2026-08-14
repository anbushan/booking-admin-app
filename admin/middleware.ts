import { NextRequest, NextResponse } from "next/server";

// Off by default — set ADMIN_MAINTENANCE_MODE=true in Vercel's env vars
// to redirect the actual admin dashboard to /maintenance (e.g. during a
// schema migration), then unset it when done. Does NOT touch:
//  - the public marketing site (/, /about, /faq, /blog, /contact,
//    /legal, /download, /safety) — a different audience, no reason to
//    take that down just because the dashboard is. /safety in
//    particular is the public "how safety works" marketing page
//    (app/safety/page.tsx, MarketingShell, no session check) — easy to
//    mistake for the internal SOS review queue, which actually lives
//    at /sos-alerts and IS gated below.
//  - /login, /forgot-password, /reset-password — staff can still sign
//    in; the pages behind that sign-in are what's actually gated
//  - /maintenance itself, static assets, or /api — otherwise this
//    would redirect the maintenance page to itself in a loop, or break
//    the assets that page needs to render at all
const GATED_PREFIXES = [
  "/dashboard", "/users", "/drivers", "/rides", "/bookings", "/payments",
  "/refunds", "/reports", "/reviews", "/sos-alerts",
  "/notifications", "/settings",
];

export function middleware(req: NextRequest) {
  if (process.env.ADMIN_MAINTENANCE_MODE !== "true") return NextResponse.next();

  const { pathname } = req.nextUrl;
  const isGated = GATED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  if (!isGated) return NextResponse.next();

  return NextResponse.redirect(new URL("/maintenance", req.url));
}

export const config = {
  matcher: [
    "/dashboard/:path*", "/users/:path*", "/drivers/:path*", "/rides/:path*",
    "/bookings/:path*", "/payments/:path*", "/refunds/:path*", "/reports/:path*",
    "/reviews/:path*", "/sos-alerts/:path*",
    "/notifications/:path*", "/settings/:path*",
  ],
};
