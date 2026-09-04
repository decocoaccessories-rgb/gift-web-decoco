import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { normalizeCode, DISCOUNT_CODE_REGEX } from "@/lib/discounts";

const patchSchema = z.object({
  code: z.string().trim().min(3).max(32).optional(),
  description: z.string().max(200).nullable().optional(),
  discount_type: z.enum(["fixed", "percent"]).optional(),
  discount_value: z.number().int().min(0).optional(),
  max_discount_amount: z.number().int().min(0).nullable().optional(),
  min_order_amount: z.number().int().min(0).optional(),
  starts_at: z.string().datetime({ offset: true }).nullable().optional(),
  expires_at: z.string().datetime({ offset: true }).nullable().optional(),
  usage_limit: z.number().int().min(0).nullable().optional(),
  per_customer_limit: z.number().int().min(0).nullable().optional(),
  is_active: z.boolean().optional(),
});

async function requireAuth() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await requireAuth())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dữ liệu không hợp lệ" }, { status: 422 });
  }

  const patch: Record<string, unknown> = { ...parsed.data, updated_at: new Date().toISOString() };
  if (parsed.data.code !== undefined) {
    const code = normalizeCode(parsed.data.code);
    if (!DISCOUNT_CODE_REGEX.test(code)) {
      return NextResponse.json({ error: "Mã không hợp lệ" }, { status: 422 });
    }
    patch.code = code;
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("discount_codes")
    .update(patch)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "Mã này đã tồn tại" }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await requireAuth())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const admin = createAdminClient();
  const { error } = await admin.from("discount_codes").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
