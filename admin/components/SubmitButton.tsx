"use client";

import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";

// A plain <button type="submit"> inside a Server Action <form> gives
// zero feedback while the action is running — nothing disabled it, no
// spinner, nothing stopped a double-click from firing the mutation
// twice. useFormStatus (from react-dom) reports the nearest parent
// <form>'s pending state, but only inside a client component — which
// is the one reason this needs "use client" at all; the surrounding
// page and its Server Action stay exactly as they were.
export function SubmitButton({
  children,
  className = "admin-btn admin-btn-primary",
  pendingLabel,
  style,
}: {
  children: React.ReactNode;
  className?: string;
  pendingLabel?: string;
  style?: React.CSSProperties;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending} style={style}>
      {pending && <Loader2 size={14} className="admin-spin" />}
      {pending && pendingLabel ? pendingLabel : children}
    </button>
  );
}
