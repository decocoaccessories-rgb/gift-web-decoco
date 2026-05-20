// Script gửi thử nghiệm 5 mẫu email khách hàng qua Resend.
// Để chạy: node --env-file=.env.local scripts/test-customer-emails.mjs [email_nhan]
// Ví dụ: node --env-file=.env.local scripts/test-customer-emails.mjs test@gmail.com

import { Resend } from "resend";

const apiKey = process.env.RESEND_API_KEY;
const from = process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev";
const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

// Bắt buộc truyền email nhận qua tham số dòng lệnh — tránh gửi nhầm vào hộp thư admin
const to = process.argv[2];
if (!to) {
  console.error("[test] ❌ Thiếu email nhận. Cách dùng: node --env-file=.env.local scripts/test-customer-emails.mjs <email>");
  process.exit(1);
}

if (!apiKey || apiKey === "placeholder_resend_key" || apiKey.startsWith("re_your-")) {
  console.error("[test] RESEND_API_KEY bị thiếu hoặc là placeholder. Không thể gửi.");
  process.exit(1);
}

const resend = new Resend(apiKey);

// Dữ liệu đơn hàng mẫu
const mockOrder = {
  order_number: "DCO-20260520-TEST",
  customer_name: "Nguyễn Khách Hàng",
  customer_phone: "0909876543",
  customer_email: to,
  province: "Thành phố Hồ Chí Minh",
  address: "123 Đường Nguyễn Huệ, Phường Bến Nghé, Quận 1",
  note: "Đơn hàng này được tạo ra để thử nghiệm thiết kế giao diện email mới của DECOCO.",
  price_at_order: 498000,
  variant_name: "Phiên bản Bạc Cao Cấp - Size M",
  payment_method: "cod",
  payment_status: "pending",
  created_at: new Date().toISOString(),
};

const PAYMENT_METHOD_LABEL = {
  cod: "COD — Thanh toán khi nhận hàng",
  vnpay: "Thanh toán điện tử VNPAY",
};

const PAYMENT_STATUS_LABEL = {
  pending: "Chờ thanh toán",
  paid: "Đã thanh toán",
  failed: "Thanh toán thất bại",
  cancelled: "Đã huỷ",
};

function escape(s) {
  if (!s) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatPrice(amount) {
  return amount.toLocaleString("vi-VN") + " đ";
}

function row(label, value) {
  return `<tr>
    <td style="padding:10px 14px;border-bottom:1px solid #f0f0f0;color:#71717a;font-size:13px;width:140px;font-weight:500;">${escape(label)}</td>
    <td style="padding:10px 14px;border-bottom:1px solid #f0f0f0;color:#18181b;font-size:13px;line-height:1.5;">${value}</td>
  </tr>`;
}

// Hàm render giống hệt trong lib/email/templates/customer-order.ts để đảm bảo độ chính xác
function renderCustomerOrderEmail({ order, productName, appUrl, type }) {
  const created = new Date(order.created_at).toLocaleString("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  let subject = "";
  let headerTitle = "";
  let statusMessage = "";
  let bannerColor = "#7a1f3a"; // Signature burgundy
  let showOrderDetails = true;

  switch (type) {
    case "placed":
      subject = `[DECOCO] Xác nhận đơn hàng #${order.order_number} thành công`;
      headerTitle = "Đặt hàng thành công!";
      statusMessage = `Cảm ơn bạn đã mua sắm tại DECOCO. Đơn hàng <strong>#${escape(order.order_number)}</strong> của bạn đã được tiếp nhận thành công và đang được bộ phận vận hành chuẩn bị.`;
      break;
    case "confirmed":
      subject = `[DECOCO] Đơn hàng #${order.order_number} của bạn đã được xác nhận`;
      headerTitle = "Đơn hàng đã được xác nhận!";
      statusMessage = `DECOCO vui mừng thông báo đơn hàng <strong>#${escape(order.order_number)}</strong> của bạn đã được xác nhận thành công và đang được chuẩn bị đóng gói để bàn giao cho đơn vị vận chuyển.`;
      break;
    case "shipping":
      subject = `[DECOCO] Đơn hàng #${order.order_number} đang được giao đến bạn`;
      headerTitle = "Đơn hàng đang được vận chuyển!";
      statusMessage = `Đơn hàng <strong>#${escape(order.order_number)}</strong> của bạn đã được đóng gói cẩn thận và bàn giao cho đối tác vận chuyển của DECOCO.<br/><br/>🎁 Bạn có thể liên hệ trực tiếp với bộ phận <strong>Chăm sóc khách hàng (CSKH)</strong> của DECOCO qua Fanpage hoặc Email để nhận mã vận đơn để chủ động theo dõi hành trình đơn hàng nhé.`;
      bannerColor = "#3b82f6"; // Vibrant blue for shipping
      break;
    case "done":
      subject = `[DECOCO] Đơn hàng #${order.order_number} đã giao thành công`;
      headerTitle = "Giao hàng thành công!";
      statusMessage = `Đơn hàng <strong>#${escape(order.order_number)}</strong> của bạn đã được giao thành công!<br/><br/>🌸 DECOCO hy vọng bạn sẽ cảm thấy vô cùng hài lòng khi nhận được sản phẩm thiết kế của chúng mình. Cảm ơn bạn rất nhiều vì đã tin tưởng lựa chọn DECOCO!`;
      bannerColor = "#10b981"; // Fresh green for successful completion
      break;
    case "cancelled":
      subject = `[DECOCO] Thông báo huỷ đơn hàng #${order.order_number}`;
      headerTitle = "Đơn hàng đã bị huỷ";
      statusMessage = `Chúng tôi rất tiếc phải thông báo rằng đơn hàng <strong>#${escape(order.order_number)}</strong> của bạn đã được huỷ trên hệ thống.<br/><br/>⚠️ Nếu đây là sự nhầm lẫn hoặc bạn cần hỗ trợ thêm, vui lòng liên hệ ngay với bộ phận CSKH của DECOCO qua Fanpage hoặc gửi mail tới <strong>decoco.cskh@gmail.com</strong> để được giải quyết nhanh nhất.`;
      bannerColor = "#ef4444"; // Warning red for cancellation
      showOrderDetails = false;
      break;
  }

  const html = `<!doctype html>
<html lang="vi">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escape(subject)}</title>
</head>
<body style="margin:0;padding:0;background-color:#fafafa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1c1917;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#fafafa;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" max-width="600" style="max-width:580px;background-color:#ffffff;border:1px solid #e4e4e7;border-radius:16px;overflow:hidden;box-shadow:0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05);border-collapse:collapse;" cellspacing="0" cellpadding="0" border="0">
          <!-- Premium Header -->
          <tr>
            <td style="padding:32px 24px;background-color:${bannerColor};text-align:center;color:#ffffff;">
              <div style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:2px;opacity:0.85;margin-bottom:8px;">DECOCO ACCESSORIES</div>
              <h1 style="margin:0;font-size:24px;font-weight:700;letter-spacing:-0.5px;line-height:1.2;">${escape(headerTitle)}</h1>
              <p style="margin:8px 0 0;font-size:13px;opacity:0.85;">Thời gian: ${escape(created)}</p>
            </td>
          </tr>

          <!-- Message Body -->
          <tr>
            <td style="padding:32px 24px;">
              <p style="margin:0;font-size:15px;line-height:1.6;color:#27272a;text-align:left;">
                Xin chào <strong>${escape(order.customer_name)}</strong>,
              </p>
              <p style="margin:16px 0 0;font-size:14px;line-height:1.6;color:#3f3f46;text-align:left;">
                ${statusMessage}
              </p>
            </td>
          </tr>

          <!-- Order details section -->
          ${
            showOrderDetails
              ? `
          <tr>
            <td style="padding:0 24px 20px;">
              <div style="background-color:#fcfcfc;border:1px solid #f4f4f5;border-radius:12px;overflow:hidden;">
                <div style="padding:12px 14px;background-color:#f4f4f5;border-bottom:1px solid #e4e4e7;font-size:12px;font-weight:700;color:#71717a;text-transform:uppercase;letter-spacing:0.5px;">
                  Thông tin đơn hàng chi tiết
                </div>
                <table role="presentation" width="100%" style="border-collapse:collapse;" cellspacing="0" cellpadding="0" border="0">
                  <tbody>
                    ${row("Mã đơn hàng", `<strong style="font-family:monospace;font-size:14px;color:#7a1f3a;">${escape(order.order_number)}</strong>`)}
                    ${productName ? row("Sản phẩm thiết kế", `<strong>${escape(productName)}</strong>`) : ""}
                    ${order.variant_name ? row("Phân loại", escape(order.variant_name)) : ""}
                    ${row("Tổng thanh toán", `<strong style="color:#7a1f3a;font-size:15px;">${escape(formatPrice(order.price_at_order))}</strong>`)}
                    ${row("Phương thức TT", escape(PAYMENT_METHOD_LABEL[order.payment_method] ?? order.payment_method))}
                    ${row("Trạng thái TT", `<span style="display:inline-block;padding:2px 8px;background-color:${order.payment_status === "paid" ? "#d1fae5" : "#fef3c7"};color:${order.payment_status === "paid" ? "#065f46" : "#92400e"};font-size:11px;font-weight:700;border-radius:4px;text-transform:uppercase;">${escape(PAYMENT_STATUS_LABEL[order.payment_status] ?? order.payment_status)}</span>`)}
                    ${row("Điện thoại nhận", escape(order.customer_phone))}
                    ${row("Địa chỉ nhận hàng", `${escape(order.address)}, ${escape(order.province)}`)}
                    ${order.note ? row("Ghi chú khách hàng", `<em style="color:#71717a;">${escape(order.note)}</em>`) : ""}
                  </tbody>
                </table>
              </div>
            </td>
          </tr>
          `
              : ""
          }

          <!-- Footer/Support Block -->
          <tr>
            <td style="padding:24px;background-color:#fafafa;border-top:1px solid #f4f4f5;text-align:center;">
              <p style="margin:0;font-size:13px;color:#71717a;line-height:1.5;">
                Bạn có thắc mắc về đơn hàng? Đừng ngần ngại liên hệ với chúng tôi:
              </p>
              <div style="margin-top:12px;">
                <a href="mailto:decoco.cskh@gmail.com" style="display:inline-block;margin:0 8px;color:#7a1f3a;text-decoration:none;font-weight:600;font-size:13px;">Email hỗ trợ</a>
                <span style="color:#e4e4e7;">|</span>
                <a href="https://trangsucdecoco.vn" style="display:inline-block;margin:0 8px;color:#7a1f3a;text-decoration:none;font-weight:600;font-size:13px;">Website DECOCO</a>
              </div>
              <p style="margin:24px 0 0;font-size:11px;color:#a1a1aa;text-transform:uppercase;letter-spacing:1px;">
                © ${new Date().getFullYear()} DECOCO Accessories. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, html };
}

const types = ["placed", "confirmed", "shipping", "done", "cancelled"];
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

console.log(`[test] Bắt đầu gửi 5 loại email thử nghiệm tới địa chỉ: "${to}"...`);

for (const type of types) {
  const { subject, html } = renderCustomerOrderEmail({
    order: mockOrder,
    productName: "Vòng Cổ Hoa Hồng Thiết Kế V2",
    appUrl,
    type,
  });

  try {
    const result = await resend.emails.send({ from, to, subject, html });
    if (result.error) {
      console.error(`[test] ✗ Gửi thất bại loại [${type}]. Resend error:`, JSON.stringify(result.error));
    } else {
      console.log(`[test] ✓ Gửi thành công loại [${type}]. ID:`, result.data.id);
    }
  } catch (err) {
    console.error(`[test] ✗ Gửi thất bại loại [${type}] do lỗi throw:`, err.message);
  }

  // Chờ 1 giây giữa các lần gửi để tránh giới hạn tần suất của tài khoản Resend miễn phí (2 yêu cầu/giây)
  await sleep(1000);
}

console.log(`[test] Đã hoàn thành tác vụ gửi email thử nghiệm.`);

