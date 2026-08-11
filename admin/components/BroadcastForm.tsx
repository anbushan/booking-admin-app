"use client";

import { useRef, useState } from "react";
import { SubmitButton } from "./SubmitButton";
import { ConfirmModal } from "./ConfirmModal";

const AUDIENCES = [
  { value: "ALL", label: "Everyone" },
  { value: "PASSENGER", label: "Passengers only" },
  { value: "DRIVER", label: "Drivers only" },
] as const;

// A plain <form action={serverAction}> can't carry a confirm step the
// way ConfirmButton does elsewhere in admin — that component's API only
// supports static hidden fields, not a form with its own live-typed
// title/body/audience. This gates the actual submit behind the same
// ConfirmModal every other destructive action in admin uses, instead of
// the browser's native confirm() (unstyled, blocks the tab, and this is
// an internal tool broadcasting to real users — worth a real "are you
// sure", not something to skip).
export function BroadcastForm({ action }: { action: (formData: FormData) => void | Promise<void> }) {
  const [audience, setAudience] = useState<(typeof AUDIENCES)[number]["value"]>("ALL");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  // See RejectVehicleForm's identical ref for why this can't be state —
  // requestSubmit() re-triggers onSubmit synchronously, before a state
  // update from the same click would have committed.
  const confirmedRef = useRef(false);

  const label = AUDIENCES.find((a) => a.value === audience)?.label || audience;

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
        style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 520 }}
      >
        <div>
          <label style={{ fontSize: 13, fontWeight: 500, display: "block", marginBottom: 4 }}>Audience</label>
          <div style={{ display: "flex", gap: 8 }}>
            {AUDIENCES.map((a) => (
              <label
                key={a.value}
                style={{
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 13,
                  border: `1px solid ${audience === a.value ? "#185FA5" : "#E3E1D8"}`,
                  background: audience === a.value ? "#E6F1FB" : "#FFFFFF",
                  borderRadius: 8,
                  padding: "8px 10px",
                  cursor: "pointer",
                }}
              >
                <input
                  type="radio"
                  name="audience"
                  value={a.value}
                  checked={audience === a.value}
                  onChange={() => setAudience(a.value)}
                />
                {a.label}
              </label>
            ))}
          </div>
        </div>

        <div>
          <label style={{ fontSize: 13, fontWeight: 500, display: "block", marginBottom: 4 }}>Title</label>
          <input name="title" required maxLength={80} placeholder="e.g. Weekend fare discount" className="admin-input" style={{ width: "100%" }} />
        </div>

        <div>
          <label style={{ fontSize: 13, fontWeight: 500, display: "block", marginBottom: 4 }}>Message</label>
          <textarea
            name="body"
            required
            maxLength={300}
            placeholder="e.g. Get 15% off your platform fee this weekend on rides booked before Sunday."
            className="admin-input"
            style={{ width: "100%", minHeight: 90, resize: "vertical", fontFamily: "inherit" }}
          />
        </div>

        <SubmitButton pendingLabel="Sending...">Send notification</SubmitButton>
      </form>

      <ConfirmModal
        open={confirmOpen}
        title="Send this notification?"
        message={`Send this notification to ${label.toLowerCase()}? This can't be recalled once sent.`}
        confirmLabel="Send notification"
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
