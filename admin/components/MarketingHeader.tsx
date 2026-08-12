"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { Logo } from "./Logo";
import { NAV_LINKS, BRAND_NAME } from "../lib/siteContent";

// Replaces the horizontal-scroll-with-fade nav strip that used to sit
// here directly in MarketingShell. That approach was technically
// correct (verified: no page-level overflow, genuinely scrollable,
// fade rendering) but kept reading as "broken" at actual phone size —
// two rounds of screenshots back that up. A real hamburger menu is the
// unambiguous fix: on mobile there's nothing to scroll or fade, every
// link is either visible (desktop row) or one tap away or in a fully
// visible dropdown, same pattern AdminShell already uses for its own
// avatar menu (backdrop + click-outside-to-close). This is the one
// piece of MarketingShell that needs client-side state (open/closed);
// everything else in the shell — footer, page content — stays a server
// component.
export function MarketingHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="mkt-header">
      <div className="mkt-header-inner">
        <Link href="/" className="mkt-brand" onClick={() => setOpen(false)}>
          <Logo size={30} />
          <span>{BRAND_NAME}</span>
        </Link>

        <nav className="mkt-nav mkt-nav-desktop">
          {NAV_LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="mkt-nav-link">
              {link.label}
            </Link>
          ))}
        </nav>

        <button
          type="button"
          className="mkt-nav-toggle"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
        >
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {open && (
        <>
          <div className="mkt-nav-backdrop" onClick={() => setOpen(false)} />
          <nav className="mkt-nav-mobile-panel">
            {NAV_LINKS.map((link) => (
              <Link key={link.href} href={link.href} className="mkt-nav-mobile-link" onClick={() => setOpen(false)}>
                {link.label}
              </Link>
            ))}
          </nav>
        </>
      )}
    </header>
  );
}
