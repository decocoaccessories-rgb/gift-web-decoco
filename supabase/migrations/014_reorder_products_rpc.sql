-- 014_reorder_products_rpc.sql
--
-- Ghi lại thứ tự sản phẩm trong MỘT câu lệnh duy nhất.
--
-- Lý do: `/api/admin/products/reorder` trước đây phát N câu UPDATE riêng lẻ bằng
-- Promise.all. Khi admin kéo thả vài lần liên tiếp, hai request chồng nhau và các
-- UPDATE của chúng xen kẽ -> mỗi hàng nhận giá trị của request đáp sau, kết quả là
-- hai snapshot bị trộn vào nhau, sinh sort_order trùng và có lỗ
-- (quan sát thật 14/10/2026: 0,0,0,1,2,3,4,5,6,7,8,11,12).
-- Một UPDATE ... FROM là một câu lệnh, chạy trong một transaction ngầm, nên request
-- hoặc áp dụng trọn vẹn hoặc không áp dụng gì — không còn trạng thái dở dang.

CREATE OR REPLACE FUNCTION reorder_products(items jsonb)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  updated_count integer;
BEGIN
  IF jsonb_typeof(items) <> 'array' THEN
    RAISE EXCEPTION 'items phải là một mảng JSON';
  END IF;

  UPDATE products p
  SET sort_order = v.sort_order,
      updated_at = now()
  FROM (
    SELECT (e->>'id')::uuid AS id,
           (e->>'sort_order')::int AS sort_order
    FROM jsonb_array_elements(items) AS e
  ) AS v
  WHERE p.id = v.id;

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;

-- Chỉ service role gọi (route handler đã tự xác thực admin trước khi gọi).
REVOKE ALL ON FUNCTION reorder_products(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION reorder_products(jsonb) FROM anon;
REVOKE ALL ON FUNCTION reorder_products(jsonb) FROM authenticated;
GRANT EXECUTE ON FUNCTION reorder_products(jsonb) TO service_role;
