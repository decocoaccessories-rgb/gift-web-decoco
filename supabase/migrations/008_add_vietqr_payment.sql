-- ============================================================
-- VietQR (SePay) auto-confirm payment.
-- Bổ sung phương thức 'vietqr' bên cạnh 'cod' / 'vnpay'.
-- Đơn vietqr tạo ở payment_status='pending', flip sang 'paid' qua
-- webhook SePay (server-to-server). Trừ kho tại thời điểm 'paid'
-- (giống VNPAY IPN), không trừ lúc tạo đơn.
-- ============================================================

-- 1. Mở rộng CHECK constraint của payment_method để chấp nhận 'vietqr'.
--    Constraint cũ do migration 006 sinh tự động tên 'orders_payment_method_check'.
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_payment_method_check;
ALTER TABLE orders
  ADD CONSTRAINT orders_payment_method_check
  CHECK (payment_method IN ('cod', 'vnpay', 'vietqr'));

-- 2. Các cột phục vụ VietQR.
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS vietqr_content TEXT,        -- mã đơn đã chuẩn hoá dùng để match (vd DCO20240427A3B2)
  ADD COLUMN IF NOT EXISTS vietqr_qr_url TEXT,         -- URL ảnh QR đã tạo (cache)
  ADD COLUMN IF NOT EXISTS vietqr_expires_at TIMESTAMPTZ; -- countdown phía UI (đơn vẫn pending khi quá hạn)

-- Index để webhook tra cứu đơn theo nội dung chuyển khoản đã chuẩn hoá.
CREATE INDEX IF NOT EXISTS orders_vietqr_content_idx
  ON orders(vietqr_content)
  WHERE vietqr_content IS NOT NULL;

-- 3. Bảng audit + idempotency cho webhook thanh toán (SePay/…).
CREATE TABLE IF NOT EXISTS payment_webhook_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider TEXT NOT NULL,                              -- 'sepay'
    provider_transaction_id TEXT,                        -- id giao dịch do provider cấp (chống trùng)
    raw_payload JSONB NOT NULL,                          -- toàn bộ payload webhook
    matched_order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
    match_status TEXT NOT NULL,                          -- matched | unmatched | amount_mismatch | duplicate | unverified
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Chống xử lý trùng: 1 giao dịch provider chỉ được ghi nhận 1 lần.
CREATE UNIQUE INDEX IF NOT EXISTS payment_webhook_logs_provider_tx_idx
  ON payment_webhook_logs(provider, provider_transaction_id)
  WHERE provider_transaction_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS payment_webhook_logs_order_idx
  ON payment_webhook_logs(matched_order_id);

-- RLS bật, không tạo policy public: chỉ service_role (admin client) đọc/ghi.
-- Ngăn anon key đọc payload giao dịch của khách.
ALTER TABLE payment_webhook_logs ENABLE ROW LEVEL SECURITY;
