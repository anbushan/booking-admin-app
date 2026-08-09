// A plain GET <form> — matches this app's existing convention (see
// reports/daily's date-range filter, which already worked this way)
// rather than introducing a "use client" component just for this.
// Submitting re-navigates to the same path with new query params,
// which the page's own server component reads via `searchParams` and
// feeds straight into the Prisma query — no client JS needed at all,
// and it degrades to a normal HTML form if JS is ever unavailable.
//
// Submitting always drops any existing `page` param (it's not a field
// in this form), which is exactly right — changing what you're
// searching/filtering for should land you back on page 1, not
// wherever you happened to be paginated to before.
type FilterOption = { value: string; label: string };
type Filter = { name: string; label: string; options: FilterOption[]; value?: string };
type SortOption = { value: string; label: string };

export function SearchFilterBar({
  basePath,
  q,
  searchPlaceholder = "Search...",
  filters = [],
  sortOptions,
  sortValue,
}: {
  basePath: string;
  q?: string;
  searchPlaceholder?: string;
  filters?: Filter[];
  sortOptions?: SortOption[];
  sortValue?: string;
}) {
  const hasActiveFilter = !!q || filters.some((f) => f.value);

  return (
    <form
      method="get"
      action={basePath}
      style={{ display: "flex", gap: 8, marginTop: 16, marginBottom: 4, flexWrap: "wrap", alignItems: "center" }}
    >
      <input
        type="text"
        name="q"
        placeholder={searchPlaceholder}
        defaultValue={q}
        className="admin-input"
        style={{ flex: "1 1 200px", minWidth: 160 }}
      />
      {filters.map((f) => (
        <select key={f.name} name={f.name} defaultValue={f.value || ""} className="admin-select">
          <option value="">{f.label}</option>
          {f.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ))}
      {sortOptions && (
        <select name="sort" defaultValue={sortValue || sortOptions[0]?.value} className="admin-select">
          {sortOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )}
      <button type="submit" className="admin-btn admin-btn-primary">
        Apply
      </button>
      {hasActiveFilter && (
        <a href={basePath} style={{ fontSize: 13, color: "#5F5E5A" }}>
          Clear
        </a>
      )}
    </form>
  );
}
