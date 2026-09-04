import type { Order } from "@/lib/supabase/types";
import { formatPrice } from "@/lib/utils";

export interface NewOrderEmailData {
  order: Pick<
    Order,
    | "id"
    | "order_number"
    | "customer_name"
    | "customer_phone"
    | "customer_email"
    | "recipient_name"
    | "recipient_phone"
    | "discount_code"
    | "discount_amount"
    | "province"
    | "address"
    | "note"
    | "price_at_order"
    | "variant_name"
    | "design_image_url"
    | "payment_method"
    | "payment_status"
    | "created_at"
  >;
  productName: string | null;
  appUrl: string;
}

const PAYMENT_METHOD_LABEL: Record<string, string> = {
  cod: "COD — Thanh toán khi nhận",
  vnpay: "VNPAY",
  vietqr: "Chuyển khoản VietQR",
};

const PAYMENT_STATUS_LABEL: Record<string, string> = {
  pending: "Chờ thanh toán",
  paid: "Đã thanh toán",
  failed: "Thất bại",
  cancelled: "Đã huỷ",
};

function escape(s: string | null | undefined): string {
  if (!s) return "";
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function row(label: string, value: string): string {
  return `<tr>
    <td style="padding:8px 12px;border-bottom:1px solid #eee;color:#666;font-size:13px;width:130px;">${escape(label)}</td>
    <td style="padding:8px 12px;border-bottom:1px solid #eee;font-size:14px;">${value}</td>
  </tr>`;
}

export function renderNewOrderEmail(data: NewOrderEmailData): {
  subject: string;
  html: string;
} {
  const { order, productName, appUrl } = data;
  const subject = `[DECOCO] Đơn mới #${order.order_number} — ${order.customer_name}`;
  const created = new Date(order.created_at).toLocaleString("vi-VN");
  const adminLink = `${appUrl.replace(/\/$/, "")}/admin/don-hang`;

  // Người nhận có thể khác người đặt (đơn tặng quà). Fallback về customer_* cho đơn cũ.
  const recipientName = order.recipient_name ?? order.customer_name;
  const recipientPhone = order.recipient_phone ?? order.customer_phone;
  const isGift =
    recipientPhone !== order.customer_phone || recipientName !== order.customer_name;

  const html = `<!doctype html>
<html lang="vi">
<head><meta charset="utf-8"><title>${escape(subject)}</title></head>
<body style="margin:0;padding:24px;background:#fafafa;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#222;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #eee;border-radius:12px;overflow:hidden;">
    <div style="padding:20px 24px;background:#7a1f3a;color:#fff;">
      <h1 style="margin:0;font-size:18px;font-weight:600;">Đơn hàng mới #${escape(order.order_number)}</h1>
      <p style="margin:4px 0 0;font-size:13px;opacity:0.9;">${escape(created)}</p>
    </div>

    <table style="width:100%;border-collapse:collapse;">
      <tbody>
        ${row("Người đặt", `<strong>${escape(order.customer_name)}</strong>${isGift ? ' <span style="color:#7a1f3a;">🎁 đơn tặng quà</span>' : ""}`)}
        ${row("SĐT gọi xác nhận", `<a href="tel:${escape(order.customer_phone)}" style="color:#7a1f3a;">${escape(order.customer_phone)}</a>`)}
        ${order.customer_email ? row("Email người đặt", escape(order.customer_email)) : ""}
        ${row("Người nhận", `<strong>${escape(recipientName)}</strong>`)}
        ${row("SĐT giao hàng", `<a href="tel:${escape(recipientPhone)}" style="color:#7a1f3a;">${escape(recipientPhone)}</a>`)}
        ${row("Tỉnh/TP", escape(order.province))}
        ${row("Địa chỉ", escape(order.address))}
        ${order.note ? row("Ghi chú", `<em>${escape(order.note)}</em>`) : ""}
        ${productName ? row("Sản phẩm", `<strong>${escape(productName)}</strong>`) : ""}
        ${order.variant_name ? row("Phân loại", escape(order.variant_name)) : ""}
        ${
          order.discount_amount > 0
            ? row("Mã giảm giá", `${escape(order.discount_code)} · <span style="color:#7a1f3a;">− ${escape(formatPrice(order.discount_amount))}</span>`) +
              row("Giá trị", `<span style="text-decoration:line-through;color:#999;">${escape(formatPrice(order.price_at_order + order.discount_amount))}</span> <strong style="color:#7a1f3a;">${escape(formatPrice(order.price_at_order))}</strong>`)
            : row("Giá trị", `<strong style="color:#7a1f3a;">${escape(formatPrice(order.price_at_order))}</strong>`)
        }
        ${row("Phương thức TT", escape(PAYMENT_METHOD_LABEL[order.payment_method] ?? order.payment_method))}
        ${row("TT trạng thái", escape(PAYMENT_STATUS_LABEL[order.payment_status] ?? order.payment_status))}
        ${order.design_image_url ? row("Ảnh thiết kế", `<a href="${escape(order.design_image_url)}" style="color:#7a1f3a;">Tải ảnh</a>`) : ""}
      </tbody>
    </table>

    <div style="padding:16px 24px;background:#fafafa;border-top:1px solid #eee;text-align:center;">
      <a href="${escape(adminLink)}" style="display:inline-block;padding:10px 20px;background:#7a1f3a;color:#fff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:500;">
        Xem trong Admin
      </a>
    </div>
  </div>
  <p style="text-align:center;font-size:11px;color:#aaa;margin-top:16px;">DECOCO order notification</p>
</body>
</html>`;

  return { subject, html };
}
