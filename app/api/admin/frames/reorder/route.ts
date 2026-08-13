import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient, createAdminClient } from "@/lib/supabase/server";

const reorderSchema = z.object({
  items: z
    .array(
      z.object({
        id: z.string().uuid(),
        sort_order: z.number().int(),
      })
    )
    .min(1),
});

export async function PUT(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = reorderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid data", details: parsed.error.flatten() }, { status: 422 });
  }

  const admin = createAdminClient();
  const results = await Promise.all(
    parsed.data.items.map((item) =>
      admin.from("frames").update({ sort_order: item.sort_order }).eq("id", item.id)
    )
  );

  const failed = results.find((r) => r.error);
  if (failed?.error) {
    return NextResponse.json({ error: failed.error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
