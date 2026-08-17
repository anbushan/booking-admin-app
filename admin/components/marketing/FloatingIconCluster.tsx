import { type LucideIcon } from "lucide-react";
import { ScrollReveal3D } from "./ScrollReveal3D";

// Small decorative accent for an otherwise text-only hero (About/
// Safety/Pricing all used to be a bare eyebrow+h1+lede stack with
// nothing visual at all) — 2-3 icons relevant to that page, each in
// its own tinted rounded tile (same treatment StatCard/PageHeader's
// icon badges already use elsewhere in this app, not a new shape),
// offset in a loose scatter and drifting in and out of sync via a
// different `animation-delay` per icon (see `.mkt-float` in
// globals.css) so it reads as ambient motion, not a mechanically
// synchronized group. Purely decorative — `aria-hidden`, the real
// content is the heading/lede text next to it.
//
// Server-renderable itself (no "use client" needed here — the only
// client-side piece is the scroll-reveal wrapper it delegates to).
const TONES: { bg: string; fg: string }[] = [
  { bg: "#E6F1FB", fg: "#0C447C" },
  { bg: "#EAF3DE", fg: "#3B6D11" },
  { bg: "#FBECD4", fg: "#8A5406" },
];

const OFFSETS = [
  { top: "6%", left: "10%", size: 52 },
  { top: "42%", left: "58%", size: 40 },
  { top: "68%", left: "18%", size: 46 },
];

export function FloatingIconCluster({ icons }: { icons: LucideIcon[] }) {
  const items = icons.slice(0, 3);
  return (
    <ScrollReveal3D className="mkt-float-icon-cluster" delayMs={100}>
      <div className="mkt-3d-perspective" style={{ position: "relative", width: "100%", height: "100%" }} aria-hidden="true">
        {items.map((Icon, i) => {
          const tone = TONES[i % TONES.length];
          const offset = OFFSETS[i % OFFSETS.length];
          return (
            <div
              key={i}
              className="mkt-float-icon mkt-float"
              style={{
                top: offset.top,
                left: offset.left,
                width: offset.size,
                height: offset.size,
                background: tone.bg,
                color: tone.fg,
                animationDelay: `${i * 0.7}s`,
              }}
            >
              <Icon size={offset.size * 0.45} strokeWidth={2} />
            </div>
          );
        })}
      </div>
    </ScrollReveal3D>
  );
}
