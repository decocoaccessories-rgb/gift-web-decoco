-- ============================================================
-- V3 — Mã giảm giá (discount codes) + exit-intent popup content.
--
-- Thiết kế: shop nhỏ, đơn 1 sản phẩm -> 1 bảng discount_codes + 1 bảng
-- audit discount_redemptions. Không có tài khoản user -> giới hạn theo
-- SĐT người đặt (orders.customer_phone).
--
-- Quy ước tiền sau V3:
--   orders.price_at_order = SỐ TIỀN KHÁCH TRẢ (đã trừ giảm giá, >= 0)
--   giá gốc hiển thị lại  = price_at_order + discount_amount
-- Nhờ vậy VNPAY IPN / SePay webhook (đối soát theo price_at_order) giữ nguyên.
-- ============================================================

-- 1. Bảng mã giảm giá -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS discount_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL,                                   -- luôn lưu UPPERCASE, đã trim
  description TEXT,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('fixed', 'percent')),
  discount_value INTEGER NOT NULL CHECK (discount_value >= 0),  -- VND (fixed) hoặc 1..100 (percent)
  max_discount_amount INTEGER CHECK (max_discount_amount IS NULL OR max_discount_amount >= 0), -- trần giảm cho percent
  min_order_amount INTEGER NOT NULL DEFAULT 0 CHECK (min_order_amount >= 0),
  starts_at TIMESTAMPTZ,                                -- NULL = hiệu lực ngay
  expires_at TIMESTAMPTZ,                               -- NULL = không hết hạn
  usage_limit INTEGER CHECK (usage_limit IS NULL OR usage_limit >= 0),  -- NULL = không giới hạn tổng
  usage_count INTEGER NOT NULL DEFAULT 0 CHECK (usage_count >= 0),
  per_customer_limit INTEGER CHECK (per_customer_limit IS NULL OR per_customer_limit >= 0), -- NULL = không giới hạn/khách
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS discount_codes_code_key ON discount_codes (code);
CREATE INDEX IF NOT EXISTS idx_discount_codes_active ON discount_codes (is_active);

DROP TRIGGER IF EXISTS discount_codes_updated_at ON discount_codes;
CREATE TRIGGER discount_codes_updated_at
  BEFORE UPDATE ON discount_codes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE discount_codes ENABLE ROW LEVEL SECURITY;
-- Không policy public: chỉ service_role (admin client) đọc/ghi.

-- 2. Bảng audit + enforce giới hạn -------------------------------------------------
CREATE TABLE IF NOT EXISTS discount_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  discount_code_id UUID NOT NULL REFERENCES discount_codes(id) ON DELETE CASCADE,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  code TEXT NOT NULL,                                   -- denormalize để tra cứu nhanh
  customer_phone TEXT NOT NULL,                         -- khoá enforce per_customer_limit
  amount INTEGER NOT NULL CHECK (amount >= 0),          -- số tiền đã giảm thực tế (VND)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_redemptions_code_phone
  ON discount_redemptions (discount_code_id, customer_phone);
CREATE INDEX IF NOT EXISTS idx_redemptions_order
  ON discount_redemptions (order_id);
-- Chống trừ lượt trùng cho cùng một đơn (VietQR/VNPAY finalize gọi nhiều lần).
CREATE UNIQUE INDEX IF NOT EXISTS discount_redemptions_order_uk
  ON discount_redemptions (order_id)
  WHERE order_id IS NOT NULL;

ALTER TABLE discount_redemptions ENABLE ROW LEVEL SECURITY;

-- 3. orders: 2 cột giảm giá -----------------------------------------------------
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS discount_code TEXT,
  ADD COLUMN IF NOT EXISTS discount_amount INTEGER NOT NULL DEFAULT 0;

-- 4. Nội dung popup exit-intent (CMS site_content) ----------------------------
INSERT INTO site_content (key, value, type, section, label) VALUES
  ('exit_offer_enabled', 'true',                                   'text', 'exit_offer', 'Bật popup ưu đãi rời trang (true/false)'),
  ('exit_offer_code',    'GIAM50K',                                'text', 'exit_offer', 'Mã giảm giá hiển thị trên popup'),
  ('exit_offer_title',   'Khoan đã! Tặng bạn 50.000₫',             'text', 'exit_offer', 'Tiêu đề popup'),
  ('exit_offer_body',    'Nhập mã bên dưới khi đặt hàng để được giảm ngay 50.000₫ cho đơn đầu tiên.', 'text', 'exit_offer', 'Nội dung popup'),
  ('exit_offer_cta',     'Dùng mã & đặt hàng',                     'text', 'exit_offer', 'Nhãn nút CTA popup')
ON CONFLICT (key) DO NOTHING;

-- 5. Seed mã GIAM50K (admin sửa sau) -----------------------------------------
INSERT INTO discount_codes (code, description, discount_type, discount_value, min_order_amount, per_customer_limit, is_active)
VALUES ('GIAM50K', 'Ưu đãi popup rời trang — giảm 50k đơn đầu', 'fixed', 50000, 0, 1, true)
ON CONFLICT (code) DO NOTHING;
