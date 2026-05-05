-- ============================================================
-- RPC: decrement_variant_stock
-- Atomically decrement stock for a specific variant within products.variants JSONB.
-- Uses SELECT ... FOR UPDATE to serialize concurrent decrements on the same row.
-- Returns the updated variants array, or raises an exception if not enough stock.
-- ============================================================

CREATE OR REPLACE FUNCTION decrement_variant_stock(
  p_product_id uuid,
  p_variant_id text
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_variants jsonb;
  v_index int;
  v_current_stock int;
  v_new_variants jsonb;
BEGIN
  SELECT variants INTO v_variants
  FROM products
  WHERE id = p_product_id
  FOR UPDATE;

  IF v_variants IS NULL THEN
    RAISE EXCEPTION 'Product not found' USING ERRCODE = 'P0002';
  END IF;

  SELECT (idx - 1) INTO v_index
  FROM jsonb_array_elements(v_variants) WITH ORDINALITY AS arr(elem, idx)
  WHERE elem->>'id' = p_variant_id
  LIMIT 1;

  IF v_index IS NULL THEN
    RAISE EXCEPTION 'Variant not found' USING ERRCODE = 'P0002';
  END IF;

  v_current_stock := COALESCE((v_variants->v_index->>'stock')::int, 0);

  IF v_current_stock <= 0 THEN
    RAISE EXCEPTION 'Variant out of stock' USING ERRCODE = 'P0001';
  END IF;

  v_new_variants := jsonb_set(
    v_variants,
    ARRAY[v_index::text, 'stock'],
    to_jsonb(v_current_stock - 1),
    true
  );

  UPDATE products
  SET variants = v_new_variants,
      updated_at = now()
  WHERE id = p_product_id;

  RETURN v_new_variants;
END;
$$;
