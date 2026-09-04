// Test tái hiện + xác minh fix "Tách Người gửi / Người nhận" (BUG_REPORT.md).
// Offline, không gọi network. Chạy:
//   node --import ./scripts/_alias-hook.mjs scripts/test-recipient-fields.mjs
//
// Kiểm tra 3 điều:
//  1. Zod orderSchema (app/api/orders) BẮT BUỘC recipient_name + recipient_phone.
//  2. Email đơn mới (new-order) hiển thị tách "Người đặt" / "Người nhận" + cờ 🎁.
//  3. Email khách (customer-order) hiển thị SĐT NGƯỜI NHẬN, và fallback đúng cho
//     đơn cũ (recipient_* = null -> dùng customer_*).

import { z } from "zod";
import { renderNewOrderEmail } from "../lib/email/templates/new-order.ts";
import { renderCustomerOrderEmail } from "../lib/email/templates/customer-order.ts";

let failed = 0;
function ok(name, cond, extra = "") {
  console.log(`${cond ? "  ✓" : "  ✗"} ${name}${extra ? " — " + extra : ""}`);
  if (!cond) failed++;
}

// ---- 1. Schema (bản sao đồng bộ với app/api/orders/route.ts) --------------------
const orderSchema = z.object({
  product_id: z.string().uuid(),
  payment_method: z.enum(["cod", "vnpay", "vietqr"]).default("cod"),
  customer_name: z.string().min(2).max(100),
  customer_phone: z.string().regex(/^0\d{9}$/),
  customer_email: z.string().email().optional().or(z.literal("")),
  recipient_name: z.string().min(2).max(100),
  recipient_phone: z.string().regex(/^0\d{9}$/),
  province: z.string().min(1),
  address: z.string().min(10),
  note: z.string().max(500).optional(),
});

const base = {
  product_id: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  customer_name: "Người Gửi A",
  customer_phone: "0901234567",
  province: "Hà Nội",
  address: "Số 1 đường Test, Phường X, Quận Y",
};

console.log("[1] Zod orderSchema");
ok("thiếu recipient_* -> REJECT (tái hiện lỗi cũ)",
  orderSchema.safeParse(base).success === false);
ok("có recipient_* hợp lệ -> PASS",
  orderSchema.safeParse({ ...base, recipient_name: "Người Nhận B", recipient_phone: "0909876543" }).success === true);
ok("recipient_phone sai định dạng -> REJECT",
  orderSchema.safeParse({ ...base, recipient_name: "Người Nhận B", recipient_phone: "12345" }).success === false);

// ---- 2. Email đơn mới: đơn tặng quà (recipient khác customer) ------------------
const giftOrder = {
  id: "ord_1",
  order_number: "DCO-GIFT-1",
  customer_name: "Người Gửi A",
  customer_phone: "0901234567",
  customer_email: "sender@example.com",
  recipient_name: "Người Nhận B",
  recipient_phone: "0909876543",
  province: "Hồ Chí Minh",
  address: "Số 9 đường Giao Hàng, Phường Z, Quận W",
  note: null,
  price_at_order: 250000,
  variant_name: "Vàng hồng",
  design_image_url: null,
  payment_method: "cod",
  payment_status: "pending",
  created_at: new Date().toISOString(),
};

const newEmail = renderNewOrderEmail({ order: giftOrder, productName: "Vòng tay khắc tên", appUrl: "https://trangsucdecoco.vn" });
console.log("[2] Email đơn mới (new-order) — đơn tặng quà");
ok("có nhãn 'SĐT gọi xác nhận'", newEmail.html.includes("SĐT gọi xác nhận"));
ok("có nhãn 'SĐT giao hàng'", newEmail.html.includes("SĐT giao hàng"));
ok("chứa SĐT người gửi 0901234567", newEmail.html.includes("0901234567"));
ok("chứa SĐT người nhận 0909876543", newEmail.html.includes("0909876543"));
ok("chứa tên người nhận 'Người Nhận B'", newEmail.html.includes("Người Nhận B"));
ok("có cờ '🎁 đơn tặng quà'", newEmail.html.includes("🎁 đơn tặng quà"));

// ---- 3. Email khách + fallback đơn cũ ----------------------------------------
const custEmail = renderCustomerOrderEmail({ order: giftOrder, productName: "Vòng tay khắc tên", appUrl: "https://trangsucdecoco.vn", type: "placed" });
console.log("[3] Email khách (customer-order)");
ok("xưng hô đúng tên NGƯỜI ĐẶT", custEmail.html.includes("Xin chào <strong>Người Gửi A</strong>"));
ok("hiển thị SĐT NGƯỜI NHẬN (0909876543)", custEmail.html.includes("0909876543"));
ok("KHÔNG lấy nhầm SĐT người gửi làm 'Điện thoại nhận'",
  !/Điện thoại nhận<\/td>\s*<td[^>]*>0901234567/.test(custEmail.html));

// đơn cũ: recipient_* = null
const legacyOrder = { ...giftOrder, recipient_name: null, recipient_phone: null };
const legacyNew = renderNewOrderEmail({ order: legacyOrder, productName: "X", appUrl: "https://x" });
console.log("[3b] Fallback đơn cũ (recipient_* = null)");
ok("dùng customer_phone cho 'SĐT giao hàng'", legacyNew.html.includes("0901234567"));
ok("KHÔNG hiện cờ tặng quà khi người nhận = người đặt",
  !legacyNew.html.includes("🎁 đơn tặng quà"));

console.log(failed === 0 ? "\nKẾT QUẢ: PASS ✅" : `\nKẾT QUẢ: FAIL ❌ (${failed} assertion)`);
process.exit(failed === 0 ? 0 : 1);
