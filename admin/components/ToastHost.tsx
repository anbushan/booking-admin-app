"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { CheckCircle2, XCircle } from "lucide-react";

// Mounted once in AdminShell — reads the `toast`/`toastType` params a
// server action's redirectWithToast() leaves behind, shows it, then
// strips those two params from the URL (via router.replace, no scroll)
// so refreshing the page doesn't re-show the same toast.
export function ToastHost() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [toast, setToast] = useState<{ message: string; type: string } | null>(null);

  useEffect(() => {
    const message = searchParams.get("toast");
    if (!message) return;
    const type = searchParams.get("toastType") || "success";
    setToast({ message, type });

    const params = new URLSearchParams(searchParams.toString());
    params.delete("toast");
    params.delete("toastType");
    router.replace(`${pathname}${params.toString() ? `?${params.toString()}` : ""}`, { scroll: false });

    const timer = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  if (!toast) return null;
  const isError = toast.type === "error";

  return (
    <div className={`admin-toast ${isError ? "admin-toast-error" : "admin-toast-success"}`}>
      {isError ? <XCircle size={16} /> : <CheckCircle2 size={16} />}
      <span>{toast.message}</span>
    </div>
  );
}
