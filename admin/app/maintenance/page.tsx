import { Logo } from "../../components/Logo";

// Standalone — deliberately no AdminShell here. If the admin panel
// itself is the thing down for maintenance, showing the normal sidebar
// nav next to it would imply everything behind those links still
// works, which is exactly the thing this page exists to say isn't
// true right now.
//
// Not wired to AppConfig.maintenanceMode — that flag gates the mobile
// app (see backend GET /api/app-status) for rider/driver-facing
// outages, and reusing it here would also lock the admin team out of
// the one tool they'd need to turn it back off. This page is reachable
// on its own (direct link, or middleware.ts's own separate
// ADMIN_MAINTENANCE_MODE env var — off by default, see that file) for
// when the *admin panel itself* needs to go down instead, e.g. during
// a schema migration.
export default function MaintenancePage() {
  return (
    <div style={{ display: "flex", minHeight: "100vh", alignItems: "center", justifyContent: "center", background: "#F1EFE8", padding: 16 }}>
      <div style={{ width: "100%", maxWidth: 380, textAlign: "center" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 24 }}>
          <Logo size={36} />
          <div style={{ textAlign: "left" }}>
            <div style={{ fontSize: 17, fontWeight: 700, color: "#0C447C" }}>NanbaGO</div>
            <div style={{ fontSize: 12, color: "#888780" }}>Admin</div>
          </div>
        </div>
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: 24,
            background: "#FEF3E0",
            color: "#B4720A",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 16px",
            fontSize: 22,
          }}
        >
          🛠
        </div>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: "#1A1A18", margin: "0 0 8px" }}>
          Down for maintenance
        </h1>
        <p style={{ fontSize: 14, color: "#5F5E5A", margin: 0, lineHeight: 1.5 }}>
          The admin panel is offline for scheduled maintenance. This won't affect the rider/driver app —
          we'll be back shortly.
        </p>
      </div>
    </div>
  );
}
