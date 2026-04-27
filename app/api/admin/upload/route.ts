import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/server";

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

  const adminSupabase = createAdminClient();
  const ext = file.name.split(".").pop() ?? "jpg";
  const path = folder ? `${folder}/${Date.now()}.${ext}` : `${Date.now()}.${ext}`;

  const arrayBuffer = await file.arrayBuffer();
  const { error: uploadError } = await adminSupabase.storage
    .from(bucket)
    .upload(path, arrayBuffer, { contentType: file.type, upsert: true });

  if (uploadError) {
    console.error("Upload error:", uploadError);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }

  const { data: urlData } = adminSupabase.storage.from(bucket).getPublicUrl(path);

  return NextResponse.json({ url: urlData.publicUrl }, { status: 200 });
}
