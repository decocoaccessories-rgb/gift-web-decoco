# PRD — V3: Mã giảm giá + Exit-Intent Popup

> Phạm vi tài liệu này: **chỉ tính năng Mã giảm giá (discount code) và popup giữ chân khách rời trang**.
> PRD gốc (V1/V2) nằm trong `CLAUDE.md`. Implementation Plan dạng checkbox: `IMPLEMENTATION_PLAN.md`.
> Ngày lập: 2026-09-04.

---

## 0. Tóm tắt yêu cầu (từ khách hàng)

1. Khi khách **chuẩn bị thoát trang** → hiện popup banner kèm **mã giảm giá 50k**.
2. Khách bấm vào popup → nhảy sang **trang thanh toán `/dat-hang`**, voucher **tự động áp** vào đơn.
3. Trang `/dat-hang` cần có **ô nhập Mã giảm giá** (áp thủ công cũng được).
4. **Admin Panel** cần **menu quản lý Mã giảm giá** (tạo / sửa / bật-tắt / xoá / xem lượt dùng).

---

## 1. Deep Research — Best practices (nguồn internet)

### 1.1. Exit-Intent Popup

| Chủ đề | Kết luận áp dụng cho DECOCO |
|---|---|
| **Hiệu quả** | Exit popup chuyển đổi TB ~2.8%, bản tối ưu 7–10%; kịch bản "giỏ hàng bỏ quên + ưu đãi" đạt cao nhất (~17%). Ưu đãi giảm giá cụ thể ("Giảm ngay 50.000₫") mạnh hơn lời kêu gọi chung chung. |
| **Phát hiện ý định thoát (desktop)** | Nghe `mouseout`/`mouseleave` khi con trỏ rời mép trên viewport (`clientY <= 0`, `relatedTarget == null`). Chỉ "vũ trang" sau khi khách ở lại trang ≥ 3 giây. |
| **Mobile / cảm ứng** | Không có `mouseleave`. Dùng tín hiệu thay thế: chặn **nút Back** (history trap) hoặc **cuộn ngược nhanh về đầu trang**. V3 làm: desktop = mouseleave; mobile = back-button trap (1 lần/phiên). |
| **Tần suất / chống phiền** | Sau khi khách đóng hoặc đã bấm nhận → **không hiện lại trong 7 ngày** (lưu `localStorage`). Không hiện quá 1 lần/phiên. |
| **Không hiện ở đâu** | `/dat-hang`, `/thanh-toan/*`, `/cam-on`, toàn bộ `/admin/*`; và khi đơn đã có mã giảm giá đang áp. |
| **Số trường form** | 1–3 trường chuyển đổi tốt nhất; ≥ 4 trường tụt mạnh. → Popup DECOCO **không thu thập email**, chỉ 1 nút CTA "Dùng mã & đặt hàng". |
| **Khẩn cấp** | Cho phép hiển thị hạn dùng mã ("Hết hạn sau 48 giờ") nếu mã có `expires_at`. |
| **Accessibility** | `role="dialog"` + `aria-modal`, bẫy focus, phím **ESC** đóng, click nền đóng, nút X góc trên phải, tương phản đủ. |

### 1.2. Hệ thống Mã giảm giá

| Chủ đề | Kết luận áp dụng cho DECOCO |
|---|---|
| **Mô hình dữ liệu** | Shop nhỏ, đơn 1 sản phẩm → **không** cần tách campaign/coupon. Một bảng `discount_codes` + một bảng audit `discount_redemptions` là đủ. Hỗ trợ `discount_type ∈ {fixed, percent}` ngay từ đầu để không phải migrate sau. |
| **Các trường bắt buộc** | loại giảm, giá trị, đơn tối thiểu, hạn bắt đầu/kết thúc, giới hạn tổng lượt, giới hạn lượt/khách, đếm lượt đã dùng, cờ bật/tắt. |
| **Validation** | (1) mã tồn tại + đang bật; (2) trong khoảng hạn dùng; (3) `order_amount ≥ min_order_amount`; (4) chưa chạm `usage_limit`; (5) khách chưa chạm `per_customer_limit` (khoá theo **SĐT người đặt** vì không có tài khoản user); (6) **re-validate tại thời điểm tạo đơn / thanh toán**, không tin bước hiển thị ở client. |
| **Redemption phải atomic** | Dùng Postgres RPC `SELECT ... FOR UPDATE` trên dòng mã → kiểm tra lại toàn bộ giới hạn → `usage_count++` + insert `discount_redemptions` trong **cùng transaction**. Chống double-redeem khi request đồng thời. (Mirror pattern RPC `decrement_variant_stock` sẵn có — migration 005.) |
| **Bảo mật** | Chỉ tính giảm giá **ở server**; client chỉ gửi *chuỗi mã*, không gửi số tiền. Rate-limit endpoint validate (10 lần/phút/IP), giống rate limiter sẵn có ở `app/api/orders/route.ts`. |
| **Thời điểm trừ lượt** | Mirror logic trừ kho hiện tại: **COD** → trừ lượt khi tạo đơn. **VietQR/VNPAY** → tính & khoá số tiền khi tạo đơn, nhưng **chỉ trừ lượt khi webhook/IPN xác nhận `paid`**. Đơn không thanh toán ⇒ không tiêu mã. |
| **Ngoài phạm vi** | Chống multi-account bằng device fingerprint / CAPTCHA; sinh hàng loạt mã một-lần duy nhất; mã theo danh mục/sản phẩm; cộng dồn nhiều mã. |

**Nguồn:**
- Exit-intent: [CrazyEgg — Exit-Intent Popup Playbook](https://www.crazyegg.com/blog/exit-popup/) · [Divimode — 7 Exit Intent Popup Best Practices 2025](https://divimode.com/exit-intent-popup-best-practices/) · [Popupsmart — Popup Conversion Benchmark 2025](https://popupsmart.com/blog/popup-conversion-benchmark-report) · [OptinMonster — 40 Exit Popup Hacks](https://optinmonster.com/40-exit-popup-hacks-that-will-grow-your-subscribers-and-revenue/)
- Coupon system: [techinterview.org — System Design: Coupon & Promo Code System](https://www.techinterview.org/post/3233465673/system-design-coupon-system/) · [Scalable Coupon Management System in Node (Medium/STYLABS)](https://medium.com/@STYLABSHQ/how-we-developed-scalable-coupon-management-system-in-node-945426b02df1) · [Coupon & Discount Engine that Scales (codesoltech)](https://www.codesoltech.com/blog/coupon-discount-engine-development/)

---

## 2. Hiện trạng liên quan (codebase)

- Đơn hàng **1 sản phẩm/đơn**; `orders.price_at_order INTEGER` = số tiền phải trả.
- **Cả VNPAY IPN (`app/api/payments/vnpay/ipn/route.ts:103`) và SePay webhook (`app/api/payments/sepay/webhook/route.ts:101`) đối soát số tiền nhận được với `order.price_at_order`.**
  → Hệ quả thiết kế: mã giảm giá phải làm cho `price_at_order` = **số tiền cuối cùng sau giảm**, và URL thanh toán / QR phải build bằng đúng số đó. Nhờ vậy webhook/IPN **không phải sửa**.
- Rate limiter in-memory mẫu có sẵn ở `app/api/orders/route.ts:16`.
- RPC atomic mẫu: `supabase/migrations/005_decrement_variant_stock_rpc.sql`.
- CMS `site_content` (bảng key/value) + admin `/admin/noi-dung` — dùng để chứa nội dung popup.
- Sidebar admin: `app/admin/layout.tsx` (mảng `sidebarLinks`).
- Email: `lib/email/templates/new-order.ts`, `customer-order.ts`, wiring ở `lib/email/index.ts`.

---

## 3. Đặc tả tính năng

### F1. Bảng & schema

**3.1. Bảng mới `discount_codes`**

| Cột | Kiểu | Ghi chú |
|---|---|---|
| `id` | uuid PK | `gen_random_uuid()` |
| `code` | text UNIQUE NOT NULL | Lưu & so khớp **UPPERCASE**, trim. Regex `^[A-Z0-9_-]{3,32}$` |
| `description` | text | Ghi chú nội bộ cho admin |
| `discount_type` | text NOT NULL | `CHECK IN ('fixed','percent')` |
| `discount_value` | integer NOT NULL | `fixed` = số VND; `percent` = 1..100 |
| `max_discount_amount` | integer NULL | Trần giảm cho `percent` (VND). Bỏ qua với `fixed` |
| `min_order_amount` | integer NOT NULL DEFAULT 0 | Đơn tối thiểu để áp mã |
| `starts_at` | timestamptz NULL | NULL = có hiệu lực ngay |
| `expires_at` | timestamptz NULL | NULL = không hết hạn |
| `usage_limit` | integer NULL | Tổng lượt tối đa. NULL = không giới hạn |
| `usage_count` | integer NOT NULL DEFAULT 0 | Đếm lượt đã redeem thành công |
| `per_customer_limit` | integer NULL | Số lần tối đa/1 SĐT. NULL = không giới hạn |
| `is_active` | boolean NOT NULL DEFAULT true | Cờ bật/tắt của admin |
| `created_at` / `updated_at` | timestamptz | Trigger `update_updated_at` như các bảng khác |

Index: unique trên `code`; `idx_discount_codes_active` trên `(is_active)`.
RLS: bật, **không** policy public (chỉ service_role đọc/ghi — giống `orders`).

**3.2. Bảng mới `discount_redemptions`** (audit + enforce giới hạn/khách)

| Cột | Kiểu | Ghi chú |
|---|---|---|
| `id` | uuid PK | |
| `discount_code_id` | uuid NOT NULL REFERENCES discount_codes(id) ON DELETE CASCADE | |
| `order_id` | uuid REFERENCES orders(id) ON DELETE SET NULL | |
| `code` | text NOT NULL | Denormalize để tra cứu nhanh |
| `customer_phone` | text NOT NULL | Khoá enforce `per_customer_limit` |
| `amount` | integer NOT NULL | Số tiền đã giảm thực tế (VND) |
| `created_at` | timestamptz NOT NULL DEFAULT now() | |

Index: `idx_redemptions_code_phone` trên `(discount_code_id, customer_phone)`; `idx_redemptions_order` trên `(order_id)`.
RLS: bật, không policy public.

**3.3. Sửa bảng `orders`** — thêm 2 cột:

| Cột | Kiểu | Ghi chú |
|---|---|---|
| `discount_code` | text NULL | Chuỗi mã đã áp (UPPERCASE). NULL = không dùng mã |
| `discount_amount` | integer NOT NULL DEFAULT 0 | Số tiền đã giảm (VND) |

**Quy ước tiền sau V3:**
`price_at_order` = **số tiền khách phải trả** = `giá_sản_phẩm − discount_amount` (≥ 0).
`giá gốc` hiển thị lại = `price_at_order + discount_amount`.
→ Toàn bộ logic build QR / URL thanh toán / đối soát webhook giữ nguyên vì đều bám `price_at_order`.

**3.4. Seed `site_content`** (nội dung popup, admin sửa ở `/admin/noi-dung`):

| key | type | value mặc định |
|---|---|---|
| `exit_offer_enabled` | text | `"true"` |
| `exit_offer_code` | text | `"GIAM50K"` |
| `exit_offer_title` | text | `"Khoan đã! Tặng bạn 50.000₫"` |
| `exit_offer_body` | text | `"Nhập mã bên dưới khi đặt hàng để được giảm ngay 50.000₫ cho đơn đầu tiên."` |
| `exit_offer_cta` | text | `"Dùng mã & đặt hàng"` |

**3.5. Seed mã `GIAM50K`** (migration insert, admin sửa sau):
`discount_type='fixed'`, `discount_value=50000`, `min_order_amount=0`, `per_customer_limit=1`, `is_active=true`, `usage_limit=NULL`, `expires_at=NULL`.

### F2. RPC atomic

**`validate_discount_code(p_code text, p_order_amount int, p_customer_phone text)` → jsonb**
Read-only. Trả `{ valid: bool, reason: text, discount_type, discount_value, discount_amount: int, final_amount: int }`.
Kiểm tra rule (1)–(6) ở §1.2. `discount_amount`:
- `fixed`: `LEAST(discount_value, p_order_amount)`
- `percent`: `LEAST(round(p_order_amount * discount_value / 100.0), COALESCE(max_discount_amount, 2^31))`, và không vượt `p_order_amount`.
`final_amount = p_order_amount - discount_amount` (≥ 0).

**`redeem_discount_code(p_code text, p_order_id uuid, p_order_amount int, p_customer_phone text)` → jsonb**
`SELECT ... FOR UPDATE` dòng mã → chạy lại toàn bộ validate → nếu hợp lệ: `usage_count++`, insert `discount_redemptions`, trả `{ ok, discount_amount, final_amount }`. Nếu không hợp lệ: `RAISE EXCEPTION` (ERRCODE `P0001`) kèm lý do.

**`finalize_discount_redemption(p_order_id uuid)` → void**
Dùng cho VietQR/VNPAY khi `paid`: đọc `orders.discount_code` + `discount_amount` + `customer_phone`; nếu chưa có bản ghi redemption cho `order_id` này → `SELECT ... FOR UPDATE` mã, `usage_count++`, insert redemption. Idempotent (đã có redemption cho order ⇒ no-op).

### F3. API

**`POST /api/discounts/validate`** — public, rate-limit 10/phút/IP.
Body: `{ code: string, order_amount: number }`.
Res 200: `{ valid, discount_amount, final_amount, message }` (gọi RPC `validate_discount_code`, `customer_phone` = `null` ở bước này ⇒ bỏ qua rule per-customer, chỉ cảnh báo mềm).
Res 429 nếu quá rate limit. Không mutate gì.

**Sửa `POST /api/orders`** (`app/api/orders/route.ts`):
- `orderSchema` thêm `discount_code: z.string().trim().toUpperCase().regex(...).max(32).optional()`.
- Sau khi có `product.price`:
  - Nếu có `discount_code` → gọi `validate_discount_code(code, product.price, customer_phone)`.
    - Không hợp lệ → **không** fail đơn theo mặc định? → **Fail có kiểm soát**: trả `422 { error: "Mã giảm giá không hợp lệ", discount_error: reason }` để client hiển thị; khách bỏ mã và đặt lại. (An toàn hơn là âm thầm bỏ mã.)
    - Hợp lệ → `finalPrice = final_amount`; set `discount_code`, `discount_amount`.
  - Không có mã → như cũ.
- `insert` `orders`: `price_at_order = finalPrice`, `discount_code`, `discount_amount`.
- Trừ lượt:
  - COD: gọi `redeem_discount_code(code, order.id, product.price, customer_phone)` ngay sau khi tạo đơn (fail-soft log nếu lỗi, không rollback đơn — mã đã được validate).
  - VietQR/VNPAY: **không** trừ lượt lúc này. Build QR/URL bằng `finalPrice`.
- Cập nhật cả 2 `.select(...)` (POST insert + GET list) thêm `discount_code, discount_amount`.
- GET search: (không bắt buộc) cho phép tìm theo `discount_code`.

**Sửa webhook/IPN** — thêm gọi `finalize_discount_redemption(order.id)` **ngay sau** bước mark `paid` thành công (cạnh chỗ trừ kho):
- `app/api/payments/sepay/webhook/route.ts` (sau bước 9 trừ kho).
- `app/api/payments/vnpay/ipn/route.ts` (sau khi set paid + trừ kho).
- Select của 2 file này thêm `discount_code, discount_amount, customer_phone` nếu chưa có.

**Admin API mới:**
- `GET /api/admin/discounts` → list (kèm `usage_count`, tính `redemptions` nếu cần).
- `POST /api/admin/discounts` → tạo (Zod validate toàn bộ trường; `code` upper+trim; chặn trùng).
- `PATCH /api/admin/discounts/[id]` → sửa (mọi trường trừ `usage_count`, `code` cho sửa nhưng cảnh báo).
- `DELETE /api/admin/discounts/[id]` → xoá (redemptions CASCADE; hoặc chặn xoá nếu `usage_count > 0` → chỉ cho tắt `is_active`. Chốt: **cho xoá**, confirm dialog).
Tất cả yêu cầu `supabase.auth.getUser()` như các route admin khác.

### F4. Frontend — Exit-Intent Popup

`components/marketing/ExitIntentOffer.tsx` (client component), mount trong `app/(site)/layout.tsx` (không mount trong `app/admin`).

Hành vi:
- Fetch nội dung: server component wrapper đọc `site_content` các key `exit_offer_*` rồi truyền xuống (tránh loading flash). Nếu `exit_offer_enabled !== "true"` → render null.
- **Điều kiện hiển thị** (tất cả phải đúng):
  - `localStorage['decoco_exit_offer_v1']` trống hoặc đã quá 7 ngày.
  - Chưa hiện trong phiên (`sessionStorage['decoco_exit_offer_shown']` trống).
  - Route hiện tại không thuộc `{/dat-hang, /thanh-toan, /cam-on}` (và component không tồn tại ở /admin).
  - `sessionStorage['decoco_discount_code']` trống.
- **Trigger**:
  - Desktop (`matchMedia('(pointer:fine)')`): sau 3s, `document.addEventListener('mouseout')` → nếu `!e.relatedTarget && e.clientY <= 0` → mở popup.
  - Mobile: sau 3s, `history.pushState(null,'',location.href)` một lần; `popstate` → mở popup (chặn thoát 1 lần). Nếu popup đang mở mà bấm back tiếp → cho thoát.
- **Nội dung**: tiêu đề, body, mã (hiển thị dạng chip copy được), (tùy chọn) dòng đếm ngược nếu mã có `expires_at`, nút CTA, nút X.
- **CTA click**:
  - `sessionStorage['decoco_discount_code'] = code`.
  - `localStorage['decoco_exit_offer_v1'] = Date.now()` (đóng băng 7 ngày).
  - `router.push('/dat-hang?code=' + encodeURIComponent(code))`.
- **Đóng (X / ESC / click nền)**: set `localStorage['decoco_exit_offer_v1'] = Date.now()` + `sessionStorage['decoco_exit_offer_shown'] = '1'`.
- **A11y**: `role="dialog" aria-modal="true"`, focus vào nút CTA khi mở, bẫy Tab, ESC đóng, overlay click đóng, khoá scroll nền khi mở.

### F5. Frontend — Ô Mã giảm giá tại `/dat-hang`

Sửa `app/(site)/dat-hang/page.tsx`:
- State: `discountCode`, `discountApplied` (`{ code, discount_amount, final_amount } | null`), `discountError`, `discountChecking`.
- **Prefill**: khi mount, đọc `?code=` (qua `useSearchParams`) hoặc `sessionStorage['decoco_discount_code']`; nếu có và `designInfo` đã load → tự gọi validate.
- **UI**: 1 khối "Mã giảm giá" trên phần "Phương thức thanh toán":
  - Chưa áp: `<Input>` + nút "Áp dụng" → `POST /api/discounts/validate { code, order_amount: designInfo.productPrice }`.
  - Áp thành công: hiển thị `✓ Đã áp mã {code} — giảm {formatPrice(discount_amount)}` + nút "Bỏ".
  - Lỗi: dòng đỏ `discountError` (từ `message` của API).
- **Order summary** (cột phải): thêm dòng
  - `Tạm tính` = `productPrice`
  - `Giảm giá ({code})` = `− formatPrice(discount_amount)` (chỉ hiện khi có)
  - `Tổng` = `final_amount` (hoặc `productPrice` nếu chưa áp)
- **Submit**: body `POST /api/orders` thêm `discount_code: discountApplied?.code ?? undefined`. **Không** gửi số tiền giảm (server tự tính lại).
- Nếu API `/api/orders` trả `422` với `discount_error` → hiện lỗi ở khối mã + bỏ trạng thái applied, cho khách bấm đặt lại.
- Nút submit / nhãn số tiền: dùng `final_amount` khi đã áp mã.

### F6. Admin — Menu "Mã giảm giá"

- `app/admin/layout.tsx`: thêm `{ label: "Mã giảm giá", href: "/admin/ma-giam-gia", icon: Ticket }` (lucide `Ticket` hoặc `BadgePercent`).
- `app/admin/ma-giam-gia/page.tsx` (client, mẫu theo `app/admin/san-pham/page.tsx`):
  - Bảng: Mã · Loại (Cố định/Phần trăm) · Giá trị · Đơn tối thiểu · Đã dùng / Giới hạn · Hạn dùng · Trạng thái (badge + toggle) · Actions (Sửa / Xoá).
  - Nút "Tạo mã".
  - Toggle `is_active` gọi PATCH.
  - Xoá → confirm dialog (mẫu `OrderDeleteDialog`).
- `app/admin/ma-giam-gia/DiscountEditDialog.tsx`: form tạo/sửa toàn bộ trường ở §3.1 với `react-hook-form` + `zod` (mẫu `ProductEditDialog.tsx`). Ràng buộc UI: `percent` ⇒ `discount_value` 1..100 + hiện `max_discount_amount`; `fixed` ⇒ ẩn `max_discount_amount`.
- (Tùy chọn) trang chi tiết lượt dùng: cột "Đã dùng" click ra danh sách `discount_redemptions` — **để V-next**, V3 chỉ hiển thị số đếm.

### F7. Email & Admin order views

- `lib/supabase/types.ts`: `Order.Row` thêm `discount_code: string | null`, `discount_amount: number`.
- `lib/email/index.ts` + `templates/new-order.ts` + `templates/customer-order.ts`:
  - `Pick` types thêm `discount_code`, `discount_amount`.
  - Khi `discount_amount > 0`: thêm dòng `Mã giảm giá` = `{discount_code}` và `Giảm giá` = `− {formatPrice(discount_amount)}`; dòng tổng ghi rõ `Giá gốc {formatPrice(price_at_order + discount_amount)} → Thanh toán {formatPrice(price_at_order)}`.
- `app/api/orders/route.ts` GET `.select` + `app/admin/don-hang/page.tsx` & `OrderDetailDialog.tsx`:
  - `OrderRow` Pick thêm `discount_code`, `discount_amount`.
  - Detail dialog: mục "Thông tin đơn" thêm dòng "Mã giảm giá" + "Giảm giá" khi có.
  - List: (tùy chọn) chip `🏷️ {code}` cạnh giá trị.

---

## 4. Env vars

**Không** thêm env mới. Nội dung popup lấy từ `site_content` (seed sẵn qua migration).

---

## 5. Ngoài phạm vi V3

- Cộng dồn nhiều mã trên một đơn.
- Mã theo danh mục / sản phẩm cụ thể (đơn hiện 1 sản phẩm).
- Sinh hàng loạt mã một-lần duy nhất; gửi mã cá nhân hoá qua email.
- Chống multi-account bằng device fingerprint / CAPTCHA.
- A/B testing nội dung popup; lịch chạy campaign; phân tích chuyển đổi.
- Trang chi tiết danh sách lượt redemption trong admin (chỉ hiện số đếm ở V3).
- Popup mobile bằng thuật toán cuộn nâng cao (V3 chỉ back-button trap).
- Hoàn mã khi huỷ đơn đã `paid` (chưa xử lý cộng trả `usage_count`).

---

## 6. Acceptance Criteria

> **Trạng thái 2026-09-04: ĐÃ TRIỂN KHAI.** AC 1, 3, 4, 5, 6, 7, 8 đã xác minh bằng test tự động
> (`scripts/test-discount-logic.mjs` + test RPC atomic trên Supabase) và `npm run build` (AC 9).
> AC 2 (hành vi popup trên trình duyệt) cần smoke test thủ công sau khi deploy.

1. Admin tạo mã `TET2026` loại `percent` 10%, trần 30.000₫, đơn tối thiểu 200.000₫, hạn 7 ngày, giới hạn 100 lượt, 1 lượt/khách → xuất hiện trong bảng, trạng thái Bật.
2. Khách di chuột lên mép trên trình duyệt ở trang chủ → popup 50k hiện ra (chỉ 1 lần; đóng rồi F5 không hiện lại).
3. Bấm CTA trên popup → chuyển tới `/dat-hang?code=GIAM50K`, ô mã tự điền, tự áp, order summary hiện `Giảm giá (GIAM50K) −50.000₫`, `Tổng` giảm đúng.
4. Đặt đơn **COD** với mã hợp lệ → `orders.price_at_order` = giá − 50.000, `discount_code='GIAM50K'`, `discount_amount=50000`; `discount_codes.usage_count +1`; có 1 dòng `discount_redemptions`.
5. Đặt đơn **VietQR** với mã → QR đúng số tiền đã giảm; `usage_count` **chưa** tăng; sau khi webhook `paid` → `usage_count +1` + có `discount_redemptions` (chạy webhook 2 lần không tăng gấp đôi).
6. Nhập mã đã hết hạn / sai / dưới `min_order_amount` → ô mã báo lỗi tiếng Việt rõ ràng, không áp giảm.
7. Khách đã dùng `GIAM50K` (per_customer_limit=1) đặt đơn thứ 2 cùng SĐT với mã đó → bị từ chối ở bước tạo đơn.
8. Email đơn mới + email khách hiển thị dòng mã giảm giá và giá gốc → giá thanh toán.
9. `npm run build` pass; Vercel preview pass.
