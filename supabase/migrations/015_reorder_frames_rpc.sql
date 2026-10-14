-- 015_reorder_frames_rpc.sql
--
-- Áp đúng bản sửa của migration 014 sang bảng `frames`.
--
-- `/api/admin/frames/reorder` mắc y hệt lỗi của route sản phẩm: Promise.all phát
-- N câu UPDATE rời rạc, nên khi admin kéo thả nhiều lần liên tiếp trong
-- /admin/khung, các UPDATE của hai request xen kẽ và trộn hai snapshot vào nhau,
-- sinh sort_order trùng + có lỗ. Một UPDATE ... FROM là một câu lệnh nên request
-- hoặc áp dụng trọn vẹn, hoặc không áp dụng gì.

CREATE OR REPLACE FUNCTION reorder_frames(items jsonb)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  updated_count integer;
BEGIN
  IF jsonb_typeof(items) <> 'array' THEN
    RAISE EXCEPTION 'items phải là một mảng JSON';
  END IF;

  UPDATE frames f
  SET sort_order = v.sort_order
  FROM (
    SELECT (e->>'id')::uuid AS id,
           (e->>'sort_order')::int AS sort_order
    FROM jsonb_array_elements(items) AS e
  ) AS v
  WHERE f.id = v.id;

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;

REVOKE ALL ON FUNCTION reorder_frames(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION reorder_frames(jsonb) FROM anon;
REVOKE ALL ON FUNCTION reorder_frames(jsonb) FROM authenticated;
GRANT EXECUTE ON FUNCTION reorder_frames(jsonb) TO service_role;

-- Chuẩn hoá dữ liệu đang có: cả 4 khung đều mang sort_order = 0 (giá trị DEFAULT),
-- nên thứ tự Postgres trả về là không xác định. Giữ nguyên thứ tự hiện hành tối đa
-- bằng cách xếp theo (sort_order, created_at).
WITH ranked AS (
  SELECT id,
         (ROW_NUMBER() OVER (ORDER BY sort_order ASC, created_at ASC) - 1)::int AS new_order
  FROM frames
)
UPDATE frames f
SET sort_order = r.new_order
FROM ranked r
WHERE f.id = r.id
  AND f.sort_order IS DISTINCT FROM r.new_order;

SELECT sort_order, name FROM frames ORDER BY sort_order;
