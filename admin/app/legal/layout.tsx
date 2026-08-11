import Link from "next/link";
import { Logo } from "../../components/Logo";

// Deliberately outside AdminShell — these two pages (Terms, Privacy)
// are the only ones in this app meant for the public, not signed-in
// staff: the Play/App Store listing and the mobile app's About screen
// both link straight here, so there's no session check, no sidebar,
// nothing that assumes an admin is looking at it.
export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", background: "#FFFFFF", color: "#1A1A18" }}>
      <header
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "18px 24px",
          borderBottom: "1px solid #EDEBE3",
        }}
      >
        <Logo size={26} />
        <Link href="/" style={{ fontWeight: 700, fontSize: 15, color: "#1A1A18", textDecoration: "none" }}>
          NanbaGO
        </Link>
      </header>
      <main style={{ maxWidth: 720, margin: "0 auto", padding: "40px 24px 80px" }}>{children}</main>
    </div>
  );
}
