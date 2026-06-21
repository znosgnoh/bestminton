import { put } from "@vercel/blob";
import { NextRequest, NextResponse } from "next/server";

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png"]);
const MAX_BYTES = 2 * 1024 * 1024;

export async function POST(request: NextRequest) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json(
      { error: "Avatar upload is not configured (missing BLOB_READ_WRITE_TOKEN)." },
      { status: 503 }
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data." }, { status: 400 });
  }

  const entry = formData.get("file");
  if (!(entry instanceof File) || entry.size === 0) {
    return NextResponse.json({ error: "A file is required." }, { status: 400 });
  }

  if (!ALLOWED_TYPES.has(entry.type)) {
    return NextResponse.json(
      { error: "Only JPG and PNG images are allowed." },
      { status: 400 }
    );
  }

  if (entry.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "Image must be 2MB or smaller." },
      { status: 400 }
    );
  }

  const ext = entry.type === "image/png" ? "png" : "jpg";
  const pathname = `avatars/${crypto.randomUUID()}.${ext}`;

  try {
    const blob = await put(pathname, entry, { access: "public" });
    return NextResponse.json({ url: blob.url });
  } catch (err) {
    console.error("Avatar upload failed:", err);
    return NextResponse.json({ error: "Upload failed." }, { status: 500 });
  }
}
