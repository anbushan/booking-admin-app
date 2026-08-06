import { prisma } from "../../../lib/prisma";
import { getSession, requireRole } from "../../../lib/session";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import AdminShell from "../../../components/AdminShell";

export const dynamic = "force-dynamic";

// Seeded from every notify() call site across the backend — keeping this
// list in sync with actual `type` values used in code is a manual step
// for now (see hint text below).
const KNOWN_TYPES = [
  "NEW_BOOKING_REQUEST",
  "BOOKING_ACCEPTED",
  "BOOKING_REJECTED",
  "BOOKING_EXPIRED",
  "DRIVER_ARRIVED",
  "PAYMENT_SUCCESSFUL",
  "PAYMENT_FAILED",
  "REFUND_UPDATE",
  "RIDE_CANCELLED",
];

async function saveTemplate(formData: FormData) {
  "use server";
  const type = formData.get("type") as string;
  const title = formData.get("title") as string;
  const body = formData.get("body") as string;

  await prisma.notificationTemplate.upsert({
    where: { type },
    update: { title, body },
    create: { type, title, body },
  });

  revalidatePath("/settings/notification-templates");
}

export default async function NotificationTemplatesPage() {
  const session = getSession();
  if (!requireRole(session, [])) {
    redirect("/login");
  }

  const templates = await prisma.notificationTemplate.findMany();
  const templateByType = Object.fromEntries(templates.map((t) => [t.type, t]));

  return (
    <AdminShell activeHref="/settings/notification-templates">
      <div style={{ padding: 24, fontFamily: "sans-serif" }}>
        <h1 style={{ fontSize: 20, fontWeight: 500 }}>Notification templates</h1>
        <p style={{ fontSize: 13, color: "#5F5E5A" }}>
          Super Admin only. Note: `notify()` in the backend currently
          hardcodes title/body text at each call site rather than reading
          from this table — treat these as the source of truth to copy
          into code, not yet a live override.
        </p>

        <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 16 }}>
          {KNOWN_TYPES.map((type) => {
            const existing = templateByType[type];
            return (
              <form
                key={type}
                action={saveTemplate}
                style={{ border: "1px solid #E3E1D8", borderRadius: 8, padding: 16 }}
              >
                <input type="hidden" name="type" value={type} />
                <div style={{ fontSize: 12, color: "#888780", marginBottom: 8 }}>{type}</div>
                <input
                  name="title"
                  placeholder="Title"
                  defaultValue={existing?.title || ""}
                  style={{ width: "100%", height: 34, border: "1px solid #E3E1D8", borderRadius: 6, padding: "0 8px", fontSize: 13, marginBottom: 8 }}
                />
                <textarea
                  name="body"
                  placeholder="Body (use {placeholder} for dynamic values)"
                  defaultValue={existing?.body || ""}
                  rows={2}
                  style={{ width: "100%", border: "1px solid #E3E1D8", borderRadius: 6, padding: 8, fontSize: 13, marginBottom: 8 }}
                />
                <button
                  type="submit"
                  style={{ background: "#1A1A18", color: "#fff", border: "none", borderRadius: 6, padding: "6px 12px", fontSize: 12 }}
                >
                  Save
                </button>
              </form>
            );
          })}
        </div>
      </div>
    </AdminShell>
  );
}
