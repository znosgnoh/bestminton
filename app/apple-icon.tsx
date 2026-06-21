import { racketIconSvg } from "@/lib/racketIconSvg";

export const size = { width: 180, height: 180 };
export const contentType = "image/svg+xml";

export default function AppleIcon() {
  return new Response(racketIconSvg(180, 40), {
    headers: { "Content-Type": "image/svg+xml" },
  });
}
