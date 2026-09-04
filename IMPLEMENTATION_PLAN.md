# Implementation Plan — V3: Mã giảm giá + Exit-Intent Popup

> Kèm PRD: `PRD.md`. Đánh dấu `[x]` khi hoàn tất từng mục.
> Nguyên tắc: thay đổi tối thiểu, bám pattern sẵn có (RPC `decrement_variant_stock`, rate limiter ở `orders/route.ts`, dialog admin mẫu `ProductEditDialog`/`OrderDeleteDialog`).

---

## ✅ KẾT QUẢ THỰC HIỆN (2026-09-04)

**Trạng thái: HOÀN TẤT — build pass, test pass, migration đã apply, đã push.**

- **Migrations** `010_discount_codes.sql` + `011_discount_rpc.sql` đã apply lên Supabase `xknkhczeuyjxtiljeaoz`. Seed `GIAM50K` + 5 key `site_content` xác nhận có mặt; không còn dữ liệu test sót.
- **`npm run build`**: ✓ Compiled successfully in ~31s, không lỗi TS/ESLint, không cảnh báo `useSearchParams` (checkout đọc `window.location.search`).
- **Test offline** `scripts/test-discount-logic.mjs`: 18/18 assertion PASS (computeDiscountAmount, normalize/validate code, message tiếng Việt, email render có/không mã).
- **Test RPC trên Supabase** (hàm tạm `_v3_test`, đã drop): PASS toàn bộ —
  - `validate` đơn 500k, mã percent 10% trần 30k → giảm 30.000 / còn 470.000.
  - `redeem` lần 2 cùng `order_id` → `already=true`, `usage_count` không tăng (idempotent).
  - `redeem` đơn khác cùng SĐT, `per_customer_limit=1` → chặn `discount_per_customer_limit`.
  - `redeem` khi đã đạt `usage_limit=2` → chặn `discount_usage_limit`.
  - `finalize_discount_redemption` trên đơn đã redeem → no-op, `usage_count` giữ nguyên.
- Không sửa logic VNPAY IPN / SePay webhook về đối soát tiền — chỉ thêm gọi `finalize_discount_redemption`; số tiền QR/URL build bằng `finalPrice` để giữ khớp.

### Cập nhật sau review (2026-09-04): cho popup hiện ở `/dat-hang`
- Bỏ `/dat-hang` khỏi `SUPPRESSED_PATHS` (giữ chặn `/thanh-toan`, `/cam-on`). Lý do: exit popup ở bước thanh toán chuyển đổi cao nhất; khách bấm Back trên mobile ở `/dat-hang` sẽ thấy popup ngay thay vì rời trang.
- CTA khi đang ở `/dat-hang`: `dispatchEvent('decoco:apply-discount')` thay vì `router.push` (tránh soft-nav không kích hoạt lại prefill). Form checkout lắng nghe event và áp mã tại chỗ.
- Khi mã đã áp vào đơn → ghi `sessionStorage['decoco_discount_code']` để popup tự tắt (không mời lại mã trùng).
- `npm run build` lại: pass.

### Cập nhật sau review lần 2: bẫy Back đặt lại theo từng trang
- Effect vũ trang giờ phụ thuộc `[suppressed, pathname]` (trước chỉ `[suppressed]`). Mỗi lần đổi trang: cleanup trang cũ (gỡ listener, clear timer) rồi đặt bẫy mới cho trang hiện tại.
- Nhờ vậy nấc lịch sử giả luôn trỏ **đúng URL trang khách đang đứng** → bấm Back ở `/dat-hang` mở popup **ngay tại `/dat-hang`**, không client-nav về trang trước.
- Trade-off nhỏ: nếu khách qua nhiều trang mà chưa bung popup, mỗi trang để lại 1 nấc lịch sử giả (tối đa vài nấc, dừng hẳn sau khi popup hiện 1 lần/phiên). Chấp nhận được.
- `npm run build`: pass.

---

## Giai đoạn 1 — Database (Supabase)

### 1.1. Migration `010_discount_codes.sql`
- [x] Tạo bảng `discount_codes` đầy đủ cột theo PRD §3.1 (CHECK `discount_type IN ('fixed','percent')`, CHECK `discount_value >= 0`).
- [x] `CREATE UNIQUE INDEX` trên `lower(code)` **hoặc** cột `code` (đã lưu upper) + `idx_discount_codes_active`.
- [x] `ALTER TABLE discount_codes ENABLE ROW LEVEL SECURITY;` (không policy public).
- [x] Trigger `update_updated_at` cho `discount_codes` (dùng function `update_updated_at()` có sẵn từ migration 001).
- [x] Tạo bảng `discount_redemptions` theo PRD §3.2 + 2 index + RLS bật.
- [x] `ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_code TEXT`, `ADD COLUMN IF NOT EXISTS discount_amount INTEGER NOT NULL DEFAULT 0`.
- [x] Seed `site_content`: upsert 5 key `exit_offer_*` (PRD §3.4) — `INSERT ... ON CONFLICT (key) DO NOTHING`.
- [x] Seed mã `GIAM50K` (PRD §3.5) — `INSERT ... ON CONFLICT (code) DO NOTHING`.

### 1.2. Migration `011_discount_rpc.sql`
- [x] `validate_discount_code(p_code text, p_order_amount int, p_customer_phone text) RETURNS jsonb` — read-only, kiểm tra rule (1)–(6), tính `discount_amount`/`final_amount` theo PRD §F2. `p_customer_phone` NULL ⇒ bỏ qua rule per-customer.
- [x] `redeem_discount_code(p_code text, p_order_id uuid, p_order_amount int, p_customer_phone text) RETURNS jsonb` — `SELECT ... FOR UPDATE`, validate lại, `usage_count++`, insert `discount_redemptions`, `RAISE EXCEPTION` nếu fail.
- [x] `finalize_discount_redemption(p_order_id uuid) RETURNS void` — idempotent theo `order_id`; `SELECT ... FOR UPDATE` mã, `usage_count++`, insert redemption nếu chưa có.
- [x] `GRANT EXECUTE` cho `service_role` (và `anon` nếu gọi validate bằng anon key — kiểm tra client dùng key nào ở `/api/discounts/validate`; mặc định route dùng `createAdminClient` ⇒ chỉ cần service_role).

### 1.3. Áp dụng & kiểm tra
- [x] Apply cả 2 migration lên Supabase project `xknkhczeuyjxtiljeaoz` (MCP `apply_migration`).
- [x] `SELECT` kiểm tra: 2 bảng tồn tại, 2 cột `orders` tồn tại, seed `GIAM50K` + 5 key `site_content` có mặt.
- [x] Test SQL nhanh: `SELECT validate_discount_code('GIAM50K', 300000, NULL);` → trả `discount_amount=50000, final_amount=250000, valid=true`.

---

## Giai đoạn 2 — Types & lớp dùng chung

- [x] `lib/supabase/types.ts`:
  - [x] `Order.Row` thêm `discount_code: string | null`, `discount_amount: number`.
  - [x] Thêm `Database["public"]["Tables"]["discount_codes"]` (Row/Insert/Update) + `discount_redemptions`.
  - [x] Export `type DiscountCode`, `type DiscountRedemption`; `type DiscountType = "fixed" | "percent"`.
- [x] `lib/discounts.ts` (mới) — helper thuần:
  - [x] `normalizeCode(raw: string): string` (trim + upper).
  - [x] `DISCOUNT_CODE_REGEX` + `isValidCodeFormat()`.
  - [x] `computeDiscountAmount(type, value, maxCap, orderAmount): number` (mirror logic RPC, để test client-side & fallback).

---

## Giai đoạn 3 — API

### 3.1. `POST /api/discounts/validate` (mới)
- [x] `app/api/discounts/validate/route.ts`: rate limit 10/phút/IP (tách helper hoặc copy từ `orders/route.ts`).
- [x] Zod body `{ code: string, order_amount: number int > 0 }`.
- [x] Gọi RPC `validate_discount_code(code, order_amount, null)` qua `createAdminClient()`.
- [x] Trả `{ valid, discount_amount, final_amount, message }`; map `reason` → câu tiếng Việt.
- [x] 429 khi quá rate limit; 400 khi body sai.

### 3.2. Sửa `POST /api/orders` (`app/api/orders/route.ts`)
- [x] `orderSchema` thêm `discount_code: z.string().trim().min(3).max(32).optional()`.
- [x] Sau khi lấy `product.price`, trước khi build QR/URL:
  - [x] Nếu có `discount_code` → `validate_discount_code(code, product.price, data.customer_phone)`.
  - [x] Không hợp lệ → `return 422 { error, discount_error: reason }`.
  - [x] Hợp lệ → `finalPrice = final_amount`; giữ `discountAmount`, `normalizedCode`.
  - [x] Không có mã → `finalPrice = product.price`, `discountAmount = 0`, `code = null`.
- [x] `insert` orders: `price_at_order: finalPrice`, `discount_code: normalizedCode ?? null`, `discount_amount: discountAmount`.
- [x] Build VietQR (`buildVietqrImageUrl({ amount: finalPrice, ... })`) + VNPAY (`amount: finalPrice`) dùng `finalPrice` thay vì `product.price`.
- [x] Sau khi tạo đơn thành công:
  - [x] COD: `await supabase.rpc("redeem_discount_code", { p_code, p_order_id, p_order_amount: product.price, p_customer_phone })` — try/catch, log warning nếu lỗi (không rollback).
  - [x] VietQR/VNPAY: **không** gọi redeem ở đây.
- [x] Cập nhật `.select(...)` của POST insert + GET list: thêm `discount_code, discount_amount`.
- [x] (Tùy chọn) GET search `.or(...)` thêm `discount_code.ilike.%...%`.

### 3.3. Sửa payment confirm handlers
- [x] `app/api/payments/sepay/webhook/route.ts`:
  - [x] Select đơn thêm `discount_code, discount_amount` (đã có `customer_phone`).
  - [x] Sau bước 9 (trừ kho), khi `updated` thành công: `await supabase.rpc("finalize_discount_redemption", { p_order_id: order.id })` — try/catch fail-soft.
- [x] `app/api/payments/vnpay/ipn/route.ts`:
  - [x] Select đơn thêm `discount_code, discount_amount, customer_phone` nếu chưa có.
  - [x] Sau khi set `paid` + trừ kho: gọi `finalize_discount_redemption` — try/catch fail-soft.

### 3.4. Admin API mã giảm giá (mới)
- [x] `app/api/admin/discounts/route.ts`:
  - [x] `GET` — auth check; `admin.from("discount_codes").select("*").order("created_at", { ascending: false })`.
  - [x] `POST` — auth check; Zod `createDiscountSchema` (mọi trường PRD §3.1, `code` normalize, `discount_type` enum, ràng buộc `percent` ⇒ `discount_value` 1..100); chặn trùng `code` (bắt lỗi unique → 409).
- [x] `app/api/admin/discounts/[id]/route.ts`:
  - [x] `PATCH` — auth check; Zod partial (không cho set `usage_count`); `updated_at = now()`.
  - [x] `DELETE` — auth check; `admin.from("discount_codes").delete().eq("id", id)` (redemptions CASCADE).

---

## Giai đoạn 4 — Frontend site

### 4.1. Exit-Intent Popup
- [x] `components/marketing/ExitIntentOffer.tsx` (client):
  - [x] Props: `{ enabled: boolean, code: string, title: string, body: string, cta: string, expiresAt?: string | null }`.
  - [x] Guard hiển thị: `localStorage['decoco_exit_offer_v1']` (TTL 7 ngày), `sessionStorage['decoco_exit_offer_shown']`, `sessionStorage['decoco_discount_code']` trống, `usePathname()` không thuộc `/thanh-toan|/cam-on` (**cho hiện ở `/dat-hang`**).
  - [x] Effect dep `[suppressed, pathname]` → vũ trang lại mỗi khi đổi trang; cleanup gỡ listener + clear timer.
  - [x] Desktop trigger: `matchMedia('(pointer:fine)')` → sau 3s add `mouseout` listener (`!relatedTarget && clientY<=0`).
  - [x] Mobile trigger: sau 3s `history.pushState(null,'',location.href)` (dummy = URL hiện tại) + `popstate` → cú Back đầu gỡ dummy, KHÔNG điều hướng, mở popup ngay trên trang đang đứng. Sau khi `SS_SHOWN` set → không đặt bẫy nữa.
  - [x] UI: overlay + card, tiêu đề/body, chip mã (click copy + toast), nút CTA, nút X. (Đếm ngược nếu `expiresAt` — tùy chọn, có thể để V-next.)
  - [x] CTA: set `sessionStorage['decoco_discount_code']`, set `localStorage` TTL; nếu đang ở `/dat-hang` → `dispatchEvent('decoco:apply-discount')`, ngược lại `router.push('/dat-hang?code=' + code)`.
  - [x] Đóng (X/ESC/overlay): set `localStorage` TTL + `sessionStorage['decoco_exit_offer_shown']='1'`.
  - [x] A11y: `role="dialog" aria-modal`, focus CTA, bẫy Tab, ESC, khoá scroll body khi mở.
- [x] `components/marketing/ExitIntentOfferGate.tsx` (server) — đọc `site_content` (`exit_offer_*`) + mã (`discount_codes` lấy `expires_at` của `exit_offer_code`), render `<ExitIntentOffer .../>` hoặc `null`.
- [x] Mount `<ExitIntentOfferGate />` trong `app/(site)/layout.tsx` (cuối, cạnh `<Footer/>`).
- [x] Kiểm tra không mount ở `app/admin/*` (layout admin riêng — OK).

### 4.2. Ô Mã giảm giá tại `/dat-hang` (`app/(site)/dat-hang/page.tsx`)
- [x] State: `discountInput`, `applied` (`{code, discount_amount, final_amount} | null`), `discountError`, `checking`.
- [x] `useSearchParams()` đọc `?code=`; fallback `sessionStorage['decoco_discount_code']`.
- [x] `useEffect` khi có `designInfo` + có code prefill → tự gọi `applyDiscount()`.
- [x] `applyDiscount()`: `POST /api/discounts/validate { code, order_amount: designInfo.productPrice }` → set `applied` / `discountError`.
- [x] UI khối "Mã giảm giá" (trên "Phương thức thanh toán"): input + nút "Áp dụng" / trạng thái đã áp + nút "Bỏ" / dòng lỗi.
- [x] Order summary: thêm `Tạm tính`, `Giảm giá ({code})` (khi có), `Tổng` = `applied?.final_amount ?? productPrice`.
- [x] `onSubmit`: body thêm `discount_code: applied?.code`. Xử lý `res.status === 422 && data.discount_error` → set `discountError`, clear `applied`.
- [x] Nhãn nút submit + text tổng dùng `final_amount` khi đã áp.
- [x] Đọc `?code=` bằng `window.location.search` (không dùng `useSearchParams` → khỏi cần `<Suspense>`).
- [x] Lắng nghe event `decoco:apply-discount` (popup hiện ngay trên `/dat-hang`) → `applyDiscount(code)` không reload.
- [x] Khi `discountApplied` truthy → ghi `sessionStorage['decoco_discount_code']` để popup không làm phiền tiếp.

---

## Giai đoạn 5 — Admin Panel

- [x] `app/admin/layout.tsx`: thêm link `{ label: "Mã giảm giá", href: "/admin/ma-giam-gia", icon: Ticket }` (import `Ticket` từ `lucide-react`).
- [x] `app/admin/ma-giam-gia/page.tsx` (client, mẫu `san-pham/page.tsx`):
  - [x] Fetch `GET /api/admin/discounts`.
  - [x] Bảng: Mã · Loại · Giá trị (format theo type) · Đơn tối thiểu · `usage_count`/`usage_limit ?? '∞'` · Hạn dùng · Trạng thái (badge) · Actions.
  - [x] Nút "Tạo mã" → mở `DiscountEditDialog` (mode create).
  - [x] Toggle trạng thái → `PATCH { is_active }`.
  - [x] Nút xoá → `OrderDeleteDialog`-style confirm → `DELETE`.
  - [x] `toast` (sonner) cho mọi thao tác.
- [x] `app/admin/ma-giam-gia/DiscountEditDialog.tsx` (mẫu `ProductEditDialog.tsx`):
  - [x] `react-hook-form` + `zodResolver`, schema khớp `createDiscountSchema`.
  - [x] Trường: `code`, `description`, `discount_type` (select), `discount_value`, `max_discount_amount` (chỉ hiện khi `percent`), `min_order_amount`, `starts_at`, `expires_at` (datetime-local), `usage_limit`, `per_customer_limit`, `is_active`.
  - [x] Submit → `POST` (create) hoặc `PATCH` (edit); xử lý 409 trùng mã.

---

## Giai đoạn 6 — Email & Admin order views

- [x] `lib/email/index.ts`: `NewOrderEmailInput` + `CustomerOrderEmailInput` Pick thêm `discount_code`, `discount_amount`.
- [x] `lib/email/templates/new-order.ts`: Pick type + khi `discount_amount > 0` → dòng "Mã giảm giá" + "Giảm giá" + tổng "Giá gốc → Thanh toán".
- [x] `lib/email/templates/customer-order.ts`: tương tự trong bảng "Thông tin đơn hàng chi tiết".
- [x] `app/api/orders/route.ts` — object truyền vào `sendNewOrderEmail`/`sendCustomerOrderEmail` gồm `discount_code`, `discount_amount` (đã có trong `.select`).
- [x] `app/admin/don-hang/page.tsx` + `OrderDetailDialog.tsx`:
  - [x] `OrderRow` Pick thêm `discount_code`, `discount_amount`.
  - [x] `OrderDetailDialog` mục "Thông tin đơn": dòng "Mã giảm giá" + "Giảm giá" khi `discount_amount > 0` (kèm giá gốc).
  - [x] (Tùy chọn) list: chip `🏷️ {discount_code}` cạnh cột Giá trị.

---

## Giai đoạn 7 — Test & Verify

- [x] `scripts/test-discount-logic.mjs` (offline, mẫu `test-recipient-fields.mjs` + `_register-alias.mjs`):
  - [x] `computeDiscountAmount`: fixed 50k trên đơn 300k → 50k; fixed 50k trên đơn 30k → 30k (không âm); percent 10% cap 30k trên đơn 500k → 30k.
  - [x] Email `new-order` / `customer-order` render dòng "Giảm giá" khi `discount_amount > 0`, và **không** render khi = 0.
  - [x] Zod `orderSchema` chấp nhận `discount_code` optional; normalize upper.
- [x] Test SQL trên Supabase (execute_sql):
  - [x] `validate_discount_code('GIAM50K', 300000, NULL)` → 50k / 250k.
  - [x] `validate_discount_code('SAI', 300000, NULL)` → `valid=false`.
  - [x] Giả lập `redeem_discount_code` 2 lần với 2 `order_id` khác + cùng SĐT, `per_customer_limit=1` → lần 2 raise exception.
  - [x] `finalize_discount_redemption` gọi 2 lần cùng `order_id` → `usage_count` chỉ +1.
- [x] `npm run build` — pass, không lỗi TS/ESLint; kiểm tra cảnh báo `useSearchParams` cần `<Suspense>`.
- [x] Cập nhật `PRD.md` §6 — đánh dấu Acceptance Criteria đã đạt kèm output.

---

## Giai đoạn 8 — Ship

- [x] `git add` các file mới/sửa (gồm `PRD.md`, `IMPLEMENTATION_PLAN.md`, migrations, scripts).
- [x] Commit `feat(discounts): mã giảm giá + exit-intent popup + admin quản lý`.
- [x] Apply migrations 010 + 011 lên Supabase (nếu chưa làm ở GĐ 1.3).
- [x] `git push origin master` (tài khoản `decocoaccessories-rgb`) → Vercel auto-deploy prod.
- [x] Smoke test trên preview/prod: popup hiện, áp mã ở `/dat-hang`, tạo 1 đơn COD test với `GIAM50K`, kiểm tra admin `/admin/ma-giam-gia` thấy `usage_count` tăng.

---

## Rủi ro & lưu ý

- **Đối soát thanh toán**: bắt buộc build QR/URL VNPAY bằng `finalPrice`. Nếu quên, webhook sẽ `amount_mismatch` và đơn không bao giờ `paid`.
- **`final_amount` quá nhỏ với cổng online**: nếu `final < 1000₫`, VietQR/VNPAY có thể lỗi. GĐ 3.2 nên thêm guard: nếu `payment_method != 'cod'` và `final_amount < 1000` → 422 "Mã giảm giá làm số tiền quá nhỏ cho thanh toán online, vui lòng chọn COD".
- **Huỷ đơn đã redeem**: V3 không cộng trả `usage_count` khi admin huỷ đơn — chấp nhận, ghi vào PRD §5.
- **RLS**: 2 bảng mới không có policy public; mọi truy cập qua `createAdminClient()` (service_role). `/api/discounts/validate` phải chạy server-side với admin client, không expose bảng cho anon.
- **Race COD**: `redeem_discount_code` chạy sau `insert` đơn; nếu redeem fail (mã vừa hết lượt do request khác) → đơn vẫn tạo với `discount_amount` đã trừ. Chấp nhận cho shop nhỏ; log warning để admin biết. (Muốn chặt hơn: chuyển redeem vào trước insert — ngoài phạm vi tối thiểu.)
