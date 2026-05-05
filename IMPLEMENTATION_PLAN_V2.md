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

- [ ] Tạo migration `supabase/migrations/006_add_payment_fields.sql`:
  - `payment_method TEXT NOT NULL DEFAULT 'cod' CHECK IN ('cod','vnpay')`
  - `payment_status TEXT NOT NULL DEFAULT 'pending' CHECK IN ('pending','paid','failed','cancelled')`
  - `vnp_txn_ref TEXT UNIQUE`, `vnp_transaction_no TEXT`, `paid_at TIMESTAMPTZ`
  - Index `orders_vnp_txn_ref_idx`
- [ ] Apply migration lên Supabase
- [ ] `lib/supabase/types.ts` — Order type thêm các field mới
- [ ] Tạo `lib/vnpay.ts`:
  - [ ] `getVnpayClient()` — singleton với `tmnCode`, `secureSecret`, `vnpayHost`, `testMode`
  - [ ] `buildVnpayPaymentUrl({ orderNumber, amount, ipAddr, orderInfo })` — return `{ url, txnRef }`
  - [ ] `verifyVnpayReturn(query)` — return `{ isValid, orderId?, status }`
  - [ ] `verifyVnpayIpn(query)` — return `{ isValid, txnRef, transactionNo, amount, status }`
- [ ] Sửa `app/api/orders/route.ts`:
  - [ ] Zod schema thêm `payment_method: z.enum(['cod','vnpay']).default('cod')`
  - [ ] Sau insert order: if `payment_method === 'vnpay'` → KHÔNG decrement stock; build `vnp_TxnRef = ${orderNumber}-${Date.now().toString(36)}`, update order với `vnp_txn_ref`, gọi `buildVnpayPaymentUrl`, return `{ orderId, orderNumber, paymentUrl }`. Else giữ flow COD cũ.
- [ ] Tạo `app/api/payments/vnpay/return/route.ts` (GET):
  - [ ] `verifyVnpayReturn(searchParams)` → redirect `/cam-on?id=${orderId}&num=${orderNumber}&pay=${success|failed|invalid}`
  - [ ] KHÔNG sửa DB ở đây
- [ ] Tạo `app/api/payments/vnpay/ipn/route.ts` (GET):
  - [ ] `verifyVnpayIpn(searchParams)` → nếu invalid trả `{ RspCode: '97', Message: 'Invalid signature' }`
  - [ ] Lookup order theo `vnp_txn_ref` → nếu không thấy trả `{ RspCode: '01', Message: 'Order not found' }`
  - [ ] Nếu `payment_status === 'paid'` rồi → trả `{ RspCode: '02', Message: 'Order already confirmed' }` (idempotent)
  - [ ] Verify amount khớp `price_at_order * 100` → mismatch trả `{ RspCode: '04', Message: 'Invalid amount' }`
  - [ ] Update `payment_status='paid', vnp_transaction_no, paid_at=now()`, gọi RPC decrement variant stock (hoặc product.stock fallback) → trả `{ RspCode: '00', Message: 'Confirm Success' }`
- [ ] Sửa `app/(site)/dat-hang/page.tsx`:
  - [ ] Thêm `<RadioGroup>` chọn `cod | vnpay` (default cod)
  - [ ] Submit gửi `payment_method`. Nếu response có `paymentUrl` → `window.location.href = paymentUrl`
- [ ] Sửa `app/(site)/cam-on/page.tsx`:
  - [ ] Đọc `?pay=` query param
  - [ ] Banner xanh nếu `success`, đỏ nếu `failed/invalid`, neutral nếu undefined (COD)
  - [ ] Với VNPAY success: hiện thêm "Chúng tôi đang xác nhận giao dịch — bạn sẽ nhận email khi hoàn tất"
- [ ] Sửa admin order list/dialog (`app/admin/don-hang/`):
  - [ ] Cột mới `payment_method` (badge: COD/VNPAY)
  - [ ] Cột mới `payment_status` (pending/paid/failed/cancelled, màu khác nhau)
  - [ ] `payment_status` read-only trong dialog
- [ ] **Test phase 2 trên Vercel preview** (IPN không reach localhost):
  - [ ] Set env vars VNPAY trên Vercel preview env
  - [ ] Đặt đơn VNPAY → redirect sandbox.vnpayment.vn → thẻ NCB `9704198526463749517` OTP `123456`
  - [ ] Verify return về `/cam-on?pay=success`
  - [ ] Verify Vercel logs có IPN call → DB cập nhật `payment_status='paid'`, kho giảm
  - [ ] Test fail: cancel ở gateway → `?pay=failed`, kho không giảm
- [ ] Commit `feat: vnpay qr payment integration` + push

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
