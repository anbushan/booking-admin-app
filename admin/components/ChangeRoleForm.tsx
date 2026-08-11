"use client";

import { useRef, useState } from "react";
import { SubmitButton } from "./SubmitButton";
import { ConfirmModal } from "./ConfirmModal";

// Same reasoning as RejectVehicleForm/BroadcastForm: ConfirmButton's
// hiddenFields API is static, but the role being granted here is
// whatever's currently selected in the live <select> at submit time —
// a canned confirm message can't capture that ahead of render, so this
// intercepts onSubmit instead of using ConfirmButton directly. Granting
// (or revoking) super_admin/finance/etc. is exactly the kind of
// low-frequency, high-consequence action a stray click on the wrong
// dropdown row should get a chance to catch before it lands.
export function ChangeRoleForm({
  action,
  adminId,
  adminEmail,
  roles,
  currentRole,
}: {
  action: (formData: FormData) => void | Promise<void>;
  adminId: string;
  adminEmail: string;
  roles: string[];
  currentRole: string;
}) {
  const [role, setRole] = useState(currentRole);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  // Ref, not state — see RejectVehicleForm's identical comment: onConfirm
  // calls requestSubmit() synchronously right after flipping this, and
  // the re-triggered onSubmit needs to see the flip on that very next
  // dispatch, before a state update would have committed.
  const confirmedRef = useRef(false);

  return (
    <>
      <form
        ref={formRef}
        action={action}
        onSubmit={(e) => {
          if (!confirmedRef.current) {
            e.preventDefault();
            setConfirmOpen(true);
          }
        }}
        style={{ display: "flex", gap: 6 }}
      >
        <input type="hidden" name="adminId" value={adminId} />
        <select
          name="role"
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="admin-select"
          style={{ height: 30, fontSize: 12 }}
        >
          {roles.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
        <SubmitButton className="admin-btn admin-btn-secondary admin-btn-sm" pendingLabel="Updating...">
          Update
        </SubmitButton>
      </form>

      <ConfirmModal
        open={confirmOpen}
        title="Change this admin's role?"
        message={`${adminEmail} will ${currentRole && currentRole !== "none" ? `move from "${currentRole}" ` : ""}become "${role}" — this changes what they can see and do in this dashboard immediately, including on their current session.`}
        confirmLabel="Change role"
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
