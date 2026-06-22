import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

// Endpoint polling cho trang hiển thị QR. Chỉ trả các field cần thiết để
// frontend cập nhật trạng thái + render lại QR (không lộ dữ liệu nhạy cảm).
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const { orderId } = await params;

  const supabase = createAdminClient();
  const { data: order } = await supabase
    .from("orders")
    .select(
      "order_number, payment_method, payment_status, price_at_order, vietqr_content, vietqr_qr_url, vietqr_expires_at"
    )
    .eq("id", orderId)
    .maybeSingle();

  if (!order || order.payment_method !== "vietqr") {
    return NextResponse.json({ error: "Không tìm thấy đơn hàng" }, { status: 404 });
  }

  return NextResponse.json({
    orderNumber: order.order_number,
    paymentStatus: order.payment_status,
    amount: order.price_at_order,
    content: order.vietqr_content,
    qrUrl: order.vietqr_qr_url,
    expiresAt: order.vietqr_expires_at,
  });
}
