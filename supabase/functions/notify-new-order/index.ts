import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const ADMIN_EMAIL = Deno.env.get("ADMIN_EMAIL") ?? "admin@decoco.vn";
const APP_URL = Deno.env.get("APP_URL") ?? "https://decoco.vn";

interface OrderRecord {
  id: string;
  order_number: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  province: string;
  address: string;
  note: string | null;
  price_at_order: number;
  design_image_url: string | null;
  status: string;
  created_at: string;
}

interface WebhookPayload {
  type: "INSERT" | "UPDATE" | "DELETE";
  table: string;
  record: OrderRecord;
  schema: string;
}

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const payload: WebhookPayload = await req.json();

  if (payload.type !== "INSERT" || payload.table !== "orders") {
    return new Response("Ignored", { status: 200 });
  }

  const order = payload.record;
  const priceFormatted = order.price_at_order.toLocaleString("vi-VN") + " đ";
  const dateFormatted = new Date(order.created_at).toLocaleString("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
  });

  const emailHtml = `
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; }
    .header { background: #E91E8C; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { padding: 24px; border: 1px solid #e0e0e0; }
    .info-row { display: flex; margin-bottom: 8px; }
    .label { font-weight: bold; min-width: 140px; color: #666; }
    .order-number { font-size: 24px; font-weight: bold; color: #E91E8C; }
    .design-img { max-width: 200px; border-radius: 8px; border: 1px solid #e0e0e0; margin: 12px 0; }
    .btn { display: inline-block; background: #E91E8C; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; margin-top: 16px; }
    .footer { text-align: center; padding: 16px; color: #999; font-size: 12px; }
  </style>
</head>
<body>
  <div class="header">
    <h2 style="margin:0">🛍️ Đơn hàng mới!</h2>
  </div>
  <div class="content">
    <p class="order-number">#${order.order_number}</p>
    <p>Thời gian: <strong>${dateFormatted}</strong></p>

    <h3>Thông tin khách hàng</h3>
    <div class="info-row"><span class="label">Họ tên:</span> <span>${order.customer_name}</span></div>
    <div class="info-row"><span class="label">SĐT:</span> <span>${order.customer_phone}</span></div>
    ${order.customer_email ? `<div class="info-row"><span class="label">Email:</span> <span>${order.customer_email}</span></div>` : ""}
    <div class="info-row"><span class="label">Tỉnh/TP:</span> <span>${order.province}</span></div>
    <div class="info-row"><span class="label">Địa chỉ:</span> <span>${order.address}</span></div>
    ${order.note ? `<div class="info-row"><span class="label">Ghi chú:</span> <span>${order.note}</span></div>` : ""}

    <h3>Thiết kế của khách</h3>
    <div class="info-row"><span class="label">Giá:</span> <span><strong>${priceFormatted}</strong></span></div>
    ${
      order.design_image_url
        ? `<p>Ảnh thiết kế:</p>
      <a href="${order.design_image_url}" target="_blank">
        <img src="${order.design_image_url}" class="design-img" alt="Design" />
      </a>
      <br><a href="${order.design_image_url}" target="_blank">Tải ảnh thiết kế</a>`
        : "<p><em>Chưa có ảnh thiết kế</em></p>"
    }

    <a href="${APP_URL}/admin/don-hang" class="btn">Xem đơn hàng trong Admin</a>
  </div>
  <div class="footer">© DECOCO — Hộp Quà Tặng Cá Nhân Hoá</div>
</body>
</html>
  `;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "DECOCO Orders <orders@decoco.vn>",
      to: [ADMIN_EMAIL],
      subject: `🛍️ Đơn hàng mới #${order.order_number} — ${order.customer_name} — ${order.customer_phone}`,
      html: emailHtml,
    }),
  });

  if (!res.ok) {
    const error = await res.text();
    console.error("Resend error:", error);
    return new Response("Email error", { status: 500 });
  }

  return new Response("OK", { status: 200 });
});
