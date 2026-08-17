"use client";

import { useRef } from "react";

// Thin wrapper around the hero visual card — adds a mouse-parallax 3D
// tilt on top of the CSS-driven `.mkt-float` idle animation (globals.css)
// for pointer-capable devices. Touch devices (no real "hover" pointer)
// just get the float; there's no mousemove to react to and no fake
// gyroscope-driven tilt substituted in — that would be its own separate
// feature, not a drop-in equivalent.
//
// Sets CSS custom properties rather than restyling `transform` directly
// from JS on every event — `.mkt-tilt` (globals.css) already owns the
// `transform: perspective(...) rotateX(var(--rx)) rotateY(var(--ry))`
// declaration, this just feeds it two numbers. Keeps the actual 3D math
// declarative/in CSS, this component only ever does arithmetic + set.
const MAX_TILT_DEG = 8;

export function HeroTilt({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    const el = ref.current;
    if (!el || !window.matchMedia("(hover: hover)").matches) return;
    const rect = el.getBoundingClientRect();
    // Cursor position within the card, -0.5..0.5 on each axis.
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    // Moving the mouse right/down tilts the card's far edge away from
    // the cursor — rotateY follows horizontal position, rotateX is
    // inverted vertical (natural "leaning toward you" feel).
    el.style.setProperty("--ry", `${px * MAX_TILT_DEG * 2}deg`);
    el.style.setProperty("--rx", `${py * -MAX_TILT_DEG * 2}deg`);
  }

  function handleMouseLeave() {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty("--rx", "0deg");
    el.style.setProperty("--ry", "0deg");
  }

  return (
    <div
      ref={ref}
      className={`mkt-3d-perspective ${className}`}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <div className="mkt-tilt mkt-float">{children}</div>
    </div>
  );
}
