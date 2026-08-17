// `extraParams` carries whatever search/filter/sort is currently
// active so paging Next/Previous doesn't silently drop it — this used
// to only ever build `${basePath}?page=N`, so navigating to page 2
// while a search/filter was active reset straight back to the
// unfiltered list.
function buildHref(basePath: string, page: number, extraParams: Record<string, string | undefined>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(extraParams)) {
    if (value) params.set(key, value);
  }
  params.set("page", String(page));
  return `${basePath}?${params.toString()}`;
}

export default function Pagination({
  page,
  totalPages,
  basePath,
  extraParams = {},
}: {
  page: number;
  totalPages: number;
  basePath: string;
  extraParams?: Record<string, string | undefined>;
}) {
  if (totalPages <= 1) return null;
  return (
    <div style={{ display: "flex", gap: 8, marginTop: 16, fontSize: 13, alignItems: "center" }}>
      {/* Bare text links before — no visible affordance that these were
          clickable buttons versus just colored text. `.admin-btn-*` is
          the same pill/hover treatment every other action in the admin
          already uses, so paging finally looks like the rest of the UI. */}
      {page > 1 ? (
        <a href={buildHref(basePath, page - 1, extraParams)} className="admin-btn admin-btn-secondary admin-btn-sm">
          Previous
        </a>
      ) : (
        <span className="admin-btn admin-btn-secondary admin-btn-sm" style={{ opacity: 0.4, pointerEvents: "none" }}>
          Previous
        </span>
      )}
      <span style={{ color: "#888780" }}>
        Page {page} of {totalPages}
      </span>
      {page < totalPages ? (
        <a href={buildHref(basePath, page + 1, extraParams)} className="admin-btn admin-btn-secondary admin-btn-sm">
          Next
        </a>
      ) : (
        <span className="admin-btn admin-btn-secondary admin-btn-sm" style={{ opacity: 0.4, pointerEvents: "none" }}>
          Next
        </span>
      )}
    </div>
  );
}
