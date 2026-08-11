import Link from "next/link";
import { Logo } from "./Logo";
import { NAV_LINKS, FOOTER_LINKS, BRAND_NAME } from "../lib/siteContent";
import { poppins } from "../lib/fonts";

// Shared chrome for every public marketing page (landing, FAQ, blog) —
// deliberately separate from legal/layout.tsx, which stays minimal on
// purpose for policy documents. This one carries real navigation and a
// fuller footer since these pages exist to be browsed, not just read
// once and left. No session check here, same as legal — these are for
// anyone, not signed-in staff.
export function MarketingShell({ children }: { children: React.ReactNode }) {
  return (
    <div className={poppins.variable} style={{ minHeight: "100vh", display: "flex", flexDirection: "column", fontFamily: "var(--font-poppins)" }}>
      <header className="mkt-header">
        <div className="mkt-header-inner">
          <Link href="/" className="mkt-brand">
            <Logo size={30} />
            <span>{BRAND_NAME}</span>
          </Link>
          <nav className="mkt-nav">
            {NAV_LINKS.map((link) => (
              <Link key={link.href} href={link.href} className="mkt-nav-link">
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <main style={{ flex: 1 }}>{children}</main>

      <footer className="mkt-footer">
        <div className="mkt-footer-inner">
          <div className="mkt-footer-brand">
            <div className="mkt-brand" style={{ pointerEvents: "none" }}>
              <Logo size={22} />
              <span>{BRAND_NAME}</span>
            </div>
            <p>Carpooling built around real trust — not a taxi app.</p>
          </div>
          <nav className="mkt-footer-nav">
            {FOOTER_LINKS.map((link) => (
              <Link key={link.href} href={link.href}>
                {link.label}
              </Link>
            ))}
            <Link href="/login">Admin</Link>
          </nav>
        </div>
        <div className="mkt-footer-bottom">© {new Date().getFullYear()} {BRAND_NAME}. All rights reserved.</div>
      </footer>
    </div>
  );
}
