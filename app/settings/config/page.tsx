import { prisma } from "../../../lib/prisma";
import { getSession, requireRole } from "../../../lib/session";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import AdminShell from "../../../components/AdminShell";

export const dynamic = "force-dynamic";

async function saveConfig(formData: FormData) {
  "use server";
  const existing = await prisma.appConfig.findFirst();

  const data = {
    commissionPercent: Number(formData.get("commissionPercent")),
    fareCapPerKmInr: Number(formData.get("fareCapPerKmInr")),
    defaultMaxDetourKm: Number(formData.get("defaultMaxDetourKm")),
    bookingExpiryMinutes: Number(formData.get("bookingExpiryMinutes")),
    refundWorkingDays: Number(formData.get("refundWorkingDays")),
  };

  if (existing) {
    await prisma.appConfig.update({ where: { id: existing.id }, data });
  } else {
    await prisma.appConfig.create({ data });
  }

  revalidatePath("/settings/config");
}

export default async function AppConfigPage() {
  const session = getSession();
  if (!requireRole(session, [])) {
    redirect("/login");
  }

  let config = await prisma.appConfig.findFirst();
  if (!config) {
    config = await prisma.appConfig.create({ data: {} });
  }

  const fields: { key: keyof typeof config; label: string; hint: string; step?: string }[] = [
    { key: "commissionPercent", label: "Commission (%)", hint: "Cut taken from each completed trip's fare" },
    { key: "fareCapPerKmInr", label: "Fare cap (Rs/km)", hint: "Server enforces this on ride create/edit — keeps rides classified as cost-sharing" },
    { key: "defaultMaxDetourKm", label: "Default max detour (km)", hint: "Default pickup-point tolerance when a driver doesn't set one" },
    { key: "bookingExpiryMinutes", label: "Booking auto-expire (minutes)", hint: "How long a driver has to respond before a request auto-expires" },
    { key: "refundWorkingDays", label: "Refund promise (working days)", hint: "Shown to passengers on every refund notification" },
  ];

  return (
    <AdminShell activeHref="/settings/config">
      <div style={{ padding: 24, fontFamily: "sans-serif" }}>
        <h1 style={{ fontSize: 20, fontWeight: 500 }}>App configuration</h1>
        <p style={{ fontSize: 13, color: "#5F5E5A" }}>
          Super Admin only. Note: these values live in the database, but
          the backend API currently reads the equivalent settings from
          environment variables (see `.env` — `FARE_CAP_PER_KM_INR`,
          `BOOKING_EXPIRY_MINUTES`, etc). Wire the backend to read from
          this table instead of `.env` before relying on changes here to
          take effect without a redeploy.
        </p>

        <form action={saveConfig} style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 16, maxWidth: 480 }}>
          {fields.map((f) => (
            <div key={f.key}>
              <label style={{ fontSize: 13, fontWeight: 500, display: "block", marginBottom: 4 }}>{f.label}</label>
              <input
                name={f.key}
                type="number"
                step="any"
                defaultValue={String(config![f.key])}
                style={{ height: 38, border: "1px solid #E3E1D8", borderRadius: 6, padding: "0 10px", width: "100%", fontSize: 13 }}
              />
              <div style={{ fontSize: 11, color: "#888780", marginTop: 2 }}>{f.hint}</div>
            </div>
          ))}
          <button
            type="submit"
            style={{ background: "#1A1A18", color: "#fff", border: "none", borderRadius: 6, padding: "10px 16px", fontSize: 13, width: "fit-content" }}
          >
            Save configuration
          </button>
        </form>
      </div>
    </AdminShell>
  );
}
