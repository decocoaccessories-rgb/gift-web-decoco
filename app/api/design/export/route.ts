import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

const ALLOWED_MIME = ["image/png", "image/jpeg"] as const;
const MAX_BYTES = 20 * 1024 * 1024;

async function readImage(
  request: NextRequest,
): Promise<{ buffer: Buffer; mimeType: string } | { error: string; status: number }> {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.startsWith("multipart/form-data")) {
    const formData = await request.formData().catch(() => null);
    const file = formData?.get("file");
    if (!(file instanceof Blob)) {
      return { error: "Missing file", status: 400 };
    }
    const mimeType = file.type;
    if (!ALLOWED_MIME.includes(mimeType as (typeof ALLOWED_MIME)[number])) {
      return { error: "Invalid image type", status: 400 };
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    if (buffer.length > MAX_BYTES) {
      return { error: "Image too large", status: 413 };
    }
    return { buffer, mimeType };
  }

  // Backwards-compat: JSON dataURL payload.
  const body = await request.json().catch(() => null);
  if (!body?.dataUrl) {
    return { error: "Missing dataUrl", status: 400 };
  }
  const match = (body.dataUrl as string).match(/^data:([^;]+);base64,(.+)$/);
  if (!match) {
    return { error: "Invalid image data", status: 400 };
  }
  const mimeType = match[1];
  if (!ALLOWED_MIME.includes(mimeType as (typeof ALLOWED_MIME)[number])) {
    return { error: "Invalid image data", status: 400 };
  }
  const buffer = Buffer.from(match[2], "base64");
  if (buffer.length > MAX_BYTES) {
    return { error: "Image too large", status: 413 };
  }
  return { buffer, mimeType };
}

export async function POST(request: NextRequest) {
  const parsed = await readImage(request);
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  }

  const supabase = createAdminClient();
  const ext = parsed.mimeType === "image/png" ? "png" : "jpg";
  const path = `orders/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("designs")
    .upload(path, parsed.buffer, {
      contentType: parsed.mimeType,
      upsert: false,
    });

  if (uploadError) {
    console.error("Storage upload error:", uploadError);
    return NextResponse.json(
      { error: "Upload failed", detail: uploadError.message },
      { status: 500 },
    );
  }

  const { data: urlData } = supabase.storage.from("designs").getPublicUrl(path);
  return NextResponse.json({ url: urlData.publicUrl }, { status: 200 });
}
