"use client";

import { useState } from "react";

const LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/users", label: "Users" },
  { href: "/rides", label: "Rides" },
  { href: "/bookings", label: "Bookings" },
  { href: "/drivers/verification-queue", label: "Driver verification" },
  { href: "/bookings/payment-pending", label: "Payment-pending bookings" },
  { href: "/refunds", label: "Refunds" },
  { href: "/payments", label: "Payments" },
  { href: "/reports", label: "Reports" },
  { href: "/reports/daily", label: "Daily/monthly report" },
  { href: "/reviews", label: "Reviews" },
  { href: "/reviews/flagged", label: "Flagged reviews" },
  { href: "/sos-alerts", label: "SOS alerts" },
  { href: "/settings/roles", label: "Admin roles" },
  { href: "/settings/config", label: "App config" },
  { href: "/settings/notification-templates", label: "Notification templates" },
];

const activeLabel = (href: string) => LINKS.find((l) => l.href === href)?.label || "Carpool admin";

export default function AdminShell({
  children,
  activeHref,
}: {
  children: React.ReactNode;
  activeHref: string;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  const sidebar = (
    <nav className={`admin-sidebar${menuOpen ? " admin-sidebar-open" : ""}`}>
      <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 16 }}>Carpool admin</div>
      {LINKS.map((link) => (
        <a
          key={link.href}
          href={link.href}
          className="admin-link"
          onClick={() => setMenuOpen(false)}
          style={{
            padding: "8px 10px",
            borderRadius: 6,
            fontSize: 13,
            textDecoration: "none",
            color: activeHref === link.href ? "#0C447C" : "#1A1A18",
            background: activeHref === link.href ? "#E6F1FB" : "transparent",
          }}
        >
          {link.label}
        </a>
      ))}
      <form action="/api/admin-logout" method="post" style={{ marginTop: "auto" }}>
        <button
          type="submit"
          style={{
            width: "100%",
            padding: "8px 10px",
            fontSize: 13,
            background: "none",
            border: "1px solid #E3E1D8",
            borderRadius: 6,
            cursor: "pointer",
          }}
        >
          Sign out
        </button>
      </form>
    </nav>
  );

  return (
    <div className="admin-shell" style={{ fontFamily: "sans-serif" }}>
      {/* Mobile-only top bar with hamburger — hidden by default via CSS,
          shown only inside the max-width:767px media query below. */}
      <div className="admin-topbar">
        <button
          className="admin-hamburger"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label="Toggle navigation menu"
        >
          {"\u2630"}
        </button>
        <div style={{ fontSize: 14, fontWeight: 500 }}>{activeLabel(activeHref)}</div>
        <div style={{ width: 32 }} />
      </div>

      {sidebar}

      <div
        className={`admin-overlay${menuOpen ? " admin-overlay-open" : ""}`}
        onClick={() => setMenuOpen(false)}
      />

      <main className="admin-main">
        <div className="admin-main-inner">{children}</div>
      </main>
    </div>
  );
}
