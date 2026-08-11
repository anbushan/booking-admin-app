"use client";

import { AlertTriangle } from "lucide-react";

// Shared modal chrome, extracted out of ConfirmButton so anything that
// needs a real "are you sure" step but can't use ConfirmButton's
// static-hidden-fields API (a form with its own live-typed content —
// RejectVehicleForm's reason textarea, BroadcastForm's title/body/
// audience) doesn't fall back to the browser's native confirm(), which
// is unstyled, blocks the whole tab, and reads as broken next to the
// rest of admin's UI.
export function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  submitting = false,
  danger = true,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  submitting?: boolean;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;

  return (
    <div className="admin-modal-backdrop" onClick={onCancel}>
      <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
        <div className="admin-modal-icon">
          <AlertTriangle size={18} />
        </div>
        <div className="admin-modal-title">{title}</div>
        <div className="admin-modal-message">{message}</div>
        <div className="admin-modal-actions">
          <button className="admin-btn admin-btn-secondary" onClick={onCancel} disabled={submitting}>
            {cancelLabel}
          </button>
          <button
            className={danger ? "admin-btn admin-btn-danger" : "admin-btn admin-btn-primary"}
            disabled={submitting}
            onClick={onConfirm}
          >
            {submitting ? "Working..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
