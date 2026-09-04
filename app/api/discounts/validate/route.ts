import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/server";
import { normalizeCode, isValidCodeFormat, discountReasonMessage } from "@/lib/discounts";

// Rate limit: 10 validate/phút/IP (chống dò mã).
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (entry.count >= 10) return false;
  entry.count++;
  return true;
}

const bodySchema = z.object({
  code: z.string().min(1).max(40),
  order_amount: z.number().int().positive(),
});

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { valid: false, message: "Bạn thử quá nhiều lần, vui lòng đợi một chút." },
      { status: 429 }
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { valid: false, message: "Dữ liệu không hợp lệ." },
      { status: 400 }
    );
  }

  const code = normalizeCode(parsed.data.code);
  if (!isValidCodeFormat(code)) {
    return NextResponse.json({ valid: false, message: discountReasonMessage("not_found") });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("validate_discount_code", {
    p_code: code,
    p_order_amount: parsed.data.order_amount,
    p_customer_phone: null,
  });

  if (error) {
    console.error("[discounts/validate] rpc error:", error);
    return NextResponse.json(
      { valid: false, message: "Không kiểm tra được mã, vui lòng thử lại." },
      { status: 500 }
    );
  }

  const result = data as {
    valid: boolean;
    reason: string;
    discount_amount: number;
    final_amount: number;
  };

  if (!result.valid) {
    return NextResponse.json({
      valid: false,
      message: discountReasonMessage(result.reason),
    });
  }

  return NextResponse.json({
    valid: true,
    code,
    discount_amount: result.discount_amount,
    final_amount: result.final_amount,
    message: `Đã áp mã ${code} — giảm ${result.discount_amount.toLocaleString("vi-VN")} đ`,
  });
}
