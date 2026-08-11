import { prisma } from "../../../lib/prisma";
import { getSession, requireRole } from "../../../lib/session";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import AdminShell from "../../../components/AdminShell";

import { PageHeader } from "../../../components/PageHeader";
import { Badge } from "../../../components/Badge";
import { SubmitButton } from "../../../components/SubmitButton";
import { redirectWithToast } from "../../../lib/toastRedirect";
import { isRedirectError } from "../../../lib/actionError";
import { Bell } from "lucide-react";
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

  try {
    await prisma.notificationTemplate.upsert({
      where: { type },
      update: { title, body },
      create: { type, title, body },
    });

    revalidatePath("/settings/notification-templates");
    redirectWithToast("/settings/notification-templates", `Saved "${type}" template.`);
  } catch (err) {
    if (isRedirectError(err)) throw err;
    redirectWithToast("/settings/notification-templates", `Couldn't save "${type}" template. Try again.`, "error");
  }
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
        <PageHeader icon={Bell} title="Notification templates" />
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
                <div style={{ marginBottom: 8 }}><Badge tone="neutral">{type}</Badge></div>
                <input
                  name="title"
                  placeholder="Title"
                  defaultValue={existing?.title || ""}
                  className="admin-input"
                  style={{ width: "100%", marginBottom: 8 }}
                />
                <textarea
                  name="body"
                  placeholder="Body (use {placeholder} for dynamic values)"
                  defaultValue={existing?.body || ""}
                  rows={2}
                  className="admin-input"
                  style={{ width: "100%", height: "auto", padding: 8, marginBottom: 8 }}
                />
                <SubmitButton className="admin-btn admin-btn-primary admin-btn-sm" pendingLabel="Saving...">
                  Save
                </SubmitButton>
              </form>
            );
          })}
        </div>
      </div>
    </AdminShell>
  );
}
