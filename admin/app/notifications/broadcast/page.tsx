import { prisma } from "../../../lib/prisma";
import { getSession, requireRole } from "../../../lib/session";
import { redirect } from "next/navigation";
import AdminShell from "../../../components/AdminShell";
import { PageHeader } from "../../../components/PageHeader";
import { BroadcastForm } from "../../../components/BroadcastForm";
import { redirectWithToast } from "../../../lib/toastRedirect";
import { sendPush } from "../../../lib/fcm";
import { Megaphone } from "lucide-react";

export const dynamic = "force-dynamic";

async function sendBroadcast(formData: FormData) {
  "use server";

  const title = String(formData.get("title") || "").trim();
  const body = String(formData.get("body") || "").trim();
  const audience = String(formData.get("audience") || "ALL");

  if (!title || !body) {
    redirectWithToast("/notifications/broadcast", "Title and message are both required.", "error");
    return;
  }

  // Targets whoever has EVER been a driver/passenger on this number
  // (isDriver/isPassenger), not just whichever role is active right
  // now — a dual-role account shouldn't miss a driver promo just
  // because they're currently browsing as a passenger.
  const roleFilter =
    audience === "DRIVER" ? { isDriver: true } : audience === "PASSENGER" ? { isPassenger: true } : {};

  // Small-scale, synchronous send — fine for this app's current user
  // count. Once that grows meaningfully, this should move to a queued
  // background job instead of running inline in the request; a Server
  // Action still has a request timeout like any other route.
  const users = await prisma.user.findMany({
    where: { disabled: false, ...roleFilter },
    select: { id: true, fcmToken: true },
  });

  if (users.length === 0) {
    redirectWithToast("/notifications/broadcast", "No matching users to send to.", "error");
    return;
  }

  // In-app row for everyone matched, regardless of push token — same
  // "the Notification row is the source of truth" rule the backend's
  // own notify() uses, so someone without push permission still sees
  // this in their Notifications list.
  await prisma.notification.createMany({
    data: users.map((u) => ({ userId: u.id, type: "PROMOTION", title, body })),
  });

  const withToken = users.filter((u) => u.fcmToken);
  const results = await Promise.allSettled(withToken.map((u) => sendPush(u.fcmToken as string, title, body)));
  const pushed = results.filter((r) => r.status === "fulfilled").length;

  redirectWithToast(
    "/notifications/broadcast",
    `Sent to ${users.length} user${users.length === 1 ? "" : "s"} (${pushed} by push, the rest in-app only).`
  );
}

export default async function BroadcastPage() {
  const session = getSession();
  if (!requireRole(session, ["support"])) {
    redirect("/login");
  }

  return (
    <AdminShell activeHref="/notifications/broadcast">
      <div style={{ padding: 24, fontFamily: "sans-serif" }}>
        <PageHeader icon={Megaphone} title="Send notification" />
        <p style={{ fontSize: 13, color: "#5F5E5A", marginBottom: 20, maxWidth: 520 }}>
          Sends an in-app notification to everyone matching the audience below, plus a push
          notification to anyone who has push enabled. There's no undo once sent.
        </p>
        <BroadcastForm action={sendBroadcast} />
      </div>
    </AdminShell>
  );
}
