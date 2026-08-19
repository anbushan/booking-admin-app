import Link from "next/link";
import { ChevronRight } from "lucide-react";

// The first breadcrumb in the app — every detail page previously had
// only a "Back to X" link, which tells you where you'd land but not
// where you are. This replaces that link (not supplements it — the
// second-to-last segment already does the "go back to the list" job),
// and doubles as the page's own location trail once you've navigated
// here by clicking through from somewhere other than the list itself
// (e.g. rides/[id] -> a booking -> its passenger -> back out again).
export function Breadcrumb({ items }: { items: { label: string; href?: string }[] }) {
  return (
    <nav style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 4, fontSize: 13, color: "var(--admin-ink-faint)", marginBottom: 12 }}>
      {items.map((item, i) => (
        <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
          {i > 0 && <ChevronRight size={12} style={{ opacity: 0.6 }} />}
          {item.href ? (
            <Link href={item.href} style={{ color: "var(--admin-ink-faint)" }}>
              {item.label}
            </Link>
          ) : (
            <span style={{ color: "var(--admin-ink-muted)", fontWeight: 500 }}>{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
