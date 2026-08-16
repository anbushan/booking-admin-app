import type { MetadataRoute } from "next";
import { SITE_URL, IS_PRODUCTION } from "../lib/siteContent";

// Next's file-convention robots — served automatically at /robots.txt.
//
// Non-production (see IS_PRODUCTION in lib/siteContent.ts) gets a
// blanket disallow — without this, every preview deployment Vercel
// generates (one per branch/PR, each on its own indexable URL) was just
// as crawlable as the real site, and a preview build getting indexed
// ahead of (or instead of) production is a real, common way sites end
// up with duplicate-content or "wrong URL ranks" problems.
//
// Production rules: everything genuinely public is allowed; every
// admin-only route (dashboard, users, rides, bookings, payments,
// refunds, reports, reviews, sos-alerts, drivers, settings,
// notifications) plus the API routes and the auth pages themselves are
// disallowed — none of that is meant to be indexed, and login/reset-
// password showing up in search results for "NanbaGO login" would be
// actively unhelpful for the people this site is actually for.
export default function robots(): MetadataRoute.Robots {
  if (!IS_PRODUCTION) {
    return { rules: { userAgent: "*", disallow: "/" } };
  }

  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/about", "/safety", "/pricing", "/download", "/contact", "/delete-account", "/faq", "/blog", "/blog/", "/legal/"],
      disallow: [
        "/api/",
        "/dashboard",
        "/users",
        "/drivers",
        "/rides",
        "/bookings",
        "/payments",
        "/refunds",
        "/reports",
        "/reviews",
        "/sos-alerts",
        "/settings",
        "/notifications",
        "/login",
        "/forgot-password",
        "/reset-password",
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
