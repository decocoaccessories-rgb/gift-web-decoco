import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import {
  verifyVnpayIpn,
  IpnSuccess,
  IpnOrderNotFound,
  InpOrderAlreadyConfirmed,
  IpnInvalidAmount,
  IpnFailChecksum,
  IpnUnknownError,
  type ReturnQueryFromVNPay,
} from "@/lib/vnpay";
import type { Product, ProductVariant } from "@/lib/supabase/types";

// Danh sách IP chính thức của VNPAY call IPN
const VNPAY_WHITELIST_IPS = [
  // Môi trường Sandbox
  "113.160.92.202",
  "203.205.17.226",
  "103.220.84.4",
  // Môi trường Production
  "113.52.45.78",
  "116.97.245.130",
  "42.118.107.252",
  "113.20.97.250",
  "203.171.19.146",
  "103.220.87.4",
  "103.220.86.4",
  "103.220.86.10",
  "103.220.87.10",
  "103.220.86.139",
  "103.220.87.139"
];

export async function GET(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const params = Object.fromEntries(request.nextUrl.searchParams.entries());
  
  const supabase = createAdminClient();
  const txnRef = params.vnp_TxnRef as string | undefined;

  // Cảnh báo nếu IP gọi webhook không nằm trong whitelist của VNPAY
  const isWhitelisted = VNPAY_WHITELIST_IPS.includes(ip);
  if (!isWhitelisted && ip !== "unknown" && ip !== "127.0.0.1") {
    console.warn(`[VNPAY IPN Warning] IPN called from non-whitelisted IP: ${ip}`);
  }

  let result;
  let responsePayload = IpnUnknownError;

  // Hàm helper ghi log nhanh
  async function logIpnEvent(ref: string, clientIp: string, reqPayload: any, respPayload: any) {
    try {
      await supabase.from("vnpay_logs").insert({
        txn_ref: ref || "unknown",
        event_type: "ipn_received",
        ip_address: clientIp,
        payload: { ...reqPayload, is_ip_whitelisted: isWhitelisted },
        response: respPayload
      });
    } catch (logErr) {
      console.error("Failed to write VNPAY IPN log to database:", logErr);
    }
  }

  try {
    result = verifyVnpayIpn(params as unknown as ReturnQueryFromVNPay);
  } catch (err) {
    console.error("VNPAY IPN verify error:", err);
    responsePayload = IpnUnknownError;
    await logIpnEvent(txnRef || "unknown", ip, params, responsePayload);
    return NextResponse.json(responsePayload);
  }

  if (!result.isVerified) {
    responsePayload = IpnFailChecksum;
    await logIpnEvent(txnRef || "unknown", ip, params, responsePayload);
    return NextResponse.json(responsePayload);
  }

  if (!txnRef) {
    responsePayload = IpnOrderNotFound;
    await logIpnEvent("unknown", ip, params, responsePayload);
    return NextResponse.json(responsePayload);
  }

  const { data: order } = await supabase
    .from("orders")
    .select("id, product_id, price_at_order, payment_status, variant_name")
    .eq("vnp_txn_ref", txnRef)
    .single();

  if (!order) {
    responsePayload = IpnOrderNotFound;
    await logIpnEvent(txnRef, ip, params, responsePayload);
    return NextResponse.json(responsePayload);
  }

  if (order.payment_status === "paid") {
    responsePayload = InpOrderAlreadyConfirmed;
    await logIpnEvent(txnRef, ip, params, responsePayload);
    return NextResponse.json(responsePayload);
  }

  // Note: The vnpay library automatically divides the received vnp_Amount by 100 to return the original amount.
  // We compare the received amount directly against our stored price_at_order.
  const expectedAmount = order.price_at_order;
  const receivedAmount = Number(result.vnp_Amount);
  if (!Number.isFinite(receivedAmount) || receivedAmount !== expectedAmount) {
    responsePayload = IpnInvalidAmount;
    await logIpnEvent(txnRef, ip, params, responsePayload);
    return NextResponse.json(responsePayload);
  }

  if (!result.isSuccess) {
    await supabase
      .from("orders")
      .update({
        payment_status: "failed",
        vnp_transaction_no: result.vnp_TransactionNo
          ? String(result.vnp_TransactionNo)
          : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", order.id);

    responsePayload = IpnSuccess;
    await logIpnEvent(txnRef, ip, params, responsePayload);
    return NextResponse.json(responsePayload);
  }

  // Cập nhật trạng thái ĐÃ THANH TOÁN
  await supabase
    .from("orders")
    .update({
      payment_status: "paid",
      vnp_transaction_no: result.vnp_TransactionNo
        ? String(result.vnp_TransactionNo)
        : null,
      paid_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", order.id);

  // Trừ tồn kho khi đã thanh toán thành công
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
        const { error: rpcError } = await supabase.rpc(
          "decrement_variant_stock",
          {
            p_product_id: order.product_id,
            p_variant_id: matchingVariant!.id,
          }
        );
        if (rpcError) {
          console.error("VNPAY IPN: variant stock decrement failed:", rpcError);
        }
      } else {
        await supabase
          .from("products")
          .update({ stock: Math.max(0, product.stock - 1) })
          .eq("id", order.product_id);
      }
    }
  }

  responsePayload = IpnSuccess;
  await logIpnEvent(txnRef, ip, params, responsePayload);
  return NextResponse.json(responsePayload);
}
