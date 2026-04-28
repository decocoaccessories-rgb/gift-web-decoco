-- ============================================================
-- Add `highlights` column to products
-- Run this in: Supabase Dashboard > SQL Editor
-- ============================================================

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS highlights TEXT;
