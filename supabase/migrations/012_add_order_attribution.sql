-- ============================================================
-- Ghi nguồn marketing (first-touch) vào từng đơn hàng.
--
-- Bối cảnh: khách vào từ link bio TikTok mở trong in-app browser, thường bị
-- đẩy sang trình duyệt ngoài giữa chừng → phiên GA4 đứt, đơn bị GA4 tính về
-- (direct)/(none). Client lưu utm_* / referrer theo first-touch ở localStorage
-- rồi gửi kèm khi tạo đơn; các cột dưới đây lưu lại để Admin đối chiếu nguồn
-- đơn độc lập với GA4.
--
-- Tất cả nullable — đơn không có tham số nguồn (gõ tay URL, khách cũ) để NULL.
-- ============================================================

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS utm_source   TEXT,
  ADD COLUMN IF NOT EXISTS utm_medium   TEXT,
  ADD COLUMN IF NOT EXISTS utm_campaign TEXT,
  ADD COLUMN IF NOT EXISTS utm_term     TEXT,
  ADD COLUMN IF NOT EXISTS utm_content  TEXT,
  ADD COLUMN IF NOT EXISTS referrer     TEXT,
  ADD COLUMN IF NOT EXISTS landing_page TEXT;

-- Lọc/nhóm đơn theo chiến dịch trong Admin.
CREATE INDEX IF NOT EXISTS orders_utm_source_idx
  ON orders(utm_source)
  WHERE utm_source IS NOT NULL;

CREATE INDEX IF NOT EXISTS orders_utm_campaign_idx
  ON orders(utm_campaign)
  WHERE utm_campaign IS NOT NULL;
