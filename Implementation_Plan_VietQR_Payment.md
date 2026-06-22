# Implementation Plan: VietQR Auto-Confirm Payment cho DECOCO Web

**Dự án:** gift-web-decoco (DECOCO Web)
**Stack hiện tại:** Next.js (App Router) · Supabase (DB/Auth/Storage) · Resend (email) · VNPAY (payment) · Vercel (hosting)
**Mục tiêu:** Bổ sung phương thức thanh toán "Chuyển khoản VietQR tự động xác nhận" bên cạnh VNPAY hiện có. Khách quét QR, chuyển khoản đúng nội dung → đơn hàng tự chuyển trạng thái "Đã thanh toán" không cần thao tác thủ công.

---

## ⚠️ REVIEW & CORRECTIONS (đã đối chiếu codebase thực tế — 2026-06-22)

Sau khi khảo sát codebase (`app/api/orders/route.ts`, `app/api/payments/vnpay/*`, `lib/email`, `supabase/migrations/006/007`, checkout `app/(site)/dat-hang/page.tsx`), các điều chỉnh sau **thay thế** mô tả gốc bên dưới khi có mâu thuẫn:

1. **Mã đơn dùng làm nội dung CK (mục 1.4):** `order_number` thực tế = `DCO-20240427-A3B2` (`generateOrderNumber()` trong `lib/utils.ts`) — **có dấu `-`** mà nhiều ngân hàng loại bỏ/biến đổi. → Chuẩn hoá thành dạng alphanumeric `DCO20240427A3B2` (hàm `normalizeOrderRef`) dùng cho cả QR `des` và khi match webhook (regex `DCO\d{8}[A-Z0-9]{4}` trên content đã chuẩn hoá).

2. **`payment_method` (mục 3.1):** CHECK constraint hiện tại là `('cod','vnpay')`. Phải **DROP + ADD** lại thành `('cod','vnpay','vietqr')` (giữ `cod`, plan gốc bỏ sót).

3. **Không tạo kiến trúc song song (tuân thủ mục 0.3):** VNPAY build payment URL **ngay trong `POST /api/orders`**. → KHÔNG tạo `/api/payment/vietqr/create` nhận `order_id`. Thay vào đó tích hợp tạo QR vào chính `POST /api/orders` (giống VNPAY), trả về `{ orderId, orderNumber, vietqr: { qrUrl, amount, content, expiresAt } }`.

4. **Tạo QR không cần gọi API/không cần API key:** SePay cấp ảnh QR qua URL tĩnh `https://qr.sepay.vn/img?acc=...&bank=...&amount=...&des=...`. API key của SePay chỉ dùng để **verify webhook** (header `Authorization: Apikey <key>`). Bỏ bước "gọi VietQR API".

5. **Realtime → Polling là primary:** Bảng `orders` có RLS, anon key không đọc được đơn → Realtime cần cấu hình RLS/publication phức tạp và rủi ro. Dùng **polling** `GET /api/payments/vietqr/status/[orderId]` (admin client server-side, chỉ trả các field cần) làm cơ chế chính. Realtime để out-of-scope.

6. **Webhook khi `paid` phải mirror VNPAY IPN:** decrement tồn kho (variant qua RPC `decrement_variant_stock`, hoặc `products.stock`) **và** gửi email (fail-soft). Plan gốc mô tả mơ hồ "trigger tác vụ sau thanh toán".

7. **Bỏ `payment_status='expired'`:** QR hết hạn chỉ là countdown phía UI; đơn vẫn ở `pending`. Tránh đụng CHECK constraint của `payment_status`. Webhook vẫn auto-confirm nếu đơn còn `pending` + đúng số tiền (kể cả CK trễ) để không bỏ sót đơn đã trả.

8. **Đường dẫn webhook:** đặt dưới `app/api/payments/sepay/webhook/route.ts` (đồng bộ với cụm `payments/` của VNPAY) thay vì `/api/webhook/sepay`.

9. **An toàn production:** Tài khoản SePay + API key + số TK ngân hàng (Phase 0) là việc của Hưng, chưa có lúc code. → Lựa chọn VietQR ở checkout được **gate sau cờ `NEXT_PUBLIC_VIETQR_ENABLED`** (mặc định off). Khi Hưng điền env + bật cờ thì tính năng mới hiện cho khách. Code đã sẵn sàng, dormant cho tới lúc đó.

10. **Idempotency:** dùng cột `provider_transaction_id` UNIQUE trong `payment_webhook_logs` (= field `id` của SePay). Webhook luôn insert log trước, gặp duplicate trả 200 ngay.

---

## 0. Việc đầu tiên Claude Code phải làm

Trước khi viết bất kỳ dòng code nào:

1. Đọc `README.md` và `SESSION_HANDOFF.md` của project để nắm context hiện tại.
2. Khảo sát schema Supabase hiện có của bảng đơn hàng (orders) — tên bảng, tên cột, kiểu enum trạng thái thanh toán đang dùng.
3. Khảo sát cách VNPAY đang được implement (route nào tạo payment, route callback/IPN nào xử lý kết quả) để giữ pattern nhất quán — KHÔNG tạo kiến trúc song song khác biệt không cần thiết.
4. Xác nhận lại với Hưng các quyết định ở mục 1 dưới đây trước khi code phần backend/webhook (vì các quyết định này quyết định toàn bộ schema và logic).

---

## 1. Quyết định cần xác nhận trước khi bắt đầu

| # | Quyết định | Đề xuất (mặc định nếu không có ý kiến khác) | Vì sao |
|---|---|---|---|
| 1 | Nhà cung cấp trung gian webhook | **SePay** | Tài liệu rõ, tích hợp nhanh (~30 phút theo docs), free tier 500 giao dịch/tháng, hỗ trợ 51 ngân hàng |
| 2 | Tài khoản ngân hàng nhận tiền | Cần Hưng xác nhận: cá nhân hay tài khoản doanh nghiệp gắn MST | Ảnh hưởng cách đăng ký với SePay và đối soát kế toán sau này, đặc biệt khi HKD có thể chuyển đổi mô hình |
| 3 | VietQR có thay thế VNPAY không | **Không** — đây là kênh bổ sung, VNPAY giữ nguyên để xử lý thanh toán thẻ | Mỗi kênh phục vụ nhu cầu khác nhau |
| 4 | Format mã đơn hàng dùng làm nội dung chuyển khoản | Cần Claude Code lấy theo format ID đơn hàng hiện có trong DB (ví dụ `DH{order_id}`), không tạo format mới | Tránh hai hệ thống mã đơn hàng song song |

Nếu sau này muốn đổi sang payOS (Casso) thay vì SePay, chỉ cần thay phần "Provider Adapter" ở mục 4 — phần còn lại của kiến trúc không đổi (đây là lý do thiết kế tách lớp provider riêng).

---

## 2. Kiến trúc tổng thể

```
[Khách hàng]                [DECOCO Web - Next.js]              [SePay]            [Ngân hàng]
     |                              |                              |                    |
     | 1. Chọn "Thanh toán VietQR"  |                              |                    |
     |----------------------------->|                              |                    |
     |                              | 2. POST /api/payment/vietqr/create
     |                              |    - Tạo order pending trong Supabase
     |                              |    - Gọi VietQR API tạo ảnh QR (amount + content = mã đơn)
     |                              |                              |                    |
     | 3. Hiển thị QR + countdown   |                              |                    |
     |<-----------------------------|                              |                    |
     |                              |                              |                    |
     | 4. Quét QR, chuyển khoản     |                              |                    |
     |------------------------------------------------------------------------------------>|
     |                              |                              | 5. Phát hiện biến  |
     |                              |                              |    động số dư      |
     |                              |                              |<--------------------|
     |                              | 6. POST /api/webhook/sepay  |                    |
     |                              |<-----------------------------|                    |
     |                              | 7. Verify signature          |                    |
     |                              | 8. Parse content, match order |                   |
     |                              | 9. Update Supabase: status=paid|                  |
     |                              |                              |                    |
     | 10. Frontend nhận update qua  |                              |                    |
     |     Supabase Realtime         |                              |                    |
     |<-----------------------------|                              |                    |
     | 11. Chuyển sang trang "Thành công" |                        |                    |
```

---

## 3. Thiết kế dữ liệu (Supabase)

> Claude Code cần điều chỉnh tên cột cho khớp với schema thực tế của bảng orders hiện có. Dưới đây là cấu trúc đề xuất.

### 3.1 Bổ sung cột vào bảng `orders`

| Cột | Kiểu | Mô tả |
|---|---|---|
| `payment_method` | `text` (enum: `vnpay`, `vietqr`) | Phân biệt kênh thanh toán |
| `vietqr_content` | `text` | Nội dung chuyển khoản dùng để match (= mã đơn hàng) |
| `vietqr_qr_url` | `text` | URL ảnh QR đã tạo (cache, tránh gọi lại API nhiều lần) |
| `vietqr_expires_at` | `timestamptz` | Thời điểm QR hết hạn (mặc định now() + 15 phút) |
| `payment_status` | giữ enum hiện có, thêm giá trị `pending`, `paid`, `expired` nếu chưa có |

### 3.2 Bảng mới: `payment_webhook_logs`

Mục đích: audit trail, debug, và chống xử lý trùng (idempotency).

| Cột | Kiểu | Mô tả |
|---|---|---|
| `id` | `uuid` (PK) | |
| `provider` | `text` | `sepay` |
| `provider_transaction_id` | `text` (unique) | ID giao dịch do SePay cấp — dùng để chống duplicate |
| `raw_payload` | `jsonb` | Toàn bộ payload webhook nhận được |
| `matched_order_id` | `uuid` (FK → orders, nullable) | Null nếu không match được đơn nào |
| `match_status` | `text` (enum: `matched`, `unmatched`, `amount_mismatch`) | |
| `created_at` | `timestamptz` | |

**Lý do bắt buộc có bảng này:** nếu thiếu, không có cách nào điều tra khi khách báo "đã chuyển tiền nhưng web không nhận", và không chống được việc 1 giao dịch bị webhook gọi 2 lần làm trừ kho/gửi email 2 lần.

---

## 4. API Endpoints cần xây dựng

### 4.1 `POST /api/payment/vietqr/create`
- Input: `order_id`
- Xử lý:
  - Lấy order từ Supabase, kiểm tra status đang `pending` và chưa có QR còn hạn
  - Gọi VietQR API (https://api.vietqr.io/v2/generate hoặc endpoint tương ứng của SePay) với: số tài khoản, số tiền = `order.total`, nội dung = mã đơn hàng
  - Lưu `vietqr_qr_url`, `vietqr_content`, `vietqr_expires_at` vào order
- Output: URL ảnh QR, số tiền, nội dung, thời gian hết hạn

### 4.2 `POST /api/webhook/sepay`
- Đây là endpoint public, KHÔNG có session người dùng — bảo mật hoàn toàn dựa vào verify signature/API key (xem mục 6)
- Xử lý:
  1. Verify request đến từ SePay (header Authorization theo API key, xem docs.sepay.vn)
  2. Insert raw payload vào `payment_webhook_logs` trước tiên (luôn lưu, dù match được hay không)
  3. Kiểm tra `provider_transaction_id` đã xử lý trước đó chưa → nếu có, return 200 ngay, không xử lý lại (idempotency)
  4. Parse `description` để tìm mã đơn hàng (regex theo format đã thống nhất ở mục 1.4)
  5. Tìm order tương ứng còn `pending` và chưa hết hạn
  6. So khớp số tiền:
     - Khớp chính xác → update `payment_status = paid`, trigger gửi email xác nhận (Resend), trigger các tác vụ sau thanh toán hiện có (giống flow VNPAY)
     - Không khớp số tiền hoặc không tìm thấy order → ghi log `unmatched`/`amount_mismatch`, KHÔNG tự động xác nhận, để CSKH xử lý thủ công
  7. Luôn trả về `200 OK` cho SePay (tránh SePay retry liên tục), bất kể match được hay không

### 4.3 `GET /api/payment/vietqr/status/[orderId]`
- Dùng làm fallback polling nếu Supabase Realtime không khả dụng ở client
- Trả về `payment_status` hiện tại của order

---

## 5. Frontend

### 5.1 Component `VietQRPayment`
- Hiển thị: ảnh QR, mã đơn hàng, số tiền, đồng hồ đếm ngược (giống mẫu tham khảo), hướng dẫn 3 bước thanh toán
- Subscribe Supabase Realtime vào thay đổi của order đó (`payment_status`) → tự động chuyển trang khi nhận được `paid`
- Fallback: nếu Realtime không kết nối được, polling `GET /api/payment/vietqr/status/[orderId]` mỗi 3-5 giây
- Khi hết hạn (countdown = 0): disable QR, hiển thị nút "Tạo lại mã QR mới"

---

## 6. Bảo mật

- **Verify webhook signature/API key:** không xử lý bất kỳ request nào không xác thực được nguồn gốc từ SePay. Tham khảo `docs.sepay.vn` phần xác thực webhook (Authorization header dạng `Apikey {key}`).
- **Idempotency:** bắt buộc theo mục 4.2 bước 3, tránh xử lý trùng giao dịch.
- **Không match chỉ theo số tiền khi không có mã đơn hàng rõ ràng trong content** — rủi ro 2 đơn hàng trùng số tiền sẽ bị gán nhầm. Trường hợp này luôn để trạng thái `unmatched` cho người xử lý thủ công, không cố "đoán" đơn.
- **Rate limit endpoint webhook** ở mức hợp lý để chống spam giả mạo, nhưng không chặn nhầm traffic thật từ SePay.
- **Không log thông tin tài khoản/CCCD của khách chuyển khoản** ra ngoài hệ thống log thông thường — chỉ lưu trong `payment_webhook_logs` (nội bộ, không public).
- Biến môi trường chứa API key/secret tuyệt đối không hardcode, chỉ qua biến môi trường Vercel.

---

## 7. Biến môi trường cần thêm

```
SEPAY_API_KEY=
SEPAY_WEBHOOK_SECRET=
SEPAY_BANK_ACCOUNT_NUMBER=
SEPAY_BANK_NAME=
VIETQR_DEFAULT_EXPIRE_MINUTES=15
```

---

## 8. Edge cases bắt buộc xử lý

| Tình huống | Xử lý |
|---|---|
| Webhook gọi 2 lần cho cùng giao dịch | Idempotency theo `provider_transaction_id` |
| Khách chuyển thiếu/dư tiền | Không tự confirm, ghi `amount_mismatch`, để CSKH xử lý |
| Khách chuyển đúng tiền nhưng sai/thiếu nội dung | Không tự match theo amount đơn lẻ (rủi ro nhầm đơn) — log `unmatched`, CSKH tra cứu qua dashboard SePay |
| QR đã hết hạn nhưng khách vẫn chuyển sau đó | Webhook vẫn đến — vẫn nên xử lý thủ công, không tự động hủy hoặc tự động hoàn tiền |
| Order đã bị huỷ/đã thanh toán qua VNPAY trước khi webhook VietQR đến (race condition) | Kiểm tra status hiện tại của order trước khi update, không override trạng thái `paid`/`cancelled` đã có |
| Webhook endpoint downtime tạm thời | SePay tự động retry theo cơ chế của họ — vẫn cần có cách đối soát thủ công qua dashboard SePay (my.sepay.vn → Giao dịch) cho trường hợp lệch sót |

---

## 9. Kế hoạch triển khai theo phase

- **Phase 0 — Setup tài khoản:** Hưng đăng ký SePay, liên kết tài khoản ngân hàng, lấy API key (việc này KHÔNG thuộc phạm vi Claude Code, cần làm trước)
- **Phase 1 — Database:** Migration thêm cột/bảng theo mục 3
- **Phase 2 — Backend tạo QR:** Endpoint `POST /api/payment/vietqr/create`
- **Phase 3 — Backend webhook:** Endpoint `POST /api/webhook/sepay` + toàn bộ logic matching/idempotency ở mục 4.2
- **Phase 4 — Frontend:** Component `VietQRPayment` + tích hợp vào trang checkout hiện có (thêm lựa chọn phương thức thanh toán)
- **Phase 5 — Test:** Theo checklist mục 10, dùng giao dịch thật số tiền nhỏ (SePay không có sandbox giả lập đầy đủ, cần test bằng giao dịch thật)
- **Phase 6 — Hardening:** Rate limit, review lại bảo mật webhook
- **Phase 7 — Deploy & theo dõi:** Deploy lên Vercel, theo dõi `payment_webhook_logs` trong 1-2 tuần đầu để bắt các trường hợp `unmatched` bất thường

---

## 10. Testing checklist

- [ ] Tạo order → tạo QR → QR hiển thị đúng số tiền, đúng nội dung
- [ ] Chuyển khoản thật đúng nội dung, đúng số tiền → order tự chuyển `paid` trong vài giây, frontend tự cập nhật không cần reload
- [ ] Webhook gọi trùng 2 lần (giả lập lại cùng payload) → không bị xử lý 2 lần, không gửi email xác nhận 2 lần
- [ ] Chuyển khoản sai nội dung → order vẫn ở trạng thái pending, log ghi `unmatched`
- [ ] Chuyển khoản thiếu tiền → log ghi `amount_mismatch`, không tự confirm
- [ ] QR hết hạn → frontend hiển thị nút tạo lại, không tự động xử lý chuyển khoản trễ thành "thành công" ngay lập tức (vẫn vào log để xử lý tay)
- [ ] Webhook giả (không đúng signature) → bị từ chối, không update bất kỳ order nào
- [ ] Kiểm tra song song: order thanh toán qua VNPAY không bị ảnh hưởng bởi flow VietQR mới

---

## 11. Tài liệu tham khảo

- SePay docs: https://docs.sepay.vn
- VietQR (NAPAS) chuẩn QR: https://vietqr.io
- payOS (phương án thay thế nếu cần): https://payos.vn

---

*File này là tài liệu kỹ thuật để giao cho Claude Code thực hiện. Trước khi code Phase 2-3, Claude Code cần xác nhận lại với Hưng các quyết định ở mục 1 nếu có điểm chưa rõ trong codebase hiện tại.*
