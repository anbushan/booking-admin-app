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
        }}
      >
        !
      </div>
      <div style={{ fontSize: 14, color: "#5F5E5A" }}>{message}</div>
      {onRetry && (
        <button
          onClick={onRetry}
          style={{
            marginTop: 12,
            background: "#fff",
            border: "1px solid #E3E1D8",
            borderRadius: 6,
            padding: "8px 16px",
            fontSize: 13,
            color: "#0C447C",
            cursor: "pointer",
          }}
        >
          Try again
        </button>
      )}
    </div>
  );
}
