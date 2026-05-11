// Smoke test: gửi email order notification thật qua Resend.
// Mục tiêu: xác nhận RESEND_API_KEY hợp lệ và NOTIFICATION_EMAIL nhận được.
//
// Chạy: node --env-file=.env.local scripts/test-order-email.mjs

import { Resend } from "resend";

const apiKey = process.env.RESEND_API_KEY;
const to = process.env.NOTIFICATION_EMAIL ?? "decoco.cskh@gmail.com";
const from = process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev";
const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

if (!apiKey || apiKey === "placeholder_resend_key" || apiKey.startsWith("re_your-")) {
  console.error("[test] RESEND_API_KEY missing / placeholder. Aborting.");
  process.exit(1);
}

const resend = new Resend(apiKey);

const order = {
  order_number: "TEST-" + Date.now(),
  customer_name: "Nguyễn Văn Thử Nghiệm",
  customer_phone: "0901234567",
  customer_email: "test@example.com",
  province: "Hà Nội",
  address: "Số 1 đường Test, Phường Test, Quận Test",
  note: "Đây là email test, không phải đơn thật.",
  variant_name: "Vàng hồng",
  price_at_order: 250000,
  payment_method: "cod",
  payment_status: "pending",
  design_image_url: null,
  created_at: new Date().toISOString(),
};

const subject = `[DECOCO] Đơn mới #${order.order_number} — ${order.customer_name}`;

function escape(s) {
  if (!s) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const html = `<!doctype html>
<html lang="vi"><body style="font-family:sans-serif;padding:20px;">
  <h2>Đơn hàng mới #${escape(order.order_number)}</h2>
  <p><strong>Khách:</strong> ${escape(order.customer_name)} — ${escape(order.customer_phone)}</p>
  <p><strong>Địa chỉ:</strong> ${escape(order.address)}, ${escape(order.province)}</p>
  <p><strong>Phân loại:</strong> ${escape(order.variant_name)}</p>
  <p><strong>Giá:</strong> ${order.price_at_order.toLocaleString("vi-VN")}đ</p>
  <p><strong>TT:</strong> ${escape(order.payment_method)} / ${escape(order.payment_status)}</p>
  <p style="color:#999;font-size:12px;">Đây là email test smoke từ scripts/test-order-email.mjs</p>
  <p><a href="${escape(appUrl)}/admin/don-hang">Xem trong Admin</a></p>
</body></html>`;

console.log(`[test] Sending from "${from}" to "${to}"...`);

try {
  const result = await resend.emails.send({ from, to, subject, html });
  if (result.error) {
    console.error("[test] Resend returned error:", JSON.stringify(result.error, null, 2));
    process.exit(2);
  }
  console.log("[test] ✓ Sent. Resend response:", JSON.stringify(result.data, null, 2));
} catch (err) {
  console.error("[test] ✗ send threw:", err);
  process.exit(3);
}
