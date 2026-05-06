-- ============================================================
-- DECOCO — Add Policy / Legal Pages content
-- ============================================================
INSERT INTO site_content (key, value, type, section, label) VALUES
  ('policy_privacy',
   '<p>Nội dung chính sách bảo mật đang được cập nhật.</p>',
   'richtext', 'policy', 'Chính sách bảo mật'),
  ('policy_terms',
   '<p>Nội dung điều khoản sử dụng đang được cập nhật.</p>',
   'richtext', 'policy', 'Điều khoản sử dụng'),
  ('policy_return',
   '<p>Nội dung chính sách đổi trả đang được cập nhật.</p>',
   'richtext', 'policy', 'Chính sách đổi trả')
ON CONFLICT (key) DO NOTHING;
