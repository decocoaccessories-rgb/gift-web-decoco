// Test mã trên popup exit-intent (offline, không network).
// Chạy: node --import ./scripts/_register-alias.mjs scripts/test-exit-offer-code.mjs

import { isCodeOfferable } from "../lib/discounts.ts";

let failed = 0;
function ok(name, cond, extra = "") {
  console.log(`${cond ? "  ✓" : "  ✗"} ${name}${extra ? " — " + extra : ""}`);
  if (!cond) failed++;
}

const NOW = Date.parse("2026-09-07T00:00:00Z");
const base = {
  is_active: true,
  starts_at: null,
  expires_at: null,
  usage_limit: null,
  usage_count: 0,
};

console.log("[1] Bug gốc: popup quảng bá mã không có trong discount_codes");
// Trước fix, gate in thẳng site_content.exit_offer_code nên mã đã xoá vẫn hiện.
ok("mã không tìm thấy (null) -> ẩn popup", isCodeOfferable(null, NOW) === false);
ok("mã undefined -> ẩn popup", isCodeOfferable(undefined, NOW) === false);

console.log("[2] Mã hợp lệ -> hiện popup");
ok("mã đang bật, không giới hạn", isCodeOfferable(base, NOW) === true);
ok("còn hạn", isCodeOfferable({ ...base, expires_at: "2026-12-31T00:00:00Z" }, NOW) === true);
ok("đã tới ngày bắt đầu", isCodeOfferable({ ...base, starts_at: "2026-01-01T00:00:00Z" }, NOW) === true);
ok("còn lượt (3/10)", isCodeOfferable({ ...base, usage_limit: 10, usage_count: 3 }, NOW) === true);

console.log("[3] Mã hỏng -> ẩn popup hoàn toàn");
ok("đã tắt", isCodeOfferable({ ...base, is_active: false }, NOW) === false);
ok("hết hạn", isCodeOfferable({ ...base, expires_at: "2026-09-06T00:00:00Z" }, NOW) === false);
ok("chưa tới ngày bắt đầu", isCodeOfferable({ ...base, starts_at: "2026-10-01T00:00:00Z" }, NOW) === false);
ok("hết lượt (10/10)", isCodeOfferable({ ...base, usage_limit: 10, usage_count: 10 }, NOW) === false);
ok("vượt lượt (11/10)", isCodeOfferable({ ...base, usage_limit: 10, usage_count: 11 }, NOW) === false);

console.log("[4] Biên");
ok("expires_at đúng bằng now -> vẫn còn dùng được", isCodeOfferable({ ...base, expires_at: "2026-09-07T00:00:00Z" }, NOW) === true);
ok("starts_at đúng bằng now -> đã bắt đầu", isCodeOfferable({ ...base, starts_at: "2026-09-07T00:00:00Z" }, NOW) === true);
ok("usage_limit = 0 -> ẩn", isCodeOfferable({ ...base, usage_limit: 0, usage_count: 0 }, NOW) === false);

console.log(failed === 0 ? "\nTẤT CẢ PASS" : `\n${failed} TEST FAIL`);
process.exit(failed === 0 ? 0 : 1);
