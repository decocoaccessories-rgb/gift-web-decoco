-- ============================================================
-- Add `variants` (jsonb) to products + `variant_name` (text) to orders
-- Run this in: Supabase Dashboard > SQL Editor
-- ============================================================

ALTER TABLE products ADD COLUMN IF NOT EXISTS variants jsonb DEFAULT '[]'::jsonb;
ALTER TABLE orders   ADD COLUMN IF NOT EXISTS variant_name text;
