"use client";

import { useState } from "react";
import { SubmitButton } from "./SubmitButton";

const AUDIENCES = [
  { value: "ALL", label: "Everyone" },
  { value: "PASSENGER", label: "Passengers only" },
  { value: "DRIVER", label: "Drivers only" },
] as const;

// A plain <form action={serverAction}> can't carry a confirm step the
// way ConfirmButton does elsewhere in admin — that component's API only
// supports static hidden fields, not a form with its own live-typed
// title/body/audience. This wraps the same form in a client component
// just to gate the actual submit behind a native confirm() instead,
// which is enough friction for what's still a one-admin internal tool.
export function BroadcastForm({ action }: { action: (formData: FormData) => void | Promise<void> }) {
  const [audience, setAudience] = useState<(typeof AUDIENCES)[number]["value"]>("ALL");

  return (
    <form
      action={action}
      onSubmit={(e) => {
        const label = AUDIENCES.find((a) => a.value === audience)?.label || audience;
        if (!confirm(`Send this notification to ${label.toLowerCase()}? This can't be recalled once sent.`)) {
          e.preventDefault();
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
  );
}
