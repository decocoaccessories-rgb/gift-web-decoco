import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { uploadStorageImage } from "@/lib/storage/upload";
import {
  FRAME_THUMBNAIL_CONTENT_TYPE,
  createFrameThumbnail,
  toThumbnailPath,
} from "@/lib/images/frame-thumbnail";

export async function POST(request: NextRequest) {
  // Verify admin session
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData().catch(() => null);
  if (!formData) {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  const bucket = (formData.get("bucket") as string) || "site";
  const folder = (formData.get("folder") as string) || "";

  if (!file) {
    return NextResponse.json({ error: "No file" }, { status: 400 });
  }

  const allowedBuckets = ["site", "products", "frames"];
  if (!allowedBuckets.includes(bucket)) {
    return NextResponse.json({ error: "Invalid bucket" }, { status: 400 });
  }

  if (!["image/png", "image/jpeg", "image/webp", "image/gif"].includes(file.type)) {
    return NextResponse.json({ error: "Invalid file type" }, { status: 400 });
  }

  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: "File too large (max 10MB)" }, { status: 413 });
  }

  const ext = file.name.split(".").pop() ?? "jpg";
  const path = folder ? `${folder}/${Date.now()}.${ext}` : `${Date.now()}.${ext}`;

  const arrayBuffer = await file.arrayBuffer();
  let url: string;
  try {
    url = await uploadStorageImage(bucket, path, new Uint8Array(arrayBuffer), file.type, true);
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }

  // Ảnh nền khung được hiển thị ở ~100px trong lưới chọn khung nhưng file gốc
  // nặng vài MB. Sinh thêm bản thumbnail nhỏ để lưới không phải tải ảnh gốc.
  let thumbnailUrl: string | null = null;
  if (bucket === "frames") {
    try {
      const thumbnailPath = toThumbnailPath(path);
      const thumbnail = await createFrameThumbnail(Buffer.from(arrayBuffer));
      thumbnailUrl = await uploadStorageImage(bucket, thumbnailPath, thumbnail, FRAME_THUMBNAIL_CONTENT_TYPE, true);
    } catch (error) {
      // Fail-soft: mất thumbnail chỉ làm lưới nặng hơn, không được chặn upload.
      console.warn("Frame thumbnail generation failed:", error);
    }
  }

  return NextResponse.json({ url, thumbnailUrl }, { status: 200 });
}
