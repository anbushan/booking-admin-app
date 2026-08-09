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
      {page > 1 && (
        <a href={buildHref(basePath, page - 1, extraParams)} style={{ color: "#0C447C" }}>
          Previous
        </a>
      )}
      <span style={{ color: "#888780" }}>
        Page {page} of {totalPages}
      </span>
      {page < totalPages && (
        <a href={buildHref(basePath, page + 1, extraParams)} style={{ color: "#0C447C" }}>
          Next
        </a>
      )}
    </div>
  );
}
