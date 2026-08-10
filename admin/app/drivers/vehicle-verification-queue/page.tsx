import { prisma } from "../../../lib/prisma";
import { getSession, requireRole } from "../../../lib/session";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import AdminShell from "../../../components/AdminShell";
import { PageHeader } from "../../../components/PageHeader";
import { Badge } from "../../../components/Badge";
import { Car } from "lucide-react";
import { getDocumentViewUrl } from "../../../lib/r2";
import { notify } from "../../../lib/notify";
import { EmptyState } from "../../../components/EmptyState";
import Pagination from "../../../components/Pagination";
import { SubmitButton } from "../../../components/SubmitButton";
import { RejectVehicleForm } from "../../../components/RejectVehicleForm";
import { redirectWithToast } from "../../../lib/toastRedirect";

export const dynamic = "force-dynamic";
const PAGE_SIZE = 20;

async function approveVehicle(formData: FormData) {
  "use server";
  const vehicleId = formData.get("vehicleId") as string;
  const session = getSession();

  const vehicle = await prisma.vehicle.update({
    where: { id: vehicleId },
    data: { status: "APPROVED", reviewedAt: new Date(), reviewedBy: session?.adminId },
  });

  await notify(
    vehicle.driverId,
    "VEHICLE_APPROVED",
    "Your vehicle is approved",
    `${vehicle.make} ${vehicle.model} (${vehicle.regNumber}) passed review — you can publish rides with it now.`
  );

  revalidatePath("/drivers/vehicle-verification-queue");
  redirectWithToast("/drivers/vehicle-verification-queue", "Vehicle approved.");
}

async function rejectVehicle(formData: FormData) {
  "use server";
  const vehicleId = formData.get("vehicleId") as string;
  const reason = String(formData.get("reason") || "").trim();
  const session = getSession();

  if (!reason) {
    redirectWithToast("/drivers/vehicle-verification-queue", "A reason is required to reject a vehicle.", "error");
    return;
  }

  const vehicle = await prisma.vehicle.update({
    where: { id: vehicleId },
    data: { status: "REJECTED", rejectionReason: reason, reviewedAt: new Date(), reviewedBy: session?.adminId },
  });

  await notify(
    vehicle.driverId,
    "VEHICLE_REJECTED",
    "Your vehicle needs another look",
    `${vehicle.make} ${vehicle.model} (${vehicle.regNumber}) wasn't approved: ${reason} — you can fix it and resubmit.`
  );

  revalidatePath("/drivers/vehicle-verification-queue");
  redirectWithToast("/drivers/vehicle-verification-queue", "Vehicle rejected.");
}

export default async function VehicleVerificationQueuePage({ searchParams }: { searchParams: { page?: string } }) {
  const session = getSession();
  if (!requireRole(session, ["verification"])) {
    redirect("/login");
  }

  const page = Math.max(1, Number(searchParams.page || 1));
  const where = { status: "PENDING" };

  const [pendingVehicles, total] = await Promise.all([
    prisma.vehicle.findMany({
      where,
      include: { driver: { select: { name: true, phone: true } } },
      orderBy: { createdAt: "asc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.vehicle.count({ where }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Paginated first, THEN signed — one batch of signed-URL calls per
  // page shown, not per vehicle in the whole queue (same reasoning as
  // the driver-document queue this page mirrors).
  const vehiclesWithViewUrls = await Promise.all(
    pendingVehicles.map(async (v) => ({
      ...v,
      photoViewUrl: v.photoR2Key ? await getDocumentViewUrl(v.photoR2Key).catch(() => null) : null,
      rcViewUrl: v.rcR2Key ? await getDocumentViewUrl(v.rcR2Key).catch(() => null) : null,
      dlViewUrl: v.dlR2Key ? await getDocumentViewUrl(v.dlR2Key).catch(() => null) : null,
    }))
  );

  return (
    <AdminShell activeHref="/drivers/vehicle-verification-queue">
    <div style={{ padding: 24 }}>
      <PageHeader icon={Car} title="Vehicle verification queue" subtitle={`${total} vehicle(s) awaiting review`} />

      <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 12 }}>
        {vehiclesWithViewUrls.map((v) => (
          <div
            key={v.id}
            style={{
              border: "1px solid #E3E1D8",
              borderRadius: 8,
              padding: 16,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              flexWrap: "wrap",
              gap: 12,
            }}
          >
            <div>
              <div style={{ fontWeight: 500, fontSize: 14, display: "flex", alignItems: "center", gap: 8 }}>
                <span>{v.driver.name || v.driver.phone}</span>
                <Badge tone="neutral">{`${v.make} ${v.model}`}</Badge>
                <Badge tone="neutral">{v.regNumber}</Badge>
                {v.seatCapacity != null && <Badge tone="neutral">{`${v.seatCapacity}-seater`}</Badge>}
              </div>
              <div style={{ fontSize: 12, color: "#888780", marginBottom: 6 }}>
                Added {v.createdAt.toLocaleDateString()}
              </div>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                {v.photoViewUrl ? (
                  <a href={v.photoViewUrl} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: "#0C447C" }}>
                    Car photo (expires in 5 min)
                  </a>
                ) : (
                  <span style={{ fontSize: 12, color: "#888780" }}>No car photo</span>
                )}
                {v.rcViewUrl ? (
                  <a href={v.rcViewUrl} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: "#0C447C" }}>
                    RC book (expires in 5 min)
                  </a>
                ) : (
                  <span style={{ fontSize: 12, color: "#A32D2D" }}>No RC uploaded</span>
                )}
                {v.dlViewUrl ? (
                  <a href={v.dlViewUrl} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: "#0C447C" }}>
                    Driving license (expires in 5 min)
                  </a>
                ) : (
                  <span style={{ fontSize: 12, color: "#888780" }}>No DL uploaded</span>
                )}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
              <form action={approveVehicle}>
                <input type="hidden" name="vehicleId" value={v.id} />
                <SubmitButton pendingLabel="Approving...">Approve</SubmitButton>
              </form>
              <RejectVehicleForm
                action={rejectVehicle}
                vehicleId={v.id}
                driverLabel={v.driver.name || v.driver.phone}
              />
            </div>
          </div>
        ))}
        {pendingVehicles.length === 0 && (
          <EmptyState title="Nothing pending review" />
        )}
      </div>
      <Pagination page={page} totalPages={totalPages} basePath="/drivers/vehicle-verification-queue" />
    </div>
    </AdminShell>
  );
}
