import { redirect } from "next/navigation";
import { getSession } from "../lib/session";

// There was no route at all for the bare base URL before this — visiting
// "/" hit Next's default 404 instead of going anywhere useful. Send a
// signed-in admin straight to the dashboard, everyone else to login.
export default function RootPage() {
  redirect(getSession() ? "/dashboard" : "/login");
}
