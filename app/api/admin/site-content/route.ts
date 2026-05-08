import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient, createAdminClient } from "@/lib/supabase/server";

const patchSchema = z.object({
  updates: z.array(
    z.object({
      key: z.string().min(1),
      value: z.string(),
    })
  ).min(1),
});

/* Metadata for known image keys so upsert always writes the correct section */
const KNOWN_KEY_METADATA: Record<string, { section: string; type: string; label: string }> = {
  hero_image:        { section: "hero",  type: "image", label: "Ảnh Hero (Desktop)" },
  hero_image_mobile: { section: "hero",  type: "image", label: "Ảnh Hero (Mobile)" },
  story_image:       { section: "story", type: "image", label: "Ảnh Story (Giới thiệu)" },
};

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("site_content")
    .select("*")
    .order("section")
    .order("key");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid data" }, { status: 422 });
  }

  const admin = createAdminClient();
  for (const { key, value } of parsed.data.updates) {
    const meta = KNOWN_KEY_METADATA[key];
    await admin
      .from("site_content")
      .upsert(
        {
          key,
          value,
          updated_at: new Date().toISOString(),
          ...(meta && { section: meta.section, type: meta.type, label: meta.label }),
        },
        { onConflict: "key" }
      );
  }

  return NextResponse.json({ success: true });
}
