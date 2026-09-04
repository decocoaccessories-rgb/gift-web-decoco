-- ============================================================
-- Tách thông tin Người gửi (đặt đơn) vs Người nhận (giao hàng).
-- Bối cảnh: DECOCO bán quà tặng bất ngờ. Trước đây form /dat-hang chỉ
-- có 1 cụm `customer_*` nên CSKH gọi xác nhận đơn dễ gọi trúng người
-- nhận -> lộ bí mật tặng quà.
--
-- Quy ước sau migration:
--   customer_*      = NGƯỜI GỬI / người đặt & chi trả (CSKH gọi xác nhận,
--                     nhận email biên nhận). Giữ nguyên ngữ nghĩa cũ.
--   recipient_name  = họ tên NGƯỜI NHẬN quà (shipper giao tới địa chỉ này)
--   recipient_phone = SĐT NGƯỜI NHẬN quà (shipper gọi khi phát hàng)
--   province/address/note = nơi giao hàng của recipient (giữ nguyên).
-- Không thêm recipient_email (người nhận không cần email).
-- ============================================================

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS recipient_name TEXT,
  ADD COLUMN IF NOT EXISTS recipient_phone TEXT;

-- Backfill đơn cũ: coi người nhận trùng người đặt (tương thích ngược 100%).
UPDATE orders
  SET recipient_name = customer_name,
      recipient_phone = customer_phone
  WHERE recipient_name IS NULL;
