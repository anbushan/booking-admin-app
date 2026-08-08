import { NextRequest, NextResponse } from "next/server";
import { clearSession } from "../../../lib/session";

// The base URL must come from the actual incoming request, not a
// hardcoded origin — a fixed "localhost:3000" only ever happened to
// match by coincidence (and admin doesn't even run on 3000; it's 3001
// in dev), so in practice this sent every "Sign out" click off to
// whatever unrelated thing happened to be listening on that port
// instead of back to /login.
export async function POST(request: NextRequest) {
  clearSession();
  return NextResponse.redirect(new URL("/login", request.url));
}
