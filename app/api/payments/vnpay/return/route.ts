import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { verifyVnpayReturn, type ReturnQueryFromVNPay } from "@/lib/vnpay";

function appUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return `${base.replace(/\/$/, "")}${path}`;
}

export async function GET(request: NextRequest) {
  const params = Object.fromEntries(request.nextUrl.searchParams.entries());

  let result;
  try {
    result = verifyVnpayReturn(params as unknown as ReturnQueryFromVNPay);
  } catch (err) {
    console.error("VNPAY return verify error:", err);
    return NextResponse.redirect(appUrl("/cam-on?pay=invalid"));
  }

  const txnRef = result.vnp_TxnRef as string | undefined;
  if (!result.isVerified || !txnRef) {
    return NextResponse.redirect(appUrl("/cam-on?pay=invalid"));
  }

  const supabase = createAdminClient();
  const { data: order } = await supabase
    .from("orders")
    .select("id, order_number")
    .eq("vnp_txn_ref", txnRef)
    .single();

  if (!order) {
    return NextResponse.redirect(appUrl(`/cam-on?pay=invalid`));
  }

  const status = result.isSuccess ? "success" : "failed";
  return NextResponse.redirect(
    appUrl(`/cam-on?id=${order.id}&num=${order.order_number}&pay=${status}`)
  );
}
