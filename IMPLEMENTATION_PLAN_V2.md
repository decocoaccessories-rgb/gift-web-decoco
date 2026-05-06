# Implementation Plan V2

Đối ứng PRD V2 trong `CLAUDE.md`. Đánh dấu `[x]` khi hoàn thành. Mỗi phase sẽ commit riêng + push để Vercel preview build.

## Phase 0 — Setup

- [ ] `npm i vnpay` (Node.js library cho VNPAY)
- [ ] Cập nhật `.env.local.example` thêm các biến VNPAY + email mới (xem PRD)
- [ ] User cập nhật `.env.local` với credentials sandbox VNPAY thật và `RESEND_API_KEY` thật

## Phase 1 — Per-variant inventory

- [x] Tạo migration `supabase/migrations/005_decrement_variant_stock_rpc.sql` với RPC `decrement_variant_stock(p_product_id uuid, p_variant_id text)` — atomic decrement bằng `jsonb_set` + row lock `FOR UPDATE`
- [x] Apply migration lên Supabase (đã apply qua MCP và test 4 case: decrement OK, out-of-stock raise P0001, variant-not-found raise P0002)
- [x] `lib/supabase/types.ts` — `ProductVariant` thêm `stock?: number`
- [x] `app/api/admin/products/route.ts` — Zod variant schema thêm `stock: z.number().int().min(0).optional()`
- [x] `app/api/admin/products/[id]/route.ts` — cùng update Zod schema
- [x] `app/admin/san-pham/ProductEditDialog.tsx`:
  - [x] Mỗi variant row thêm input number cho `stock`
  - [x] Khi product có ít nhất 1 variant với `stock != null` → disable ô tổng `product.stock` + helper text "Đã quản lý theo phân loại"
- [x] `app/(site)/san-pham/[slug]/ProductInteractive.tsx`:
  - [x] selectedVariant có `stock` → hiển thị tồn kho theo variant; require chọn variant trước khi xem stock
- [x] `app/api/orders/route.ts`:
  - [x] Khi `variant_name` được gửi, lookup variant, gọi RPC `decrement_variant_stock`. Block đơn nếu product managed-by-variant nhưng client không gửi variant_name. Fallback decrement `product.stock` cho product không có variant stock.
- [x] Build pass (`npm run build`)
- [ ] Smoke test trên dev/preview: tạo product 2 variants (kho 3, 5) qua admin, đặt đơn variant A → kho A=2, B=5
- [x] Commit `feat: per-variant inventory` + push

## Phase 2 — VNPAY QR payment

- [x] Tạo migration `supabase/migrations/006_add_payment_fields.sql` (+ apply lên Supabase via MCP)
- [x] `lib/supabase/types.ts` — Order type thêm `payment_method`, `payment_status`, `vnp_txn_ref`, `vnp_transaction_no`, `paid_at`
- [x] `npm i vnpay` (v2.5.0)
- [x] Tạo `lib/vnpay.ts`:
  - [x] `getVnpayClient()` singleton với SHA512 + sandbox auto-detect
  - [x] `buildVnpayPaymentUrl({ txnRef, amount, ipAddr, orderInfo })`
  - [x] `verifyVnpayReturn(query)` và `verifyVnpayIpn(query)`
  - [x] Re-export `IpnSuccess/IpnOrderNotFound/InpOrderAlreadyConfirmed/IpnInvalidAmount/IpnFailChecksum/IpnUnknownError`
- [x] Update `.env.local.example` thêm `VNPAY_TMN_CODE`, `VNPAY_HASH_SECRET`, `VNPAY_HOST`, `VNPAY_RETURN_PATH`, `RESEND_FROM_EMAIL`, `NOTIFICATION_EMAIL`
- [x] Sửa `app/api/orders/route.ts`:
  - [x] Zod schema thêm `payment_method: z.enum(['cod','vnpay']).default('cod')`
  - [x] VNPAY: KHÔNG decrement stock; build txnRef = `${orderNumber}-${base36(now)}`; build payment URL; return `{ orderId, orderNumber, paymentUrl }`. Rollback order khi build URL fail.
- [x] Tạo `app/api/payments/vnpay/return/route.ts` (GET) — verify + redirect `/cam-on?pay=...`, không sửa DB
- [x] Tạo `app/api/payments/vnpay/ipn/route.ts` (GET) — verify + idempotent + amount check + flip paid + decrement stock; trả VNPAY-format response
- [x] Sửa `app/(site)/dat-hang/page.tsx`: radio COD/VNPAY, redirect khi nhận `paymentUrl`, label nút submit động
- [x] Sửa `app/(site)/cam-on/page.tsx`: banner theo `?pay=success|failed|invalid` (mặc định COD)
- [x] Sửa admin order list + dialog: cột "Thanh toán" (method + status badge), dialog show payment_method/status/paid_at
- [x] Build pass (`npm run build`)
- [ ] **Test phase 2 trên Vercel preview** (IPN không reach localhost):
  - [ ] Set env vars VNPAY trên Vercel preview env: `VNPAY_TMN_CODE`, `VNPAY_HASH_SECRET`, `VNPAY_HOST`, `VNPAY_RETURN_PATH`, `NEXT_PUBLIC_APP_URL` (preview URL)
  - [ ] **Quan trọng**: cấu hình IPN URL trên VNPAY merchant portal trỏ tới `${preview-url}/api/payments/vnpay/ipn`
  - [ ] Đặt đơn VNPAY → redirect sandbox.vnpayment.vn → thẻ NCB `9704198526463749517` OTP `123456`
  - [ ] Verify return về `/cam-on?pay=success`
  - [ ] Verify Vercel logs có IPN call → DB cập nhật `payment_status='paid'`, kho giảm
  - [ ] Test fail: cancel ở gateway → `?pay=failed`, kho không giảm
- [x] Commit `feat: vnpay qr payment integration` + push

## Phase 3 — Email thông báo đơn

- [ ] Tạo `lib/email/index.ts`:
  - [ ] Init `new Resend(process.env.RESEND_API_KEY)`
  - [ ] Guard: nếu API key thiếu hoặc là `placeholder_resend_key` → log warning + return
  - [ ] Export `sendNewOrderEmail(order)` — try/catch, gọi `resend.emails.send`
- [ ] Tạo `lib/email/templates/new-order.ts`:
  - [ ] Function `renderNewOrderEmail(order)` → return `{ subject, html }`
  - [ ] Subject: `[DECOCO] Đơn mới #${order_number} — ${customer_name}`
  - [ ] HTML table tiếng Việt với order_number, khách hàng, SĐT, địa chỉ, sản phẩm, variant, giá, payment_method/status, link design, link admin
- [ ] Hook vào `app/api/orders/route.ts`:
  - [ ] Sau khi insert order thành công → `sendNewOrderEmail(order).catch(err => console.error(...))` (await không block lỗi)
- [ ] **Test phase 3**: tạo đơn (COD) → check inbox `decoco.cskh@gmail.com` (kiểm cả Spam vì from `onboarding@resend.dev`); set `RESEND_API_KEY=placeholder_resend_key` → đặt đơn vẫn thành công, log warning
- [ ] Commit `feat: order notification email via resend` + push

## Phase 4 — QA & Deploy

- [ ] `npm run build` pass (TypeScript clean)
- [ ] Manual smoke test trên dev cho cả 3 features (variant stock, VNPAY trên preview, email)
- [ ] Verify trên Vercel preview URL trước khi config production env
- [ ] User cập nhật env production trên Vercel khi sẵn sàng go-live
- [ ] Tạo PR (hoặc merge thẳng master nếu workflow là trunk-based)

---

## Test data tham khảo

**VNPAY sandbox card test (NCB)**:
- Số thẻ: `9704198526463749517`
- Tên: `NGUYEN VAN A`
- Ngày phát hành: `07/15`
- OTP: `123456`

**Tài liệu**:
- VNPAY sandbox: https://sandbox.vnpayment.vn/apis/
- vnpay npm lib: https://vnpay.js.org/en/
- Resend Next.js: https://resend.com/docs/send-with-nextjs
