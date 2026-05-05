@AGENTS.md

# Product Requirements Document (PRD)

## V2 — Per-Variant Inventory, VNPAY QR Payment, Order Notification Email

Phiên bản V2 bổ sung 3 năng lực để chuyển DECOCO Web từ MVP-COD-only sang nền tảng vận hành thật. Phần này là PRD; Implementation Plan dạng checkbox nằm ở `IMPLEMENTATION_PLAN_V2.md`.

### F1. Tồn kho theo phân loại (Per-Variant Inventory)

**Vấn đề hiện tại**: `products.stock INTEGER` là duy nhất; mỗi sản phẩm chỉ có một con số tồn kho dù có nhiều phân loại (variants) khác nhau (vd. "Vàng hồng", "Bạc"). Admin không thể quản lý chính xác số lượng từng màu/loại.

**Mục tiêu**: Cho admin điền tồn kho riêng cho từng variant trong dialog "Sửa sản phẩm" và để hệ thống trừ kho theo variant khi có đơn.

**Schema**: variant JSONB shape mở rộng từ `{ id, name, image_url }` thành `{ id, name, image_url, stock?: number }`. Field `stock` optional để backwards-compatible với products cũ.

**Hành vi nghiệp vụ**:
- Khi product có ít nhất một variant với `stock` được định nghĩa → product được coi là "quản lý theo phân loại". Ô tổng `product.stock` bị ẩn/disabled trong admin UI và **bỏ qua** ở runtime.
- Khi product không có variant nào hoặc tất cả variant đều thiếu `stock` → giữ flow cũ (dùng `product.stock`).
- Trang sản phẩm (`/san-pham/[slug]`): hiển thị tồn kho/sold-out theo variant đang chọn.
- Tạo đơn: nếu request có `variant_name`, lookup variant tương ứng, kiểm tra `variant.stock > 0`, decrement variant trong JSONB. Atomic decrement qua Postgres RPC để tránh race condition.

### F2. Thanh toán VNPAY QR

**Vấn đề hiện tại**: chỉ COD; không có cổng thanh toán online.

**Mục tiêu**: bổ sung lựa chọn thanh toán qua VNPAY (QR/ATM/Visa) song song với COD. Giai đoạn 1 dùng sandbox; chuyển production qua biến env.

**Luồng**:
1. Khách chọn `VNPAY` ở `/dat-hang` → POST `/api/orders` với `payment_method='vnpay'`.
2. Server tạo order với `payment_status='pending'`, sinh `vnp_TxnRef` unique, gọi `buildPaymentUrl` → trả `paymentUrl`.
3. Client redirect sang `paymentUrl` (cổng VNPAY).
4. Khách thanh toán xong, VNPAY redirect về `/api/payments/vnpay/return` → verify chữ ký, redirect tiếp `/cam-on?id=...&pay=success|failed`.
5. **Song song**: VNPAY gọi IPN `/api/payments/vnpay/ipn` (server-to-server). IPN handler verify chữ ký, kiểm amount khớp DB, idempotent update `payment_status='paid'`, decrement stock, trả `{ RspCode, Message }` theo spec.

**Quy tắc bắt buộc** (theo best practices VNPAY):
- IPN là source-of-truth duy nhất cho việc mark order paid; return URL không được tin.
- Verify amount returned khớp `price_at_order * 100`.
- IPN handler phải idempotent (lookup theo `vnp_txn_ref`, nếu đã `paid` trả `RspCode 02`).
- `secureSecret` chỉ ở server; không bao giờ ship ra client.
- Sandbox: `vnpayHost=https://sandbox.vnpayment.vn`, `testMode=true`.

**Schema thay đổi** (`orders`):
- `payment_method TEXT NOT NULL DEFAULT 'cod'` ∈ `{cod, vnpay}`
- `payment_status TEXT NOT NULL DEFAULT 'pending'` ∈ `{pending, paid, failed, cancelled}`
- `vnp_txn_ref TEXT UNIQUE`, `vnp_transaction_no TEXT`, `paid_at TIMESTAMPTZ`

**Stock decrement timing**:
- COD: trừ kho khi tạo đơn (như hiện tại).
- VNPAY: trừ kho khi IPN xác nhận `paid`. Đơn chưa thanh toán không trừ kho (tránh giữ chỗ ảo). Cleanup tự huỷ đơn pending → out-of-scope V2.

### F3. Email thông báo đơn mới

**Vấn đề hiện tại**: Resend đã có trong `package.json` nhưng zero usage; admin không biết khi có đơn mới ngoài việc check thủ công.

**Mục tiêu**: Sau mỗi lần tạo đơn thành công, gửi email thông báo tới `decoco.cskh@gmail.com`.

**Trigger**: Sau insert order thành công trong `app/api/orders/route.ts` (cả COD lẫn VNPAY). VNPAY paid event không gửi email lần đầu V2 — out-of-scope.

**Format**: subject `[DECOCO] Đơn mới #${order_number} — ${customer_name}`; body HTML table tiếng Việt liệt kê: order_number, khách hàng, SĐT, địa chỉ, sản phẩm, variant, giá, payment_method, payment_status, link ảnh design, link admin.

**Fail-soft**: Email thất bại (Resend timeout, sai key, network) **không** được làm fail order. Wrap try/catch, chỉ log warning. Nếu `RESEND_API_KEY` là placeholder hoặc thiếu → skip gửi và log.

**FROM/TO**: `RESEND_FROM_EMAIL=onboarding@resend.dev` (tạm cho dev/test) → `NOTIFICATION_EMAIL=decoco.cskh@gmail.com`. Production cần verify domain `decoco.vn` (out-of-scope V2).

### Env vars mới (V2)

```
# VNPAY
VNPAY_TMN_CODE=
VNPAY_HASH_SECRET=
VNPAY_HOST=https://sandbox.vnpayment.vn
VNPAY_RETURN_URL=http://localhost:3000/api/payments/vnpay/return

# Email
RESEND_FROM_EMAIL=onboarding@resend.dev
NOTIFICATION_EMAIL=decoco.cskh@gmail.com
```

(Đã có sẵn từ V1: `RESEND_API_KEY`, `NEXT_PUBLIC_APP_URL`, `ADMIN_EMAIL`, Supabase keys.)

### Out-of-scope V2

- Refund / hoàn tiền VNPAY.
- Cron tự huỷ đơn VNPAY pending quá X giờ.
- Cổng thanh toán khác (MoMo, ZaloPay, Payoo).
- Email đa ngôn ngữ; React Email templates.
- Verify domain `decoco.vn` cho Resend production.
- Hiển thị QR ngay trên `/cam-on` (đã chốt phương án redirect gateway).

### Acceptance criteria

- Admin có thể tạo product 2 variants với tồn kho 3 và 5 → trang `/san-pham/[slug]` hiển thị đúng theo variant chọn → đặt đơn variant A → kho A=2, B=5.
- Khách chọn VNPAY → redirect sandbox VNPAY → thanh toán bằng thẻ test NCB → return `/cam-on?pay=success` → IPN cập nhật `payment_status='paid'` và decrement kho variant.
- Mỗi đơn mới (COD hoặc VNPAY) → `decoco.cskh@gmail.com` nhận email trong vòng vài giây.
- `npm run build` pass; Vercel preview build pass.
