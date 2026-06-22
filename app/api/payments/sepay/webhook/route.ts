import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import {
  verifySepayWebhook,
  extractOrderRef,
  type SepayWebhookPayload,
} from "@/lib/vietqr";
import { sendCustomerOrderEmail } from "@/lib/email";
import type { Order, Product, ProductVariant } from "@/lib/supabase/types";

type MatchStatus =
  | "matched"
  | "unmatched"
  | "amount_mismatch"
  | "duplicate"
  | "unverified";

// SePay coi HTTP 200 + { success: true } là đã nhận. Mọi nhánh hợp lệ trả 200
// để SePay không retry liên tục; chỉ webhook giả (sai chữ ký) bị 401.
const ok = () => NextResponse.json({ success: true });

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");

  // 1. Verify nguồn gốc — webhook giả bị từ chối, không xử lý.
  if (!verifySepayWebhook(authHeader)) {
    console.warn("[SePay webhook] rejected: invalid signature");
    return NextResponse.json({ success: false, message: "unauthorized" }, { status: 401 });
  }

  const payload = (await request.json().catch(() => null)) as SepayWebhookPayload | null;
  if (!payload) {
    return NextResponse.json({ success: false, message: "invalid json" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const providerTxId =
    payload.id !== undefined && payload.id !== null ? String(payload.id) : null;

  // Helper ghi audit log (cũng là idempotency store).
  async function logEvent(matchStatus: MatchStatus, matchedOrderId: string | null) {
    try {
      await supabase.from("payment_webhook_logs").insert({
        provider: "sepay",
        provider_transaction_id: providerTxId,
        raw_payload: payload as unknown as Record<string, unknown>,
        matched_order_id: matchedOrderId,
        match_status: matchStatus,
      });
    } catch (logErr) {
      // Unique violation = webhook trùng (đã ghi trước đó) → coi là duplicate, an toàn bỏ qua.
      console.error("[SePay webhook] log insert failed (likely duplicate):", logErr);
    }
  }

  // 2. Idempotency: giao dịch đã xử lý trước đó → trả 200 ngay.
  if (providerTxId) {
    const { data: existing } = await supabase
      .from("payment_webhook_logs")
      .select("id")
      .eq("provider", "sepay")
      .eq("provider_transaction_id", providerTxId)
      .limit(1)
      .maybeSingle();
    if (existing) {
      console.log(`[SePay webhook] duplicate tx ${providerTxId}, skipping`);
      return ok();
    }
  }

  // 3. Chỉ xử lý tiền VÀO.
  if (payload.transferType && payload.transferType !== "in") {
    await logEvent("unmatched", null);
    return ok();
  }

  // 4. Trích mã đơn từ content/code — không "đoán" theo số tiền.
  const ref = extractOrderRef(payload.code) ?? extractOrderRef(payload.content);
  if (!ref) {
    console.warn("[SePay webhook] no order ref in content:", payload.content);
    await logEvent("unmatched", null);
    return ok();
  }

  // 5. Tìm đơn vietqr theo nội dung đã chuẩn hoá.
  const { data: order } = await supabase
    .from("orders")
    .select("id, order_number, product_id, price_at_order, payment_status, payment_method, variant_name, customer_email, customer_name, customer_phone, province, address, note, created_at")
    .eq("vietqr_content", ref)
    .eq("payment_method", "vietqr")
    .maybeSingle();

  if (!order) {
    console.warn(`[SePay webhook] no matching order for ref ${ref}`);
    await logEvent("unmatched", null);
    return ok();
  }

  // 6. So khớp số tiền (SePay trả VND nguyên, không nhân 100).
  const received = Number(payload.transferAmount);
  if (!Number.isFinite(received) || received !== order.price_at_order) {
    console.warn(
      `[SePay webhook] amount mismatch order ${order.order_number}: expected ${order.price_at_order}, got ${payload.transferAmount}`
    );
    await logEvent("amount_mismatch", order.id);
    return ok();
  }

  // 7. Đã thanh toán/huỷ trước đó (vd VNPAY thắng race) → không override.
  if (order.payment_status !== "pending") {
    await logEvent("duplicate", order.id);
    return ok();
  }

  // 8. Đánh dấu PAID — có điều kiện payment_status='pending' để atomic chống double.
  const { data: updated } = await supabase
    .from("orders")
    .update({
      payment_status: "paid",
      vnp_transaction_no: providerTxId,
      paid_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", order.id)
    .eq("payment_status", "pending")
    .select("id")
    .maybeSingle();

  if (!updated) {
    // Một webhook/luồng khác vừa xử lý xong → không trừ kho/gửi mail lần 2.
    await logEvent("duplicate", order.id);
    return ok();
  }

  // 9. Trừ tồn kho (mirror VNPAY IPN).
  if (order.product_id) {
    const { data: rawProduct } = await supabase
      .from("products")
      .select("id, stock, variants")
      .eq("id", order.product_id)
      .single();

    const product = rawProduct as Pick<Product, "id" | "stock" | "variants"> | null;
    if (product) {
      const variants = (product.variants ?? []) as ProductVariant[];
      const matchingVariant = order.variant_name
        ? variants.find((v) => v.name === order.variant_name) ?? null
        : null;
      const useVariantStock =
        matchingVariant != null && typeof matchingVariant.stock === "number";

      if (useVariantStock) {
        const { error: rpcError } = await supabase.rpc("decrement_variant_stock", {
          p_product_id: order.product_id,
          p_variant_id: matchingVariant!.id,
        });
        if (rpcError) {
          console.error("[SePay webhook] variant stock decrement failed:", rpcError);
        }
      } else {
        await supabase
          .from("products")
          .update({ stock: Math.max(0, product.stock - 1) })
          .eq("id", order.product_id);
      }
    }
  }

  // 10. Email xác nhận thanh toán cho khách (fail-soft).
  if (order.customer_email) {
    await sendCustomerOrderEmail({
      order: { ...(order as unknown as Order), payment_status: "paid" },
      productName: null,
      type: "confirmed",
    });
  }

  await logEvent("matched", order.id);
  console.log(`[SePay webhook] order ${order.order_number} marked paid`);
  return ok();
}
