import { redirect } from "next/navigation";
import { headers } from "next/headers";

// Every mutation (suspend a user, cancel a ride, approve a document...)
// used to just revalidatePath() and silently re-render — nothing ever
// told the admin it actually worked, or that it failed. Server Actions
// can't return a value a plain <form action={fn}> reads directly, so
// this rides on the same query-param pattern the app already used in a
// couple of places (?sent=1, ?error=1): redirect back to wherever the
// action was submitted from (via the request's own Referer header, so
// whatever search/filter/sort/page was active stays intact) with a
// `toast` param added — ToastHost (mounted once in AdminShell) picks
// it up, shows it, and strips it from the URL.
export function redirectWithToast(fallbackPath: string, message: string, type: "success" | "error" = "success") {
  const referer = headers().get("referer");
  let target: URL;
  try {
    target = referer ? new URL(referer) : new URL(fallbackPath, "http://internal");
  } catch {
    target = new URL(fallbackPath, "http://internal");
  }
  target.searchParams.set("toast", message);
  target.searchParams.set("toastType", type);
  redirect(target.pathname + target.search);
}
