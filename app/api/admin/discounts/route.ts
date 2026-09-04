import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { normalizeCode, DISCOUNT_CODE_REGEX } from "@/lib/discounts";

const baseSchema = z.object({
  code: z.string().trim().min(3).max(32),
  description: z.string().max(200).nullable().optional(),
  discount_type: z.enum(["fixed", "percent"]),
  discount_value: z.number().int().min(0),
  max_discount_amount: z.number().int().min(0).nullable().optional(),
  min_order_amount: z.number().int().min(0).default(0),
  starts_at: z.string().datetime({ offset: true }).nullable().optional(),
  expires_at: z.string().datetime({ offset: true }).nullable().optional(),
  usage_limit: z.number().int().min(0).nullable().optional(),
  per_customer_limit: z.number().int().min(0).nullable().optional(),
  is_active: z.boolean().default(true),
});

const createSchema = baseSchema.refine(
  (d) => d.discount_type !== "percent" || (d.discount_value >= 1 && d.discount_value <= 100),
  { message: "Phần trăm giảm phải trong khoảng 1–100", path: ["discount_value"] }
);

async function requireAuth() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function GET() {
  if (!(await requireAuth())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("discount_codes")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(request: NextRequest) {
  if (!(await requireAuth())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dữ liệu không hợp lệ", details: parsed.error.flatten() },
      { status: 422 }
    );
  }

  const code = normalizeCode(parsed.data.code);
  if (!DISCOUNT_CODE_REGEX.test(code)) {
    return NextResponse.json(
      { error: "Mã chỉ gồm chữ, số, gạch (3–32 ký tự)" },
      { status: 422 }
    );
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("discount_codes")
    .insert({
      ...parsed.data,
      code,
      description: parsed.data.description ?? null,
      max_discount_amount:
        parsed.data.discount_type === "percent"
          ? parsed.data.max_discount_amount ?? null
          : null,
      starts_at: parsed.data.starts_at ?? null,
      expires_at: parsed.data.expires_at ?? null,
      usage_limit: parsed.data.usage_limit ?? null,
      per_customer_limit: parsed.data.per_customer_limit ?? null,
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "Mã này đã tồn tại" }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data, { status: 201 });
}
