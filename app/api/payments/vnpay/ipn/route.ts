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

export async function GET(request: NextRequest) {
  const params = Object.fromEntries(request.nextUrl.searchParams.entries());

  let result;
  try {
    result = verifyVnpayIpn(params as unknown as ReturnQueryFromVNPay);
  } catch (err) {
    console.error("VNPAY IPN verify error:", err);
    return NextResponse.json(IpnUnknownError);
  }

  if (!result.isVerified) {
    return NextResponse.json(IpnFailChecksum);
  }

  const txnRef = result.vnp_TxnRef as string | undefined;
  if (!txnRef) {
    return NextResponse.json(IpnOrderNotFound);
  }

  const supabase = createAdminClient();
  const { data: order } = await supabase
    .from("orders")
    .select("id, product_id, price_at_order, payment_status, variant_name")
    .eq("vnp_txn_ref", txnRef)
    .single();

  if (!order) {
    return NextResponse.json(IpnOrderNotFound);
  }

  if (order.payment_status === "paid") {
    return NextResponse.json(InpOrderAlreadyConfirmed);
  }

  // VNPAY sends amount * 100; verify against stored price.
  const expectedAmount = order.price_at_order * 100;
  const receivedAmount = Number(result.vnp_Amount);
  if (!Number.isFinite(receivedAmount) || receivedAmount !== expectedAmount) {
    return NextResponse.json(IpnInvalidAmount);
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
    return NextResponse.json(IpnSuccess);
  }

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

  // Decrement stock now that payment is confirmed.
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
          console.error(
            "VNPAY IPN: variant stock decrement failed:",
            rpcError
          );
        }
      } else {
        await supabase
          .from("products")
          .update({ stock: Math.max(0, product.stock - 1) })
          .eq("id", order.product_id);
      }
    }
  }

  return NextResponse.json(IpnSuccess);
}
