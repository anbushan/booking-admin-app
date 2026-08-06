import AdminShell from "../../components/AdminShell";
import { SkeletonTable } from "../../components/Skeleton";

export default function Loading() {
  return (
    <AdminShell activeHref="/payments">
      <div style={{ padding: 24, fontFamily: "sans-serif" }}>
        <h1 style={{ fontSize: 20, fontWeight: 500 }}>Payment history</h1>
        <SkeletonTable />
      </div>
    </AdminShell>
  );
}
