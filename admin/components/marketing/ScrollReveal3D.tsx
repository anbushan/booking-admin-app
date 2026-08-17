"use client";

import { useEffect, useRef, useState } from "react";

// Wraps any block of content (the journey mockups, a floating icon
// cluster) with a one-time 3D reveal as it scrolls into view — toggles
// `.mkt-reveal-in` (globals.css) once, then stops observing. Content
// already in the viewport on mount (nothing to "scroll into") reveals
// immediately: IntersectionObserver reports its initial intersection
// state as soon as `observe()` is called, it doesn't require an actual
// scroll event first, so there's no dead flash of hidden content for
// anything visible on first paint.
//
// `.mkt-reveal` itself only exists inside globals.css's
// `prefers-reduced-motion: no-preference` block (with a `reduce`-block
// override forcing full visibility) — so this component works
// unchanged either way; it's the CSS, not this observer, deciding
// whether reduced-motion users ever see the hidden/tilted state at all.
export function ScrollReveal3D({
  children,
  className = "",
  delayMs = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delayMs?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setRevealed(true); // no observer support — show it, don't hide content behind a feature that can't fire
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setTimeout(() => setRevealed(true), delayMs);
          observer.unobserve(el);
        }
      },
      { threshold: 0.2 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [delayMs]);

  return (
    <div ref={ref} className={`mkt-reveal ${revealed ? "mkt-reveal-in" : ""} ${className}`}>
      {children}
    </div>
  );
}
