import type { Metadata } from "next";
import Link from "next/link";
import { Newspaper } from "lucide-react";
import { MarketingShell } from "../../components/MarketingShell";
import { SITE_URL, BRAND_NAME, BLOG_POSTS } from "../../lib/siteContent";

const TITLE = "Blog";
const DESCRIPTION = `Notes on how ${BRAND_NAME} actually works — the platform fee model, safety features, driver verification, and cancellation policy, written plainly.`;

export const metadata: Metadata = {
  title: `${TITLE} — ${BRAND_NAME}`,
  description: DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/blog` },
  openGraph: { title: `${TITLE} — ${BRAND_NAME}`, description: DESCRIPTION, url: `${SITE_URL}/blog`, siteName: BRAND_NAME, type: "website" },
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
}

export default function BlogIndexPage() {
  const posts = [...BLOG_POSTS].sort((a, b) => (a.date < b.date ? 1 : -1));

  return (
    <MarketingShell>
      <section className="mkt-section">
        <Newspaper size={28} color="#185FA5" style={{ marginBottom: 12 }} />
        <h1 className="mkt-h1" style={{ fontSize: "clamp(28px, 4vw, 40px)" }}>{TITLE}</h1>
        <p className="mkt-lede">{DESCRIPTION}</p>

        <div className="mkt-blog-grid">
          {posts.map((post) => (
            <Link key={post.slug} href={`/blog/${post.slug}`} className="mkt-blog-card">
              <div className="mkt-blog-meta">{formatDate(post.date)} · {post.readMinutes} min read</div>
              <h2>{post.title}</h2>
              <p>{post.excerpt}</p>
            </Link>
          ))}
        </div>
      </section>
    </MarketingShell>
  );
}
