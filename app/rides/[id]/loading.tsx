import AdminShell from "../../../components/AdminShell";
import { SkeletonBlock } from "../../../components/Skeleton";

export default function Loading() {
  return (
    <AdminShell activeHref="/rides">
      <div style={{ padding: 24, fontFamily: "sans-serif" }}>
        <h1 style={{ fontSize: 20, fontWeight: 500 }}>Ride</h1>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 480 }}>
          <SkeletonBlock style={{ height: 20, width: "50%" }} />
          <SkeletonBlock style={{ height: 14, width: "30%" }} />
          <SkeletonBlock style={{ height: 100 }} />
        </div>
      </div>
    </AdminShell>
  );
}
