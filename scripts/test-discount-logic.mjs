// Test tính năng V3 — Mã giảm giá (offline, không network).
// Chạy: node --import ./scripts/_register-alias.mjs scripts/test-discount-logic.mjs

import {
  computeDiscountAmount,
  normalizeCode,
  isValidCodeFormat,
  discountReasonMessage,
} from "../lib/discounts.ts";
import { renderNewOrderEmail } from "../lib/email/templates/new-order.ts";
import { renderCustomerOrderEmail } from "../lib/email/templates/customer-order.ts";

let failed = 0;
function ok(name, cond, extra = "") {
  console.log(`${cond ? "  ✓" : "  ✗"} ${name}${extra ? " — " + extra : ""}`);
  if (!cond) failed++;
}

console.log("[1] computeDiscountAmount (mirror RPC _discount_amount)");
ok("fixed 50k / đơn 300k = 50k", computeDiscountAmount("fixed", 50000, null, 300000) === 50000);
ok("fixed 50k / đơn 30k = 30k (không vượt đơn)", computeDiscountAmount("fixed", 50000, null, 30000) === 30000);
ok("percent 10% / đơn 200k = 20k", computeDiscountAmount("percent", 10, null, 200000) === 20000);
ok("percent 10% cap 30k / đơn 500k = 30k", computeDiscountAmount("percent", 10, 30000, 500000) === 30000);
ok("percent 10% cap 30k / đơn 200k = 20k (chưa chạm trần)", computeDiscountAmount("percent", 10, 30000, 200000) === 20000);

console.log("[2] normalizeCode / isValidCodeFormat");
ok("normalize '  giam50k ' -> 'GIAM50K'", normalizeCode("  giam50k ") === "GIAM50K");
ok("'GIAM50K' hợp lệ", isValidCodeFormat("GIAM50K") === true);
ok("'ab' quá ngắn -> không hợp lệ", isValidCodeFormat("ab") === false);
ok("'MÃ CÓ DẤU' -> không hợp lệ", isValidCodeFormat("MÃ CÓ DẤU") === false);

console.log("[3] discountReasonMessage");
ok("expired -> câu tiếng Việt", discountReasonMessage("expired").includes("hết hạn"));
ok("per_customer_limit -> câu tiếng Việt", discountReasonMessage("per_customer_limit").includes("đã sử dụng"));

const baseOrder = {
  id: "o1",
  order_number: "DCO-DISC-1",
  customer_name: "Khách A",
  customer_phone: "0901234567",
  customer_email: "a@example.com",
  recipient_name: "Khách A",
  recipient_phone: "0901234567",
  province: "Hà Nội",
  address: "Số 1 phố Test, phường X",
  note: null,
  variant_name: null,
  design_image_url: null,
  payment_method: "cod",
  payment_status: "pending",
  created_at: new Date().toISOString(),
};

console.log("[4] Email đơn mới — có mã giảm giá");
const withDisc = renderNewOrderEmail({
  order: { ...baseOrder, price_at_order: 250000, discount_code: "GIAM50K", discount_amount: 50000 },
  productName: "Vòng tay",
  appUrl: "https://trangsucdecoco.vn",
});
ok("hiện nhãn 'Mã giảm giá'", withDisc.html.includes("Mã giảm giá"));
ok("hiện mã GIAM50K", withDisc.html.includes("GIAM50K"));
ok("hiện số tiền giảm '− 50.000 đ'", withDisc.html.includes("50.000 đ"));
ok("hiện giá gốc gạch ngang 300.000", withDisc.html.includes("line-through") && withDisc.html.includes("300.000 đ"));

console.log("[5] Email đơn mới — KHÔNG mã");
const noDisc = renderNewOrderEmail({
  order: { ...baseOrder, price_at_order: 300000, discount_code: null, discount_amount: 0 },
  productName: "Vòng tay",
  appUrl: "https://trangsucdecoco.vn",
});
ok("KHÔNG hiện nhãn 'Mã giảm giá'", !noDisc.html.includes("Mã giảm giá"));

console.log("[6] Email khách — có mã giảm giá");
const custDisc = renderCustomerOrderEmail({
  order: { ...baseOrder, price_at_order: 250000, discount_code: "GIAM50K", discount_amount: 50000 },
  productName: "Vòng tay",
  appUrl: "https://trangsucdecoco.vn",
  type: "placed",
});
ok("hiện 'Mã giảm giá' + mã", custDisc.html.includes("Mã giảm giá") && custDisc.html.includes("GIAM50K"));
ok("tổng thanh toán hiện 250.000", custDisc.html.includes("250.000 đ"));

console.log(failed === 0 ? "\nKẾT QUẢ: PASS ✅" : `\nKẾT QUẢ: FAIL ❌ (${failed} assertion)`);
process.exit(failed === 0 ? 0 : 1);
