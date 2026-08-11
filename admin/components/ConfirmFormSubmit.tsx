"use client";

import { useRef, useState } from "react";
import { ConfirmModal } from "./ConfirmModal";

// A step up from ConfirmButton for forms this doesn't fit: ConfirmButton
// needs every field value known ahead of render (its hiddenFields prop),
// which works for a single id passed through a hidden input, but not a
// form full of live-typed/selected fields (like app config's ~16 number
// inputs) where the confirm step doesn't need to echo back what changed —
// a fixed warning about the blast radius is enough, unlike ChangeRoleForm/
// RejectVehicleForm which do need to reflect a specific live value. Wraps
// the *entire* form via `children` instead of taking over field state, so
// none of the wrapped fields need to become controlled components just to
// gain a confirm step.
export function ConfirmFormSubmit({
  action,
  formStyle,
  confirmTitle,
  confirmMessage,
  confirmLabel = "Confirm",
  children,
}: {
  action: (formData: FormData) => void | Promise<void>;
  formStyle?: React.CSSProperties;
  confirmTitle: string;
  confirmMessage: string;
  confirmLabel?: string;
  children: React.ReactNode;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  // Ref, not state — same reason as RejectVehicleForm/ChangeRoleForm:
  // onConfirm's requestSubmit() re-triggers onSubmit synchronously,
  // before a state update from the same handler would have committed.
  const confirmedRef = useRef(false);

  return (
    <>
      <form
        ref={formRef}
        action={action}
        style={formStyle}
        onSubmit={(e) => {
          if (!confirmedRef.current) {
            e.preventDefault();
            setConfirmOpen(true);
          }
        }}
      >
        {children}
      </form>

      <ConfirmModal
        open={confirmOpen}
        title={confirmTitle}
        message={confirmMessage}
        confirmLabel={confirmLabel}
        submitting={submitting}
        danger={false}
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
