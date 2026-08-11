import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { MarketingShell } from "../../../components/MarketingShell";
import { SITE_URL, BRAND_NAME, BLOG_POSTS } from "../../../lib/siteContent";

// Static generation for every known slug at build time — this is the
// "static blog" the ask was for, not a CMS-backed dynamic route; there's
// no database query behind this page at all, just the BLOG_POSTS array.
export function generateStaticParams() {
  return BLOG_POSTS.map((post) => ({ slug: post.slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const post = BLOG_POSTS.find((p) => p.slug === params.slug);
  if (!post) return { title: `Not found — ${BRAND_NAME}` };

  const url = `${SITE_URL}/blog/${post.slug}`;
  return {
    title: `${post.title} — ${BRAND_NAME} Blog`,
    description: post.excerpt,
    alternates: { canonical: url },
    openGraph: {
      title: post.title,
      description: post.excerpt,
      url,
      siteName: BRAND_NAME,
      type: "article",
      publishedTime: post.date,
    },
    twitter: { card: "summary_large_image", title: post.title, description: post.excerpt },
  };
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
}

export default function BlogPostPage({ params }: { params: { slug: string } }) {
  const post = BLOG_POSTS.find((p) => p.slug === params.slug);
  if (!post) notFound();

  const url = `${SITE_URL}/blog/${post.slug}`;
  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.excerpt,
    datePublished: post.date,
    url,
    author: { "@type": "Organization", name: BRAND_NAME },
    publisher: { "@type": "Organization", name: BRAND_NAME },
    mainEntityOfPage: url,
  };

  return (
    <MarketingShell>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }} />

      <article className="mkt-section-tight">
        <Link href="/blog" className="mkt-back-link">
          <ArrowLeft size={14} /> All posts
        </Link>
        <div className="mkt-blog-meta">{formatDate(post.date)} · {post.readMinutes} min read</div>
        <h1 className="mkt-h1" style={{ fontSize: "clamp(26px, 4vw, 38px)" }}>{post.title}</h1>
        <div className="mkt-blog-post-body" style={{ marginTop: 24 }}>
          {post.body.map((paragraph, i) => (
            <p key={i}>{paragraph}</p>
          ))}
        </div>

        <div style={{ marginTop: 40, paddingTop: 24, borderTop: "1px solid #E3E1D8", display: "flex", gap: 16, flexWrap: "wrap" }}>
          <Link href="/faq" className="mkt-btn mkt-btn-secondary">Read the FAQ</Link>
          <Link href="/blog" className="mkt-btn mkt-btn-secondary">More posts</Link>
        </div>
      </article>
    </MarketingShell>
  );
}
