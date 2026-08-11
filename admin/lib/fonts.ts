import { Poppins } from "next/font/google";

// Same brand face as the mobile app (see mobile/src/theme/theme.ts's
// FONT constants, added earlier this project) — self-hosted at build
// time via next/font (no runtime Google Fonts CDN request, so this
// doesn't cost the page a render-blocking third-party fetch or a
// flash-of-different-font). Scoped to the marketing pages only, via
// `poppins.variable` applied at MarketingShell's root rather than
// admin's global layout — the actual dashboard keeps its existing
// sans-serif everywhere else; this doesn't change that.
export const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-poppins",
  display: "swap",
});
