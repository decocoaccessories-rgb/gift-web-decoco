-- ============================================================
-- Add payment-related columns to orders table for VNPAY integration.
-- COD orders default to payment_status='pending' (admin marks paid manually).
-- VNPAY orders flip to 'paid' via IPN webhook.
-- ============================================================

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS payment_method TEXT NOT NULL DEFAULT 'cod'
    CHECK (payment_method IN ('cod', 'vnpay')),
  ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (payment_status IN ('pending', 'paid', 'failed', 'cancelled')),
  ADD COLUMN IF NOT EXISTS vnp_txn_ref TEXT,
  ADD COLUMN IF NOT EXISTS vnp_transaction_no TEXT,
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS orders_vnp_txn_ref_idx
  ON orders(vnp_txn_ref)
  WHERE vnp_txn_ref IS NOT NULL;
