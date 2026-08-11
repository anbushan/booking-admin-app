import { prisma } from "../../../lib/prisma";
import { getSession, requireRole } from "../../../lib/session";
import { redirect } from "next/navigation";
import AdminShell from "../../../components/AdminShell";
import { PageHeader } from "../../../components/PageHeader";
import { BroadcastForm } from "../../../components/BroadcastForm";
import { redirectWithToast } from "../../../lib/toastRedirect";
import { isRedirectError } from "../../../lib/actionError";
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

  try {
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

    // Each individual push failure is already handled here (allSettled,
    // counted rather than thrown) — a bad/expired token for one user
    // shouldn't make the whole broadcast look like it failed when the
    // in-app rows and every other push went through fine.
    const withToken = users.filter((u) => u.fcmToken);
    const results = await Promise.allSettled(
      withToken.map((u) => sendPush(u.fcmToken as string, title, body, { type: "PROMOTION", bookingId: "" }))
    );
    const pushed = results.filter((r) => r.status === "fulfilled").length;

    // Mirrors backend/src/lib/notify.js's same fix: a dead token (app
    // uninstalled, token rotated) fails the exact same way on every future
    // broadcast forever unless something clears it. A promo blast is
    // exactly the kind of send where a stale-token backlog accumulates
    // fastest — it's the one path that touches every user's token at once.
    const deadTokenCodes = ["messaging/registration-token-not-registered", "messaging/invalid-registration-token"];
    const deadUserIds = withToken
      .filter((u, i) => results[i].status === "rejected" && deadTokenCodes.includes((results[i] as PromiseRejectedResult).reason?.code))
      .map((u) => u.id);
    if (deadUserIds.length) {
      await prisma.user.updateMany({ where: { id: { in: deadUserIds } }, data: { fcmToken: null } });
    }

    redirectWithToast(
      "/notifications/broadcast",
      `Sent to ${users.length} user${users.length === 1 ? "" : "s"} (${pushed} by push, the rest in-app only).`
    );
  } catch (err) {
    if (isRedirectError(err)) throw err;
    redirectWithToast("/notifications/broadcast", "Couldn't send notification. Try again.", "error");
  }
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
