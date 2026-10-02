import { redirect } from "next/navigation";

/** Legacy PWA path — canonical icons live under /brand. */
export function GET() {
  redirect("/brand/app-icon-192.png");
}
