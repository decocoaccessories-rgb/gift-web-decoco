import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { generateOrderNumber } from "@/lib/utils";
import { buildVnpayPaymentUrl } from "@/lib/vnpay";
import { sendNewOrderEmail } from "@/lib/email";
import type { Order, Product, ProductVariant } from "@/lib/supabase/types";

// Simple in-memory rate limiter: 5 POST requests per IP per minute
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (entry.count >= 5) return false;
  entry.count++;
  return true;
}

const orderSchema = z.object({
  product_id: z.string().uuid(),
  frame_id: z.string().uuid().optional(),
  design_image_url: z.string().url().optional(),
  design_data: z.record(z.string(), z.unknown()).optional(),
  variant_name: z.string().max(100).nullable().optional(),
  payment_method: z.enum(["cod", "vnpay"]).default("cod"),
  customer_name: z.string().min(2).max(100),
  customer_phone: z
    .string()
    .regex(/^0\d{9}$/, "Số điện thoại không hợp lệ (10 số, bắt đầu bằng 0)"),
  customer_email: z.string().email().optional().or(z.literal("")),
  province: z.string().min(1),
  address: z.string().min(10),
  note: z.string().max(500).optional(),
});

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!checkRateLimit(ip)) {
    return NextResponse.json({ error: "Quá nhiều yêu cầu, vui lòng thử lại sau" }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = orderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dữ liệu không hợp lệ", details: parsed.error.flatten() },
      { status: 422 }
    );
  }

  const data = parsed.data;
  const supabase = createAdminClient();

  const { data: rawProduct, error: productError } = await supabase
    .from("products")
    .select("id, price, stock, is_visible, name, variants")
    .eq("id", data.product_id)
    .single();

  const product = rawProduct as Pick<Product, "id" | "price" | "stock" | "is_visible" | "name" | "variants"> | null;

  if (productError || !product) {
    return NextResponse.json({ error: "Sản phẩm không tồn tại" }, { status: 404 });
  }
  if (!product.is_visible) {
    return NextResponse.json({ error: "Sản phẩm không còn kinh doanh" }, { status: 410 });
  }

  const variants = (product.variants ?? []) as ProductVariant[];
  const productManagesByVariant = variants.some((v) => typeof v.stock === "number");
  const matchingVariant = data.variant_name
    ? variants.find((v) => v.name === data.variant_name) ?? null
    : null;
  const useVariantStock = matchingVariant != null && typeof matchingVariant.stock === "number";

  if (productManagesByVariant && !useVariantStock) {
    return NextResponse.json(
      { error: "Vui lòng chọn phân loại trước khi đặt hàng" },
      { status: 400 }
    );
  }

  if (useVariantStock) {
    if ((matchingVariant!.stock ?? 0) <= 0) {
      return NextResponse.json({ error: "Phân loại đã hết hàng" }, { status: 409 });
    }
  } else if (product.stock <= 0) {
    return NextResponse.json({ error: "Sản phẩm đã hết hàng" }, { status: 409 });
  }

  const orderNumber = generateOrderNumber();
  const isVnpay = data.payment_method === "vnpay";
  const txnRef = isVnpay ? `${orderNumber}-${Date.now().toString(36)}` : null;

  const { data: order, error: insertError } = await supabase
    .from("orders")
    .insert({
      order_number: orderNumber,
      product_id: data.product_id,
      frame_id: data.frame_id ?? null,
      design_image_url: data.design_image_url ?? null,
      design_data: (data.design_data as Record<string, unknown>) ?? null,
      variant_name: data.variant_name ?? null,
      customer_name: data.customer_name,
      customer_phone: data.customer_phone,
      customer_email: data.customer_email || null,
      province: data.province,
      address: data.address,
      note: data.note ?? null,
      price_at_order: product.price,
      status: "new",
      payment_method: data.payment_method,
      payment_status: "pending",
      vnp_txn_ref: txnRef,
    })
    .select("id, order_number, customer_name, customer_phone, customer_email, province, address, note, price_at_order, variant_name, design_image_url, payment_method, payment_status, created_at")
    .single();

  if (insertError || !order) {
    console.error("Insert order error:", insertError);
    return NextResponse.json({ error: "Không thể tạo đơn hàng" }, { status: 500 });
  }

  // Fire-and-await email notification (fail-soft).
  await sendNewOrderEmail({
    order: order as unknown as Order,
    product: { name: product.name },
  });

  if (isVnpay) {
    let paymentUrl: string;
    try {
      paymentUrl = buildVnpayPaymentUrl({
        txnRef: txnRef!,
        amount: product.price,
        ipAddr: ip === "unknown" ? "127.0.0.1" : ip,
        orderInfo: `Thanh toan don hang ${orderNumber}`,
      });
    } catch (err) {
      console.error("VNPAY build URL failed:", err);
      await supabase.from("orders").delete().eq("id", order.id);
      return NextResponse.json(
        { error: "Cổng thanh toán chưa cấu hình. Vui lòng chọn COD." },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { orderId: order.id, orderNumber: order.order_number, paymentUrl },
      { status: 201 }
    );
  }

  if (useVariantStock) {
    const { error: rpcError } = await supabase.rpc("decrement_variant_stock", {
      p_product_id: data.product_id,
      p_variant_id: matchingVariant!.id,
    });
    if (rpcError) {
      console.error("Variant stock decrement failed:", rpcError);
    }
  } else {
    await supabase
      .from("products")
      .update({ stock: product.stock - 1 })
      .eq("id", data.product_id);
  }

  return NextResponse.json(
    { orderId: order.id, orderNumber: order.order_number },
    { status: 201 }
  );
}

export async function GET(request: NextRequest) {
  // Admin only
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const search = searchParams.get("search");
  const page = Math.max(1, Number(searchParams.get("page") ?? "1"));
  const limit = 20;
  const offset = (page - 1) * limit;

  const admin = createAdminClient();
  let query = admin
    .from("orders")
    .select("id, order_number, customer_name, customer_phone, customer_email, province, address, note, status, price_at_order, design_image_url, variant_name, payment_method, payment_status, paid_at, created_at, product_id", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (status && status !== "all") query = query.eq("status", status);
  if (search) {
    query = query.or(`customer_name.ilike.%${search}%,customer_phone.ilike.%${search}%,order_number.ilike.%${search}%`);
  }

  const { data, error, count } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ orders: data ?? [], total: count ?? 0, page, limit });
}
