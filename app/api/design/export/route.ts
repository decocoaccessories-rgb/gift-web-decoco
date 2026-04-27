import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

function dataURLtoBuffer(dataUrl: string): { buffer: Buffer; mimeType: string } | null {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  const mimeType = match[1];
  const base64 = match[2];
  const buffer = Buffer.from(base64, "base64");
  return { buffer, mimeType };
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body?.dataUrl) {
    return NextResponse.json({ error: "Missing dataUrl" }, { status: 400 });
  }

  const parsed = dataURLtoBuffer(body.dataUrl as string);
  if (!parsed || !["image/png", "image/jpeg"].includes(parsed.mimeType)) {
    return NextResponse.json({ error: "Invalid image data" }, { status: 400 });
  }

  // 20MB limit (2x canvas = 800x800x2 multiplier ≈ ~5MB typical)
  if (parsed.buffer.length > 20 * 1024 * 1024) {
    return NextResponse.json({ error: "Image too large" }, { status: 413 });
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
    // Return without URL — order can still be placed without design image
    return NextResponse.json({ url: null, error: "Upload failed" }, { status: 200 });
  }

  const { data: urlData } = supabase.storage.from("designs").getPublicUrl(path);
  return NextResponse.json({ url: urlData.publicUrl }, { status: 200 });
}
