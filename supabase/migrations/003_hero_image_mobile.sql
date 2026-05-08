-- ============================================================
-- DECOCO — Add mobile hero image content key
-- Run AFTER 002_seed_data.sql
-- ============================================================

INSERT INTO site_content (key, value, type, section, label) VALUES
  ('hero_image_mobile', '', 'image', 'hero', 'Hero: Ảnh banner (Mobile)')
ON CONFLICT (key) DO NOTHING;
