"use client";

import { useRef, useState } from "react";
import { ConfirmModal } from "./ConfirmModal";

// Sign-out posts to /api/admin-logout via a plain HTML form action (a
// URL string, not a server action reference) — ConfirmButton's `action`
// prop is typed specifically for the `(formData) => void` server-action
// shape, so it doesn't fit here without loosening that type for every
// other caller. Same mechanics regardless: the visible button only
// opens the confirm modal; the real submit happens via
// formRef.current.requestSubmit() once confirmed. AdminShell renders
// this twice (collapsed/expanded sidebar footer, and the avatar
// dropdown) with different button markup for each spot, hence
// `children`/`className` instead of a fixed label.
export function SignOutButton({
  className,
  // Sidebar footer's form carries `admin-signout-form` (`margin-top:
  // auto`, the flex trick that pins it to the bottom of the nav column)
  // — dropping that class when this replaced the plain <form> would
  // have left the button sitting inline with the rest of the nav links
  // instead of pinned to the bottom. The avatar-menu call site doesn't
  // need one.
  formClassName,
  title,
  children,
}: {
  className: string;
  formClassName?: string;
  title?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <>
      <form ref={formRef} action="/api/admin-logout" method="post" className={formClassName}>
        <button type="button" className={className} title={title} onClick={() => setOpen(true)}>
          {children}
        </button>
      </form>

      <ConfirmModal
        open={open}
        title="Sign out?"
        message="You'll need to sign in again to get back into the admin dashboard."
        confirmLabel="Sign out"
        submitting={submitting}
        danger={false}
        onCancel={() => setOpen(false)}
        onConfirm={() => {
          setSubmitting(true);
          formRef.current?.requestSubmit();
        }}
      />
    </>
  );
}
