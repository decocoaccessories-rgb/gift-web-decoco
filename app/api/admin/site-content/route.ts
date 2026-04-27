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
    await admin
      .from("site_content")
      .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: "key" });
  }

  return NextResponse.json({ success: true });
}
