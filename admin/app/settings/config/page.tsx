import { prisma } from "../../../lib/prisma";
import { getSession, requireRole } from "../../../lib/session";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import AdminShell from "../../../components/AdminShell";

import { PageHeader } from "../../../components/PageHeader";
import { SubmitButton } from "../../../components/SubmitButton";
import { redirectWithToast } from "../../../lib/toastRedirect";
import { Settings as SettingsIcon } from "lucide-react";
export const dynamic = "force-dynamic";

const NUMERIC_KEYS = [
  "platformFeePercent",
  "fareCapPerKmInr",
  "defaultMaxDetourKm",
  "bookingExpiryMinutes",
  "refundWorkingDays",
  "paymentWindowMinutes",
  "graceCancelWindowMinutes",
  "noShowGraceMinutes",
  "passengerCooldownCancelCount",
  "passengerCooldownWindowDays",
  "passengerCooldownHours",
  "strikeWarningThreshold",
  "strikeFinalWarningThreshold",
  "strikeBlockThreshold",
  "strikeBlockDays",
  "strikeRollingWindowDays",
] as const;

async function saveConfig(formData: FormData) {
  "use server";
  const existing = await prisma.appConfig.findFirst();

  const data = Object.fromEntries(
    NUMERIC_KEYS.map((key) => [key, Number(formData.get(key))])
  );

  if (existing) {
    await prisma.appConfig.update({ where: { id: existing.id }, data });
  } else {
    await prisma.appConfig.create({ data });
  }

  revalidatePath("/settings/config");
  redirectWithToast("/settings/config", "Configuration saved.");
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

  const groups: { heading: string; fields: { key: (typeof NUMERIC_KEYS)[number]; label: string; hint: string }[] }[] = [
    {
      heading: "Payment",
      fields: [
        { key: "platformFeePercent", label: "Platform fee (%)", hint: "Charged upfront right after the driver accepts a booking; the rest is settled directly between passenger and driver" },
        { key: "paymentWindowMinutes", label: "Pay window (minutes)", hint: "How long a passenger has to pay the platform fee before the accepted request expires" },
        { key: "fareCapPerKmInr", label: "Fare cap (Rs/km)", hint: "Server enforces this on ride create/edit — keeps rides classified as cost-sharing" },
        { key: "refundWorkingDays", label: "Refund promise (working days)", hint: "Shown to passengers on every refund notification" },
      ],
    },
    {
      heading: "Cancellation",
      fields: [
        { key: "graceCancelWindowMinutes", label: "Grace cancel window (minutes)", hint: "Shared free-cancellation window for both sides, starting the moment the platform fee is paid" },
        { key: "noShowGraceMinutes", label: "No-show grace (minutes)", hint: "How long past the scheduled departure time before an un-started booking auto-cancels as a driver no-show" },
      ],
    },
    {
      heading: "Passenger cooldown",
      fields: [
        { key: "passengerCooldownCancelCount", label: "Late cancels before cooldown", hint: "Number of late cancellations (past the grace window) within the window below that triggers a booking cooldown" },
        { key: "passengerCooldownWindowDays", label: "Cooldown lookback (days)", hint: "Rolling window the late-cancel count above is measured over" },
        { key: "passengerCooldownHours", label: "Cooldown length (hours)", hint: "How long the passenger is blocked from booking once the cooldown triggers" },
      ],
    },
    {
      heading: "Driver strikes",
      fields: [
        { key: "strikeWarningThreshold", label: "Warning at (strikes)", hint: "Rolling-window strike count that triggers a warning notification" },
        { key: "strikeFinalWarningThreshold", label: "Final warning at (strikes)", hint: "Rolling-window strike count that triggers a final warning + profile flag" },
        { key: "strikeBlockThreshold", label: "Block at (strikes)", hint: "Rolling-window strike count that triggers a temporary account block" },
        { key: "strikeBlockDays", label: "Block length (days)", hint: "How long the account block lasts — lifts automatically" },
        { key: "strikeRollingWindowDays", label: "Rolling window (days)", hint: "How far back strikes (late cancels, no-shows) are counted for the thresholds above" },
      ],
    },
    {
      heading: "Other",
      fields: [
        { key: "defaultMaxDetourKm", label: "Default max detour (km)", hint: "Default pickup-point tolerance when a driver doesn't set one" },
        { key: "bookingExpiryMinutes", label: "Driver response window (minutes)", hint: "How long a driver has to accept/reject a request before it auto-expires" },
      ],
    },
  ];

  return (
    <AdminShell activeHref="/settings/config">
      <div style={{ padding: 24, fontFamily: "sans-serif" }}>
        <PageHeader icon={SettingsIcon} title="App configuration" />
        <p style={{ fontSize: 13, color: "#5F5E5A" }}>
          Super Admin only. The backend reads these values (with a short
          in-memory cache, so changes take effect within ~15 seconds — no
          redeploy needed).
        </p>

        <form action={saveConfig} style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 28, maxWidth: 520 }}>
          {groups.map((group) => (
            <div key={group.heading}>
              <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>{group.heading}</h2>
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {group.fields.map((f) => (
                  <div key={f.key}>
                    <label style={{ fontSize: 13, fontWeight: 500, display: "block", marginBottom: 4 }}>{f.label}</label>
                    <input
                      name={f.key}
                      type="number"
                      step="any"
                      defaultValue={String(config![f.key])}
                      className="admin-input"
                      style={{ width: "100%" }}
                    />
                    <div style={{ fontSize: 11, color: "#888780", marginTop: 2 }}>{f.hint}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          <SubmitButton pendingLabel="Saving...">Save configuration</SubmitButton>
        </form>
      </div>
    </AdminShell>
  );
}
