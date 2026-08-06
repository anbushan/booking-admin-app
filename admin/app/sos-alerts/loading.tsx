import AdminShell from "../../components/AdminShell";
import { SkeletonCardList } from "../../components/Skeleton";

export default function Loading() {
  return (
    <AdminShell activeHref="/sos-alerts">
      <div style={{ padding: 24, fontFamily: "sans-serif" }}>
        <h1 style={{ fontSize: 20, fontWeight: 500 }}>SOS alerts</h1>
        <SkeletonCardList />
      </div>
    </AdminShell>
  );
}
