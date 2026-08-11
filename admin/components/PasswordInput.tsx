"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

// Every password field in admin (login, reset, create-admin) was a bare
// <input type="password">, with no way to check what you'd actually
// typed before submitting — the one field in the whole app where a
// silent typo means "wrong password" only after a failed submit, or
// worse, a mismatched password nobody notices was ever set. Same
// server-friendly API as a plain input (name/required/etc. pass through
// via ...rest) so this drops in wherever type="password" was.
export function PasswordInput({
  name,
  placeholder,
  required,
  minLength,
  style,
  autoComplete,
  height = 40,
}: {
  name: string;
  placeholder?: string;
  required?: boolean;
  minLength?: number;
  style?: React.CSSProperties;
  autoComplete?: string;
  // Matches whatever height the surrounding form's other inputs use —
  // the centered auth-card forms (login/reset-password) size everything
  // to 40px, but the compact inline row in settings/roles' "Add admin"
  // form uses .admin-input's own 36px default alongside a plain <input>
  // and <select>, so this needs to match that instead of always
  // defaulting to the auth-card height.
  height?: number;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div style={{ position: "relative", ...style }}>
      <input
        name={name}
        type={visible ? "text" : "password"}
        placeholder={placeholder}
        required={required}
        minLength={minLength}
        autoComplete={autoComplete}
        className="admin-input"
        style={{ height, width: "100%", paddingRight: 36 }}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Hide password" : "Show password"}
        tabIndex={-1}
        style={{
          position: "absolute",
          right: 8,
          top: "50%",
          transform: "translateY(-50%)",
          background: "none",
          border: "none",
          padding: 4,
          display: "flex",
          alignItems: "center",
          cursor: "pointer",
          color: "#888780",
        }}
      >
        {visible ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
}
