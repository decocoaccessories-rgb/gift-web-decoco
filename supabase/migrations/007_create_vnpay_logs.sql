-- ============================================================
-- Tạo bảng vnpay_logs để đáp ứng yêu cầu lưu trữ log 2 tháng của VNPAY.
-- Lưu cả chiều khởi tạo thanh toán và chiều IPN callback nhận về.
-- ============================================================

CREATE TABLE IF NOT EXISTS vnpay_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    txn_ref TEXT NOT NULL,
    event_type TEXT NOT NULL, -- 'initiate' hoặc 'ipn_received'
    ip_address TEXT NOT NULL,
    payload JSONB NOT NULL,
    response JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Đánh index để truy vấn log nhanh chóng theo mã tham chiếu giao dịch
CREATE INDEX IF NOT EXISTS vnpay_logs_txn_ref_idx ON vnpay_logs(txn_ref);

-- Bật RLS (giống mọi bảng khác). Không tạo policy public:
-- chỉ admin client (service_role, bypass RLS) được ghi/đọc log thanh toán.
-- Ngăn anon key đọc được payload giao dịch + IP từ phía client.
ALTER TABLE vnpay_logs ENABLE ROW LEVEL SECURITY;
