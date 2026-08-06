import AdminShell from "../../components/AdminShell";
import { SkeletonCardList } from "../../components/Skeleton";

export default function Loading() {
  return (
    <AdminShell activeHref="/refunds">
      <div style={{ padding: 24, fontFamily: "sans-serif" }}>
        <h1 style={{ fontSize: 20, fontWeight: 500 }}>Refunds</h1>
        <SkeletonCardList />
      </div>
    </AdminShell>
  );
}
