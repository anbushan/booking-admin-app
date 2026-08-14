import Link from "next/link";
import { getSession } from "../lib/session";
import { Logo } from "../components/Logo";
import AdminShell from "../components/AdminShell";

// Next's global 404 — fires for any unmatched path app-wide (a typo'd
// URL, a stale bookmark to a since-removed page, a bad ID in a link),
// not just within one route segment the way the per-page error.tsx
// files elsewhere in this app handle their own fetch failures.
//
// Two different audiences hit this, so two different treatments: a
// signed-in admin gets it inside the normal shell (sidebar still there,
// still one click back to anywhere real) since there's a real dashboard
// to return to; a signed-out visitor gets the same standalone branded
// card the login page uses, since showing them the internal nav
// wouldn't be useful — every one of those links just bounces them to
// login anyway.
export default function NotFound() {
  const session = getSession();

  const content = (
    <div style={{ textAlign: "center", padding: "64px 16px" }}>
      <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: 1, color: "#888780", marginBottom: 8 }}>
        404
      </div>
      <h1 style={{ fontSize: 20, fontWeight: 700, color: "#1A1A18", margin: "0 0 8px" }}>
        Page not found
      </h1>
      <p style={{ fontSize: 14, color: "#5F5E5A", margin: "0 0 24px" }}>
        That page doesn't exist, or may have moved.
      </p>
      <Link href={session ? "/dashboard" : "/login"} className="admin-btn admin-btn-primary">
        {session ? "Back to dashboard" : "Go to login"}
      </Link>
    </div>
  );

  if (session) {
    return <AdminShell activeHref="">{content}</AdminShell>;
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh", alignItems: "center", justifyContent: "center", background: "#F1EFE8", padding: 16 }}>
      <div
        style={{
          width: "100%",
          maxWidth: 340,
          background: "#fff",
          border: "1px solid #E3E1D8",
          borderRadius: 12,
          padding: 28,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
          <Logo size={32} />
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#0C447C" }}>NanbaGO</div>
            <div style={{ fontSize: 12, color: "#888780" }}>Admin</div>
          </div>
        </div>
        {content}
      </div>
    </div>
  );
}
