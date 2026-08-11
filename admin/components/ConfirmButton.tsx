"use client";

import { useRef, useState } from "react";
import { ConfirmModal } from "./ConfirmModal";

// The one thing missing from every destructive action in admin
// (suspend an account, cancel a ride, reject a document, delete a
// review) — they fired the moment the button was clicked, no "are you
// sure" step at all. This wraps the actual <form action={serverAction}>
// so the visible button only opens a confirm modal; the real submit
// happens programmatically (formRef.current.requestSubmit()) only
// after the admin explicitly confirms.
export function ConfirmButton({
  action,
  hiddenFields,
  label,
  confirmTitle,
  confirmMessage,
  confirmLabel = "Confirm",
  className = "admin-btn admin-btn-danger-outline",
}: {
  action: (formData: FormData) => void | Promise<void>;
  hiddenFields: Record<string, string>;
  label: string;
  confirmTitle: string;
  confirmMessage: string;
  confirmLabel?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <>
      <form ref={formRef} action={action} style={{ display: "inline" }}>
        {Object.entries(hiddenFields).map(([key, value]) => (
          <input key={key} type="hidden" name={key} value={value} />
        ))}
        <button type="button" className={className} onClick={() => setOpen(true)}>
          {label}
        </button>
      </form>

      <ConfirmModal
        open={open}
        title={confirmTitle}
        message={confirmMessage}
        confirmLabel={confirmLabel}
        submitting={submitting}
        onCancel={() => setOpen(false)}
        onConfirm={() => {
          setSubmitting(true);
          formRef.current?.requestSubmit();
        }}
      />
    </>
  );
}
