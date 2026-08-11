import "./globals.css";
import { SITE_URL, IS_PRODUCTION } from "../lib/siteContent";

// Root-level fallback — every admin-only page (dashboard, users, rides,
// ...) inherits this as-is, since none of them define their own
// metadata (they don't need to; robots.ts already keeps them out of
// search results). The public pages (/, /faq, /blog/*) each set their
// own full title/description/OG tags, which override this per Next's
// normal metadata merging — this is just the fallback, not what search
// engines actually see for those.
//
// metadataBase matters even though most pages here set absolute URLs
// explicitly: it's what Next resolves any *relative* OG/Twitter image
// URL against, and its absence prints a build-time warning either way.
//
// robots here is the second half of robots.ts's non-production
// disallow: that keeps crawlers from ever fetching a preview/dev page
// in the first place, but doesn't guarantee a URL stays out of the
// index if it got linked or crawled some other way — a page-level
// noindex/nofollow is the belt to that suspenders. Every page inherits
// this (none of the public pages override `robots` themselves), so it
// applies uniformly across the whole app on any non-production deploy.
export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: "NanbaGO Admin",
  description: "Admin dashboard for NanbaGO — Dosti For Every Journey.",
  ...(IS_PRODUCTION ? {} : { robots: { index: false, follow: false } }),
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: "#FFFFFF" }}>{children}</body>
    </html>
  );
}
