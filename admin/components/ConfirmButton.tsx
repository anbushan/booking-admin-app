"use client";

import { useRef, useState } from "react";
import { AlertTriangle } from "lucide-react";

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

      {open && (
        <div className="admin-modal-backdrop" onClick={() => setOpen(false)}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-icon">
              <AlertTriangle size={18} />
            </div>
            <div className="admin-modal-title">{confirmTitle}</div>
            <div className="admin-modal-message">{confirmMessage}</div>
            <div className="admin-modal-actions">
              <button className="admin-btn admin-btn-secondary" onClick={() => setOpen(false)} disabled={submitting}>
                Cancel
              </button>
              <button
                className="admin-btn admin-btn-danger"
                disabled={submitting}
                onClick={() => {
                  setSubmitting(true);
                  formRef.current?.requestSubmit();
                }}
              >
                {submitting ? "Working..." : confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
