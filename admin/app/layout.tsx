import "./globals.css";

// Wasn't set anywhere before this — the browser tab just showed the
// bare URL, and there was nothing for search/bookmarks to show either.
export const metadata = {
  title: "NanbaGO Admin",
  description: "Admin dashboard for NanbaGO — Dosti For Every Journey.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: "#FFFFFF" }}>{children}</body>
    </html>
  );
}
