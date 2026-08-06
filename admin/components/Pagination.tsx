export default function Pagination({
  page,
  totalPages,
  basePath,
}: {
  page: number;
  totalPages: number;
  basePath: string;
}) {
  if (totalPages <= 1) return null;
  return (
    <div style={{ display: "flex", gap: 8, marginTop: 16, fontSize: 13, alignItems: "center" }}>
      {page > 1 && (
        <a href={`${basePath}?page=${page - 1}`} style={{ color: "#0C447C" }}>
          Previous
        </a>
      )}
      <span style={{ color: "#888780" }}>
        Page {page} of {totalPages}
      </span>
      {page < totalPages && (
        <a href={`${basePath}?page=${page + 1}`} style={{ color: "#0C447C" }}>
          Next
        </a>
      )}
    </div>
  );
}
