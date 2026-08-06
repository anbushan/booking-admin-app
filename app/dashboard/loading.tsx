import AdminShell from "../../components/AdminShell";
import { SkeletonCards } from "../../components/Skeleton";

export default function Loading() {
  return (
    <AdminShell activeHref="/dashboard">
      <div style={{ padding: 24, fontFamily: "sans-serif" }}>
        <h1 style={{ fontSize: 20, fontWeight: 500 }}>Dashboard</h1>
        <SkeletonCards />
      </div>
    </AdminShell>
  );
}
