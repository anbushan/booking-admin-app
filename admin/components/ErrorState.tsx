"use client";

export function ErrorState({
  message = "Something went wrong.",
  onRetry,
}: {
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div style={{ textAlign: "center", padding: "48px 16px" }}>
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          background: "#FCEBEB",
          color: "#A32D2D",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          margin: "0 auto 12px",
          fontWeight: 700,
          boxShadow: "0 4px 10px rgba(163, 45, 45, 0.15)",
        }}
      >
        !
      </div>
      <div style={{ fontSize: 14, color: "#5F5E5A" }}>{message}</div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="admin-btn admin-btn-secondary admin-btn-sm"
          style={{ marginTop: 12 }}
        >
          Try again
        </button>
      )}
    </div>
  );
}
