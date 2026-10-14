-- 013_normalize_product_sort_order.sql
-- Chuẩn hoá products.sort_order thành dãy liên tục 0..n-1.
-- Lý do: nhiều sản phẩm đang cùng sort_order = 0 (giá trị DEFAULT), nên thứ tự
-- trả về từ Postgres không xác định -> admin và website có thể hiển thị khác nhau.
-- Thứ tự hiện hành được giữ nguyên tối đa: ưu tiên sort_order cũ, rồi created_at.

WITH ranked AS (
  SELECT
    id,
    (ROW_NUMBER() OVER (ORDER BY sort_order ASC, created_at ASC) - 1)::int AS new_order
  FROM products
)
UPDATE products p
SET sort_order = r.new_order
FROM ranked r
WHERE p.id = r.id
  AND p.sort_order IS DISTINCT FROM r.new_order;
