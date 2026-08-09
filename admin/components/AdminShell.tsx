"use client";

import { Suspense, useEffect, useState } from "react";
import {
  LayoutDashboard,
  Users,
  ShieldCheck,
  Car,
  Ticket,
  Clock,
  RotateCcw,
  CreditCard,
  BarChart3,
  CalendarRange,
  Star,
  Flag,
  AlertTriangle,
  UserCog,
  Settings as SettingsIcon,
  Bell,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  LogOut,
  type LucideIcon,
} from "lucide-react";
import { Logo } from "./Logo";
import { ToastHost } from "./ToastHost";

// Grouped the way YouTube Studio groups its own sidebar (Content /
// Analytics / Audience, one icon per row, section labels breaking up
// what used to be one flat 16-item list) — a name alone took reading
// to place ("Payment-pending bookings" vs "Payments"?); an icon plus a
// section heading places it before you've finished reading the label.
const SECTIONS: { label: string; links: { href: string; label: string; icon: LucideIcon }[] }[] = [
  {
    label: "Overview",
    links: [{ href: "/dashboard", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    label: "People & trust",
    links: [
      { href: "/users", label: "Users", icon: Users },
      { href: "/drivers/verification-queue", label: "Driver verification", icon: ShieldCheck },
      { href: "/reviews", label: "Reviews", icon: Star },
      { href: "/reviews/flagged", label: "Flagged reviews", icon: Flag },
      { href: "/sos-alerts", label: "SOS alerts", icon: AlertTriangle },
    ],
  },
  {
    label: "Rides & bookings",
    links: [
      { href: "/rides", label: "Rides", icon: Car },
      { href: "/bookings", label: "Bookings", icon: Ticket },
      { href: "/bookings/payment-pending", label: "Payment-pending", icon: Clock },
    ],
  },
  {
    label: "Finance",
    links: [
      { href: "/payments", label: "Payments", icon: CreditCard },
      { href: "/refunds", label: "Refunds", icon: RotateCcw },
    ],
  },
  {
    label: "Reports",
    links: [
      { href: "/reports", label: "Reports", icon: BarChart3 },
      { href: "/reports/daily", label: "Daily / monthly", icon: CalendarRange },
    ],
  },
  {
    label: "Settings",
    links: [
      { href: "/settings/roles", label: "Admin roles", icon: UserCog },
      { href: "/settings/config", label: "App config", icon: SettingsIcon },
      { href: "/settings/notification-templates", label: "Notification templates", icon: Bell },
    ],
  },
];

export default function AdminShell({
  children,
  activeHref,
}: {
  children: React.ReactNode;
  activeHref: string;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false);
  const [identity, setIdentity] = useState<{ email: string | null; role: string | null }>({ email: null, role: null });
  // Collapsed = icon-only rail, the exact interaction YouTube Studio's
  // own sidebar toggle does — persisted so it doesn't reset every time
  // an admin navigates (each page is its own server render, not a SPA
  // route change, so this has to survive full page loads).
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem("adminSidebarCollapsed");
    if (stored === "true") setCollapsed(true);
  }, []);

  // AdminShell is a client component — it can't call getSession()/prisma
  // the way every page's own server component already does — so it
  // fetches "who am I" itself once on mount, rather than threading an
  // identity prop through all 22 pages that render this.
  useEffect(() => {
    fetch("/api/admin-me")
      .then((r) => r.json())
      .then((data) => setIdentity(data))
      .catch(() => {});
  }, []);

  function toggleCollapsed() {
    setCollapsed((v) => {
      window.localStorage.setItem("adminSidebarCollapsed", String(!v));
      return !v;
    });
  }

  const initial = (identity.email || "?").charAt(0).toUpperCase();

  const sidebar = (
    <nav className={`admin-sidebar${menuOpen ? " admin-sidebar-open" : ""}${collapsed ? " admin-sidebar-collapsed" : ""}`}>
      {SECTIONS.map((section) => (
        <div key={section.label} className="admin-section">
          {!collapsed && <div className="admin-section-label">{section.label}</div>}
          {section.links.map((link) => {
            const Icon = link.icon;
            const active = activeHref === link.href;
            return (
              <a
                key={link.href}
                href={link.href}
                className={`admin-link${active ? " admin-link-active" : ""}`}
                onClick={() => setMenuOpen(false)}
                title={collapsed ? link.label : undefined}
              >
                <Icon size={18} strokeWidth={2} style={{ flexShrink: 0 }} />
                {!collapsed && <span>{link.label}</span>}
              </a>
            );
          })}
        </div>
      ))}
      <form action="/api/admin-logout" method="post" className="admin-signout-form">
        <button type="submit" className="admin-signout" title={collapsed ? "Sign out" : undefined}>
          <LogOut size={16} strokeWidth={2} style={{ flexShrink: 0 }} />
          {!collapsed && <span>Sign out</span>}
        </button>
      </form>
    </nav>
  );

  return (
    <div className="admin-shell">
      <Suspense fallback={null}>
        <ToastHost />
      </Suspense>
      {/* One persistent top bar at every breakpoint (previously
          mobile-only) — brand + collapse/hamburger on the left, the
          signed-in admin's own avatar on the right. The page itself
          already opens with its own icon + title (PageHeader), so
          repeating the page title here too was redundant — the avatar
          is a more useful use of that space, the same "who am I, sign
          out" spot YouTube's own top bar puts in the same corner. */}
      <div className="admin-topbar">
        <div className="admin-topbar-left">
          <button
            className="admin-hamburger"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Toggle navigation menu"
          >
            <Menu size={18} />
          </button>
          <button
            className="admin-collapse-toggle"
            onClick={toggleCollapsed}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          </button>
          <Logo size={24} />
          <span className="admin-brand">NanbaGO</span>
        </div>

        <div className="admin-avatar-wrap">
          <button
            className="admin-avatar-button"
            onClick={() => setAvatarMenuOpen((v) => !v)}
            aria-label="Account menu"
          >
            {initial}
          </button>
          {avatarMenuOpen && (
            <>
              <div className="admin-avatar-backdrop" onClick={() => setAvatarMenuOpen(false)} />
              <div className="admin-avatar-menu">
                <div className="admin-avatar-menu-email">{identity.email || "—"}</div>
                <div className="admin-avatar-menu-role">{identity.role?.replaceAll("_", " ") || ""}</div>
                <form action="/api/admin-logout" method="post">
                  <button type="submit" className="admin-avatar-menu-signout">
                    <LogOut size={14} strokeWidth={2} />
                    <span>Sign out</span>
                  </button>
                </form>
              </div>
            </>
          )}
        </div>
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
