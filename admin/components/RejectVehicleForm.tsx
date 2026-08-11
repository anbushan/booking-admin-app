"use client";

import { useRef, useState } from "react";
import { SubmitButton } from "./SubmitButton";
import { ConfirmModal } from "./ConfirmModal";

// Same reasoning as BroadcastForm: ConfirmButton's hiddenFields API is
// static, but rejecting a vehicle needs a live-typed reason — the
// driver sees this verbatim (see vehicle-verification-queue/page.tsx's
// rejectVehicle action), so a canned confirm message can't stand in
// for it. Starts collapsed; the reason field only appears once "Reject"
// is clicked once, so approving (the common case) isn't cluttered by
// a text box every row doesn't need. The final "are you sure" step
// used to be a native confirm() — replaced with the same modal the
// rest of admin's destructive actions use (see ConfirmModal), so it
// doesn't block the tab or look out of place.
export function RejectVehicleForm({
  action,
  vehicleId,
  driverLabel,
}: {
  action: (formData: FormData) => void | Promise<void>;
  vehicleId: string;
  driverLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  // A ref, not state — onConfirm calls requestSubmit() synchronously
  // right after flipping this, and onSubmit needs to see the flip on
  // that very next dispatch. State updates from onConfirm wouldn't have
  // committed yet by the time the re-triggered onSubmit runs, so the
  // gate would still read as "not confirmed" and re-open the modal
  // instead of letting the real submission through.
  const confirmedRef = useRef(false);

  if (!open) {
    return (
      <button type="button" className="admin-btn admin-btn-secondary" onClick={() => setOpen(true)}>
        Reject
      </button>
    );
  }

  return (
    <>
      <form
        ref={formRef}
        action={action}
        onSubmit={(e) => {
          if (!reason.trim()) {
            e.preventDefault();
            return;
          }
          if (!confirmedRef.current) {
            e.preventDefault();
            setConfirmOpen(true);
          }
        }}
        style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 220 }}
      >
        <input type="hidden" name="vehicleId" value={vehicleId} />
        <textarea
          name="reason"
          required
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Why is this being rejected? e.g. RC photo is blurry, plate doesn't match"
          className="admin-input"
          style={{ minHeight: 56, fontSize: 12, fontFamily: "inherit", resize: "vertical" }}
          autoFocus
        />
        <div style={{ display: "flex", gap: 6 }}>
          <SubmitButton className="admin-btn admin-btn-danger admin-btn-sm" pendingLabel="Rejecting...">
            Confirm reject
          </SubmitButton>
          <button type="button" className="admin-btn admin-btn-secondary admin-btn-sm" onClick={() => setOpen(false)}>
            Cancel
          </button>
        </div>
      </form>

      <ConfirmModal
        open={confirmOpen}
        title="Reject this vehicle?"
        message={`Reject ${driverLabel}'s vehicle? They'll see this reason and can resubmit.`}
        confirmLabel="Reject vehicle"
        submitting={submitting}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => {
          setSubmitting(true);
          confirmedRef.current = true;
          formRef.current?.requestSubmit();
        }}
      />
    </>
  );
}
