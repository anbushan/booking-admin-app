import { ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";

// A clickable column header — click toggles asc → desc → asc for that
// field, replacing the earlier named-preset "sort" dropdown on the
// pages that have real table columns to sort by directly (a dropdown
// saying "Highest rated" is a layer of indirection when the Rating
// column is sitting right there to click).
export function SortableTh({
  label,
  field,
  currentSortBy,
  currentSortDir,
  basePath,
  extraParams = {},
}: {
  label: string;
  field: string;
  currentSortBy?: string;
  currentSortDir?: string;
  basePath: string;
  extraParams?: Record<string, string | undefined>;
}) {
  const isActive = currentSortBy === field;
  const nextDir = isActive && currentSortDir === "asc" ? "desc" : "asc";

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(extraParams)) {
    if (value) params.set(key, value);
  }
  params.set("sortBy", field);
  params.set("sortDir", nextDir);

  return (
    <th style={{ padding: "8px 4px", textAlign: "left" }}>
      <a
        href={`${basePath}?${params.toString()}`}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          color: isActive ? "#0C447C" : "inherit",
          textDecoration: "none",
          fontWeight: isActive ? 700 : 400,
        }}
      >
        {label}
        {isActive ? (
          currentSortDir === "asc" ? <ArrowUp size={12} /> : <ArrowDown size={12} />
        ) : (
          <ArrowUpDown size={11} style={{ opacity: 0.35 }} />
        )}
      </a>
    </th>
  );
}
