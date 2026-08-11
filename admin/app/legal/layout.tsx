import Link from "next/link";
import { Logo } from "../../components/Logo";

// Deliberately outside AdminShell — these two pages (Terms, Privacy)
// are the only ones in this app meant for the public, not signed-in
// staff: the Play/App Store listing and the mobile app's About screen
// both link straight here, so there's no session check, no sidebar,
// nothing that assumes an admin is looking at it.
//
// The brand mark used to be inert (a link to "/" used to dead-end an
// unauthenticated visitor at /login, back when "/" was the admin
// dashboard redirect — see git history). Now that "/" is a real public
// landing page, it's a real link again, plus FAQ/Blog alongside it —
// both for a visitor actually navigating, and for internal link equity
// (search engines weight a page partly by what links to it from
// elsewhere on the same site).
export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", background: "#FFFFFF", color: "#1A1A18" }}>
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          padding: "18px 24px",
          borderBottom: "1px solid #EDEBE3",
          flexWrap: "wrap",
        }}
      >
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
          <Logo size={26} />
          <span style={{ fontWeight: 700, fontSize: 15, color: "#1A1A18" }}>NanbaGO</span>
        </Link>
        <nav style={{ display: "flex", gap: 18 }}>
          <Link href="/faq" style={{ fontSize: 13, fontWeight: 500, color: "#5F5E5A", textDecoration: "none" }}>FAQ</Link>
          <Link href="/blog" style={{ fontSize: 13, fontWeight: 500, color: "#5F5E5A", textDecoration: "none" }}>Blog</Link>
        </nav>
      </header>
      <main style={{ maxWidth: 720, margin: "0 auto", padding: "40px 24px 80px" }}>{children}</main>
    </div>
  );
}
