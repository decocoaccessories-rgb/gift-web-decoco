import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { generateOrderNumber } from "@/lib/utils";
import { buildVnpayPaymentUrl } from "@/lib/vnpay";
import {
  isVietqrConfigured,
  normalizeOrderRef,
  buildVietqrImageUrl,
  vietqrExpiresAt,
} from "@/lib/vietqr";
import { sendNewOrderEmail, sendCustomerOrderEmail } from "@/lib/email";
import { normalizeCode, isValidCodeFormat, discountReasonMessage } from "@/lib/discounts";
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
  payment_method: z.enum(["cod", "vnpay", "vietqr"]).default("cod"),
  customer_name: z.string().min(2).max(100),
  customer_phone: z
    .string()
    .regex(/^0\d{9}$/, "Số điện thoại không hợp lệ (10 số, bắt đầu bằng 0)"),
  customer_email: z.string().email().optional().or(z.literal("")),
  recipient_name: z.string().min(2).max(100),
  recipient_phone: z
    .string()
    .regex(/^0\d{9}$/, "Số điện thoại người nhận không hợp lệ (10 số, bắt đầu bằng 0)"),
  discount_code: z.string().trim().min(3).max(40).optional(),
  province: z.string().min(1),
  address: z.string().min(10),
  note: z.string().max(500).optional(),
  // Nguồn marketing first-touch do client gửi lên (localStorage). Tất cả optional.
  attribution: z
    .object({
      utm_source: z.string().max(200),
      utm_medium: z.string().max(200),
      utm_campaign: z.string().max(200),
      utm_term: z.string().max(200),
      utm_content: z.string().max(200),
      referrer: z.string().max(500),
      landing_page: z.string().max(500),
    })
    .partial()
    .optional(),
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

  const isVnpay = data.payment_method === "vnpay";
  const isVietqr = data.payment_method === "vietqr";

  // Mã giảm giá: re-validate ở server, KHÔNG tin số tiền từ client.
  // price_at_order = số tiền khách trả (đã trừ giảm) -> QR/URL/đối soát webhook giữ nguyên.
  let finalPrice = product.price;
  let discountAmount = 0;
  let discountCodeToStore: string | null = null;

  if (data.discount_code) {
    const code = normalizeCode(data.discount_code);
    if (!isValidCodeFormat(code)) {
      return NextResponse.json(
        { error: "Mã giảm giá không hợp lệ", discount_error: discountReasonMessage("not_found") },
        { status: 422 }
      );
    }
    const { data: vRes, error: vErr } = await supabase.rpc("validate_discount_code", {
      p_code: code,
      p_order_amount: product.price,
      p_customer_phone: data.customer_phone,
    });
    if (vErr) {
      console.error("[orders] validate_discount_code error:", vErr);
      return NextResponse.json({ error: "Không kiểm tra được mã giảm giá" }, { status: 500 });
    }
    const v = vRes as { valid: boolean; reason: string; discount_amount: number; final_amount: number };
    if (!v.valid) {
      return NextResponse.json(
        { error: "Mã giảm giá không hợp lệ", discount_error: discountReasonMessage(v.reason) },
        { status: 422 }
      );
    }
    // Cổng online không nhận số tiền quá nhỏ.
    if (data.payment_method !== "cod" && v.final_amount < 1000) {
      return NextResponse.json(
        {
          error: "Mã giảm giá không hợp lệ",
          discount_error: "Số tiền sau giảm quá nhỏ cho thanh toán online, vui lòng chọn COD.",
        },
        { status: 422 }
      );
    }
    finalPrice = v.final_amount;
    discountAmount = v.discount_amount;
    discountCodeToStore = code;
  }

  const orderNumber = generateOrderNumber();
  const txnRef = isVnpay
    ? `${orderNumber}_${Date.now().toString(36)}`.replace(/-/g, "_")
    : null;

  // VietQR: cấu hình env phải sẵn sàng trước khi nhận đơn (giống VNPAY fail nếu thiếu).
  if (isVietqr && !isVietqrConfigured()) {
    return NextResponse.json(
      { error: "Cổng VietQR chưa cấu hình. Vui lòng chọn COD hoặc VNPAY." },
      { status: 503 }
    );
  }

  // VietQR: nội dung chuyển khoản + QR + hạn (đơn vẫn 'pending', không trừ kho lúc tạo).
  const vietqrContent = isVietqr ? normalizeOrderRef(orderNumber) : null;
  const vietqrExpiresAtIso = isVietqr ? vietqrExpiresAt().toISOString() : null;
  let vietqrQrUrl: string | null = null;
  if (isVietqr) {
    try {
      vietqrQrUrl = buildVietqrImageUrl({ amount: finalPrice, content: vietqrContent! });
    } catch (err) {
      console.error("VietQR build QR url failed:", err);
      return NextResponse.json(
        { error: "Cổng VietQR chưa cấu hình. Vui lòng chọn COD hoặc VNPAY." },
        { status: 503 }
      );
    }
  }

  // Chỉ đính kèm các cột vietqr_* khi đơn thực sự là VietQR. Nhờ vậy luồng
  // COD/VNPAY không tham chiếu cột mới — code deploy được an toàn kể cả khi
  // migration 008 chưa được áp dụng (tính năng VietQR vẫn đang gate off).
  const vietqrColumns = isVietqr
    ? {
        vietqr_content: vietqrContent,
        vietqr_qr_url: vietqrQrUrl,
        vietqr_expires_at: vietqrExpiresAtIso,
      }
    : {};

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
      recipient_name: data.recipient_name,
      recipient_phone: data.recipient_phone,
      province: data.province,
      address: data.address,
      note: data.note ?? null,
      price_at_order: finalPrice,
      discount_code: discountCodeToStore,
      discount_amount: discountAmount,
      status: "new",
      payment_method: data.payment_method,
      payment_status: "pending",
      vnp_txn_ref: txnRef,
      utm_source: data.attribution?.utm_source ?? null,
      utm_medium: data.attribution?.utm_medium ?? null,
      utm_campaign: data.attribution?.utm_campaign ?? null,
      utm_term: data.attribution?.utm_term ?? null,
      utm_content: data.attribution?.utm_content ?? null,
      referrer: data.attribution?.referrer ?? null,
      landing_page: data.attribution?.landing_page ?? null,
      ...vietqrColumns,
    })
    .select("id, order_number, customer_name, customer_phone, customer_email, recipient_name, recipient_phone, discount_code, discount_amount, province, address, note, price_at_order, variant_name, design_image_url, payment_method, payment_status, utm_source, utm_medium, utm_campaign, utm_term, utm_content, referrer, landing_page, created_at")
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

  // Fire-and-await customer email notification (placed status) (fail-soft).
  if (order.customer_email) {
    await sendCustomerOrderEmail({
      order: order as unknown as Order,
      productName: product.name,
      type: "placed",
    });
  }

  if (isVnpay) {
    let paymentUrl: string;
    try {
      paymentUrl = buildVnpayPaymentUrl({
        txnRef: txnRef!,
        amount: finalPrice,
        ipAddr: ip === "unknown" ? "127.0.0.1" : ip,
        orderInfo: `Thanh toan don hang ${orderNumber}`,
      });

      // GHI LOG CHIỀU KHỞI TẠO (INITIATE) VÀO DATABASE
      await supabase.from("vnpay_logs").insert({
        txn_ref: txnRef!,
        event_type: "initiate",
        ip_address: ip === "unknown" ? "127.0.0.1" : ip,
        payload: {
          amount: finalPrice,
          orderInfo: `Thanh toan don hang ${orderNumber}`,
        },
        response: {
          paymentUrl,
          orderId: order.id,
          orderNumber: order.order_number
        }
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

  if (isVietqr) {
    // Không trừ kho lúc tạo đơn — trừ khi webhook SePay xác nhận 'paid'.
    return NextResponse.json(
      {
        orderId: order.id,
        orderNumber: order.order_number,
        vietqr: {
          qrUrl: vietqrQrUrl,
          amount: order.price_at_order,
          content: vietqrContent,
          expiresAt: vietqrExpiresAtIso,
        },
      },
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

  // COD: trừ lượt mã giảm giá ngay (fail-soft — mã đã được validate ở trên).
  if (discountCodeToStore) {
    const { error: redeemErr } = await supabase.rpc("redeem_discount_code", {
      p_code: discountCodeToStore,
      p_order_id: order.id,
      p_order_amount: product.price,
      p_customer_phone: data.customer_phone,
    });
    if (redeemErr) {
      console.warn(`[orders] redeem_discount_code failed for ${order.order_number}:`, redeemErr.message);
    }
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
    .select("id, order_number, customer_name, customer_phone, customer_email, recipient_name, recipient_phone, discount_code, discount_amount, province, address, note, status, price_at_order, design_image_url, variant_name, payment_method, payment_status, paid_at, utm_source, utm_medium, utm_campaign, utm_term, utm_content, referrer, landing_page, created_at, product_id", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (status && status !== "all") query = query.eq("status", status);
  if (search) {
    query = query.or(`customer_name.ilike.%${search}%,customer_phone.ilike.%${search}%,recipient_name.ilike.%${search}%,recipient_phone.ilike.%${search}%,order_number.ilike.%${search}%`);
  }

  const { data, error, count } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ orders: data ?? [], total: count ?? 0, page, limit });
}
