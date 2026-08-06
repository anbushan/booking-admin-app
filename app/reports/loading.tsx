import AdminShell from "../../components/AdminShell";
import { SkeletonCards } from "../../components/Skeleton";

export default function Loading() {
  return (
    <AdminShell activeHref="/reports">
      <div style={{ padding: 24, fontFamily: "sans-serif" }}>
        <h1 style={{ fontSize: 20, fontWeight: 500 }}>Reports</h1>
        <SkeletonCards />
      </div>
    </AdminShell>
  );
}
