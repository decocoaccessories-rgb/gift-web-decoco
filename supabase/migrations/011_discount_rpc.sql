-- ============================================================
-- V3 — RPC cho mã giảm giá.
--   validate_discount_code      : read-only, tính số tiền giảm + lý do từ chối
--   redeem_discount_code        : atomic (FOR UPDATE), +usage_count + insert audit
--   finalize_discount_redemption: idempotent theo order_id (dùng cho VietQR/VNPAY khi 'paid')
--
-- Quy ước jsonb trả về của validate:
--   { valid, reason, discount_type, discount_value, discount_amount, final_amount }
--   reason ∈ ok | not_found | inactive | not_started | expired | min_order
--            | usage_limit | per_customer_limit
-- ============================================================

-- Hàm nội bộ tính số tiền giảm (VND), không âm, không vượt order amount.
CREATE OR REPLACE FUNCTION _discount_amount(
  p_type text,
  p_value int,
  p_max_cap int,
  p_order_amount int
) RETURNS int
LANGUAGE plpgsql IMMUTABLE
AS $$
DECLARE
  v_amount int;
BEGIN
  IF p_type = 'fixed' THEN
    v_amount := p_value;
  ELSE -- percent
    v_amount := floor(p_order_amount::numeric * p_value / 100.0)::int;
    IF p_max_cap IS NOT NULL THEN
      v_amount := LEAST(v_amount, p_max_cap);
    END IF;
  END IF;
  v_amount := LEAST(v_amount, p_order_amount);
  IF v_amount < 0 THEN v_amount := 0; END IF;
  RETURN v_amount;
END;
$$;

-- ---- validate_discount_code -------------------------------------------------
CREATE OR REPLACE FUNCTION validate_discount_code(
  p_code text,
  p_order_amount int,
  p_customer_phone text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql STABLE
AS $$
DECLARE
  v_code text := upper(btrim(p_code));
  r discount_codes%ROWTYPE;
  v_used_by_customer int;
  v_amount int;
  v_fail jsonb;
BEGIN
  v_fail := jsonb_build_object('valid', false, 'discount_amount', 0, 'final_amount', p_order_amount);

  SELECT * INTO r FROM discount_codes WHERE code = v_code;
  IF NOT FOUND THEN
    RETURN v_fail || jsonb_build_object('reason', 'not_found');
  END IF;
  IF NOT r.is_active THEN
    RETURN v_fail || jsonb_build_object('reason', 'inactive');
  END IF;
  IF r.starts_at IS NOT NULL AND now() < r.starts_at THEN
    RETURN v_fail || jsonb_build_object('reason', 'not_started');
  END IF;
  IF r.expires_at IS NOT NULL AND now() > r.expires_at THEN
    RETURN v_fail || jsonb_build_object('reason', 'expired');
  END IF;
  IF p_order_amount < r.min_order_amount THEN
    RETURN v_fail || jsonb_build_object('reason', 'min_order');
  END IF;
  IF r.usage_limit IS NOT NULL AND r.usage_count >= r.usage_limit THEN
    RETURN v_fail || jsonb_build_object('reason', 'usage_limit');
  END IF;
  IF p_customer_phone IS NOT NULL AND r.per_customer_limit IS NOT NULL THEN
    SELECT count(*) INTO v_used_by_customer
    FROM discount_redemptions
    WHERE discount_code_id = r.id AND customer_phone = p_customer_phone;
    IF v_used_by_customer >= r.per_customer_limit THEN
      RETURN v_fail || jsonb_build_object('reason', 'per_customer_limit');
    END IF;
  END IF;

  v_amount := _discount_amount(r.discount_type, r.discount_value, r.max_discount_amount, p_order_amount);

  RETURN jsonb_build_object(
    'valid', true,
    'reason', 'ok',
    'discount_type', r.discount_type,
    'discount_value', r.discount_value,
    'discount_amount', v_amount,
    'final_amount', p_order_amount - v_amount
  );
END;
$$;

-- ---- redeem_discount_code (atomic) ---------------------------------------------
CREATE OR REPLACE FUNCTION redeem_discount_code(
  p_code text,
  p_order_id uuid,
  p_order_amount int,
  p_customer_phone text
) RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_code text := upper(btrim(p_code));
  r discount_codes%ROWTYPE;
  v_used_by_customer int;
  v_amount int;
BEGIN
  SELECT * INTO r FROM discount_codes WHERE code = v_code FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'discount_code_not_found' USING ERRCODE = 'P0001';
  END IF;

  -- Idempotent: đơn này đã trừ lượt rồi -> trả lại thông tin, không cộng thêm.
  IF EXISTS (SELECT 1 FROM discount_redemptions WHERE order_id = p_order_id) THEN
    SELECT amount INTO v_amount FROM discount_redemptions WHERE order_id = p_order_id;
    RETURN jsonb_build_object('ok', true, 'already', true,
      'discount_amount', v_amount, 'final_amount', p_order_amount - v_amount);
  END IF;

  IF NOT r.is_active THEN
    RAISE EXCEPTION 'discount_inactive' USING ERRCODE = 'P0001';
  END IF;
  IF r.starts_at IS NOT NULL AND now() < r.starts_at THEN
    RAISE EXCEPTION 'discount_not_started' USING ERRCODE = 'P0001';
  END IF;
  IF r.expires_at IS NOT NULL AND now() > r.expires_at THEN
    RAISE EXCEPTION 'discount_expired' USING ERRCODE = 'P0001';
  END IF;
  IF p_order_amount < r.min_order_amount THEN
    RAISE EXCEPTION 'discount_min_order' USING ERRCODE = 'P0001';
  END IF;
  IF r.usage_limit IS NOT NULL AND r.usage_count >= r.usage_limit THEN
    RAISE EXCEPTION 'discount_usage_limit' USING ERRCODE = 'P0001';
  END IF;
  IF r.per_customer_limit IS NOT NULL THEN
    SELECT count(*) INTO v_used_by_customer
    FROM discount_redemptions
    WHERE discount_code_id = r.id AND customer_phone = p_customer_phone;
    IF v_used_by_customer >= r.per_customer_limit THEN
      RAISE EXCEPTION 'discount_per_customer_limit' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  v_amount := _discount_amount(r.discount_type, r.discount_value, r.max_discount_amount, p_order_amount);

  UPDATE discount_codes SET usage_count = usage_count + 1 WHERE id = r.id;
  INSERT INTO discount_redemptions (discount_code_id, order_id, code, customer_phone, amount)
  VALUES (r.id, p_order_id, v_code, p_customer_phone, v_amount);

  RETURN jsonb_build_object('ok', true, 'already', false,
    'discount_amount', v_amount, 'final_amount', p_order_amount - v_amount);
END;
$$;

-- ---- finalize_discount_redemption (VietQR/VNPAY khi paid) ------------------
CREATE OR REPLACE FUNCTION finalize_discount_redemption(
  p_order_id uuid
) RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  o orders%ROWTYPE;
  r discount_codes%ROWTYPE;
BEGIN
  SELECT * INTO o FROM orders WHERE id = p_order_id;
  IF NOT FOUND OR o.discount_code IS NULL OR o.discount_amount <= 0 THEN
    RETURN;
  END IF;
  IF EXISTS (SELECT 1 FROM discount_redemptions WHERE order_id = p_order_id) THEN
    RETURN; -- đã trừ lượt
  END IF;

  SELECT * INTO r FROM discount_codes WHERE code = upper(btrim(o.discount_code)) FOR UPDATE;
  IF NOT FOUND THEN
    RETURN; -- mã đã bị xoá -> bỏ qua, đơn vẫn giữ discount_amount đã áp
  END IF;

  UPDATE discount_codes SET usage_count = usage_count + 1 WHERE id = r.id;
  INSERT INTO discount_redemptions (discount_code_id, order_id, code, customer_phone, amount)
  VALUES (r.id, o.id, r.code, o.customer_phone, o.discount_amount);
END;
$$;

GRANT EXECUTE ON FUNCTION validate_discount_code(text, int, text) TO service_role;
GRANT EXECUTE ON FUNCTION redeem_discount_code(text, uuid, int, text) TO service_role;
GRANT EXECUTE ON FUNCTION finalize_discount_redemption(uuid) TO service_role;
