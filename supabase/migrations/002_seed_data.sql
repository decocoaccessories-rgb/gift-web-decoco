-- ============================================================
-- DECOCO — Seed Data
-- Run AFTER 001_initial_schema.sql
-- ============================================================

-- ============================================================
-- SITE CONTENT defaults
-- ============================================================
INSERT INTO site_content (key, value, type, section, label) VALUES
  -- Hero
  ('hero_headline',    'Tặng quà không chỉ là món đồ — tặng cả một kỷ niệm',    'text',  'hero',   'Hero: Tiêu đề chính'),
  ('hero_subtext',     'Thiết kế hộp quà với ảnh của bạn chỉ trong 5 phút. Trang sức DECOCO kết hợp hộp in ảnh cá nhân hoá — món quà ý nghĩa nhất.',  'text',  'hero',   'Hero: Mô tả phụ'),
  ('hero_image',       '',  'image', 'hero',   'Hero: Ảnh banner'),
  ('hero_cta_text',    'Khám phá quà tặng',  'text',  'hero',   'Hero: Text nút CTA'),
  -- Story
  ('story_heading',    'Hộp quà mang dấu ấn của bạn',  'text',  'story',  'Giới thiệu: Tiêu đề'),
  ('story_text',       'Mỗi khoảnh khắc đáng trân trọng đều xứng đáng được ghi lại theo cách đặc biệt nhất. DECOCO ra đời với sứ mệnh biến những bức ảnh quý giá của bạn thành một món quà có hồn — hộp trang sức được cá nhân hoá hoàn toàn theo ý bạn.',  'richtext', 'story', 'Giới thiệu: Nội dung'),
  ('story_image',      '',  'image', 'story',  'Giới thiệu: Ảnh'),
  -- CTA
  ('cta_headline',     'Bắt đầu thiết kế ngay hôm nay',  'text',  'cta',    'CTA: Tiêu đề'),
  ('cta_subtext',      'Chỉ mất 5 phút để tạo ra một món quà sẽ được nhớ mãi',  'text',  'cta',    'CTA: Mô tả'),
  ('cta_button_text',  'Mua ngay',  'text',  'cta',    'CTA: Text nút'),
  ('cta_video_url',    '',  'url',   'cta',    'CTA: Link video YouTube (tuỳ chọn)'),
  -- Footer
  ('footer_slogan',    'Trang sức DECOCO — Vẻ đẹp từ những điều nhỏ bé',  'text',  'footer', 'Footer: Slogan'),
  ('footer_email',     'hello@decoco.vn',  'text',  'footer', 'Footer: Email liên hệ'),
  ('footer_phone',     '0901 234 567',  'text',  'footer', 'Footer: Số điện thoại'),
  ('footer_address',   'Hà Nội, Việt Nam',  'text',  'footer', 'Footer: Địa chỉ'),
  ('footer_facebook',  '',  'url',   'footer', 'Footer: Link Facebook'),
  ('footer_tiktok',    '',  'url',   'footer', 'Footer: Link TikTok'),
  ('footer_instagram', '',  'url',   'footer', 'Footer: Link Instagram')
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- FAQ defaults
-- ============================================================
INSERT INTO faq_items (question, answer, sort_order) VALUES
  ('Thời gian sản xuất và giao hàng bao lâu?',
   'Sau khi xác nhận đơn hàng, DECOCO sẽ sản xuất và giao hàng trong vòng 3–5 ngày làm việc. Đơn hàng ở Hà Nội và TP.HCM thường nhận được nhanh hơn.',
   1),
  ('Chất lượng in ảnh lên hộp như thế nào?',
   'DECOCO sử dụng công nghệ in UV độ nét cao, màu sắc trung thực và bền màu. Ảnh của bạn sẽ được in sắc nét, không lem, không phai ngay cả sau thời gian dài sử dụng.',
   2),
  ('Tôi có thể chỉnh sửa đơn hàng sau khi đặt không?',
   'Bạn có thể liên hệ DECOCO để chỉnh sửa trong vòng 2 giờ sau khi đặt hàng, trước khi đơn hàng được đưa vào sản xuất. Sau thời gian đó, đơn hàng sẽ không thể thay đổi.',
   3),
  ('Chính sách đổi trả như thế nào?',
   'DECOCO cam kết hoàn trả 100% nếu sản phẩm bị lỗi do sản xuất (in ảnh mờ, sai thiết kế, hộp bị hư hỏng). Vui lòng liên hệ trong vòng 48 giờ kể từ khi nhận hàng kèm ảnh chụp sản phẩm.',
   4),
  ('Bên trong hộp có những gì?',
   'Mỗi hộp quà DECOCO bao gồm: hộp in ảnh cá nhân hoá theo thiết kế của bạn và set trang sức DECOCO (nội dung trang sức tuỳ theo sản phẩm bạn chọn).',
   5),
  ('Bảo quản trang sức như thế nào?',
   'Tránh tiếp xúc với nước, mồ hôi và hoá chất (nước hoa, kem dưỡng). Lau nhẹ bằng vải mềm khô sau khi đeo. Bảo quản trong hộp khi không sử dụng để giữ độ sáng bóng.',
   6),
  ('Có giao hàng toàn quốc không?',
   'Có! DECOCO giao hàng toàn quốc qua đối tác Giao Hàng Nhanh và J&T Express. Phí vận chuyển được tính theo khu vực và hiển thị khi bạn nhập địa chỉ.',
   7)
ON CONFLICT DO NOTHING;

-- ============================================================
-- Sample Products (placeholder — update ảnh sau)
-- ============================================================
INSERT INTO products (name, slug, description, price, stock, is_visible, images, sort_order) VALUES
  ('Hộp Quà Trái Tim', 'hop-qua-trai-tim',
   '<p>Hộp quà hình trái tim với set trang sức bạc mạ vàng 18K. Thiết kế ảnh cá nhân hoá trên mặt hộp — món quà hoàn hảo cho người yêu thương.</p>',
   299000, 50, true, '[]'::jsonb, 1),
  ('Hộp Quà Ngôi Sao', 'hop-qua-ngoi-sao',
   '<p>Hộp quà vuông thanh lịch với set vòng cổ và hoa tai đính đá. Thiết kế ảnh theo chủ đề ngôi sao — lung linh và đặc biệt.</p>',
   349000, 50, true, '[]'::jsonb, 2),
  ('Hộp Quà Tình Yêu', 'hop-qua-tinh-yeu',
   '<p>Hộp quà hình chữ nhật với set nhẫn đôi bạc mạ bạch kim. Thiết kế ảnh đôi — kỷ niệm của hai người trong một hộp quà.</p>',
   399000, 30, true, '[]'::jsonb, 3),
  ('Hộp Quà Sinh Nhật', 'hop-qua-sinh-nhat',
   '<p>Hộp quà hình tròn với set dây chuyền mặt chữ theo tuổi. Thiết kế ảnh sinh nhật — mang đậm dấu ấn cá nhân.</p>',
   279000, 60, true, '[]'::jsonb, 4),
  ('Hộp Quà Mini', 'hop-qua-mini',
   '<p>Hộp quà nhỏ xinh với bông tai đính đá Swarovski. Thiết kế ảnh đơn giản — phù hợp tặng bạn bè ngày thường.</p>',
   249000, 80, true, '[]'::jsonb, 5),
  ('Hộp Quà Premium', 'hop-qua-premium',
   '<p>Hộp quà cao cấp với set trang sức vàng 18K đầy đủ: vòng cổ, hoa tai, nhẫn. Thiết kế ảnh cầu kỳ — xứng đáng với những dịp đặc biệt nhất.</p>',
   599000, 20, true, '[]'::jsonb, 6),
  ('Hộp Quà Cặp Đôi', 'hop-qua-cap-doi',
   '<p>Hộp quà dành cho hai người với set vòng tay đôi khắc tên. Thiết kế ảnh cùng nhau — kỷ niệm tình yêu không phai.</p>',
   450000, 40, true, '[]'::jsonb, 7),
  ('Hộp Quà Gia Đình', 'hop-qua-gia-dinh',
   '<p>Hộp quà lớn với set trang sức dành tặng mẹ. Thiết kế ảnh gia đình — sự yêu thương trong từng chi tiết.</p>',
   499000, 35, true, '[]'::jsonb, 8)
ON CONFLICT (slug) DO NOTHING;
