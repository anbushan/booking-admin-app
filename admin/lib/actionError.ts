// next/navigation's redirect() works by throwing a special error (digest
// starting with "NEXT_REDIRECT") that Next's framework catches higher up
// to actually perform the redirect. Every server action here wraps its
// body in try/catch so a genuine failure (a DB error, a bad constraint,
// a network blip) shows a friendly error toast instead of crashing to
// Next's generic error page — but redirectWithToast() on the *success*
// path also calls redirect() internally, and a naive catch(err) would
// swallow that throw too, turning every successful action into an
// "error" toast. Re-throwing anything that's actually a redirect (via
// this check) is what keeps the two paths from colliding.
export function isRedirectError(err: unknown): boolean {
  return typeof err === "object" && err !== null && "digest" in err && typeof (err as any).digest === "string" && (err as any).digest.startsWith("NEXT_REDIRECT");
}
