# Bug Report

## Status
THÀNH CÔNG — Hero responsive: 2 ảnh background riêng biệt cho desktop/mobile.

## Yêu cầu
Hero Section trên Trang chủ hiện chỉ có 1 ảnh background (`hero_image`). Trên mobile portrait viewport (~390×844), ảnh landscape 16:9 bị crop nặng. Cần:
1. Cho admin upload riêng 2 ảnh: 1 cho desktop, 1 cho mobile.
2. Frontend tự chọn ảnh phù hợp theo viewport.
3. Hint kích thước mobile hiển thị trong admin.

## Đề xuất kích thước
| Bản | Kích thước khuyến nghị | Tỉ lệ | Lý do |
|---|---|---|---|
| Desktop | 1920×1080px | 16:9 (landscape) | Đã có sẵn, fit `min-h-screen` trên viewport ngang |
| **Mobile** | **1080×1920px** | **9:16 (portrait)** | iPhone/Android portrait ~390×844; ảnh dọc fit object-cover không bị crop chủ thể |

## Phân tích & Đề xuất Sửa lỗi
- `components/sections/HeroSection.tsx:18,32-41`: chỉ dùng 1 `heroImage` cho mọi viewport.
- `supabase/migrations/002_seed_data.sql:13`: chỉ có row `hero_image`.
- `app/admin/noi-dung/page.tsx:20-23,247-270`: chỉ có 1 ImageUploadField cho `hero_image`. `IMAGE_HINTS` không có entry mobile.

**Fix**:
1. **Migration mới** `supabase/migrations/003_hero_image_mobile.sql`: INSERT row `hero_image_mobile` với metadata phù hợp. ON CONFLICT DO NOTHING (idempotent).
2. **HeroSection.tsx**: render 2 `<Image>` — mobile (`md:hidden`) + desktop (`hidden md:block`). Nếu chỉ có desktop image → desktop image hiện trên cả 2 viewport (graceful fallback). Nếu chỉ có mobile → ngược lại.
3. **Admin noi-dung/page.tsx**:
    - Thêm `hero_image_mobile` vào `IMAGE_HINTS` + `IMAGE_KEYS`.
    - Thêm field hardcoded cho mobile bên cạnh field hero (cùng pattern).
    - Hint: "Khuyến nghị: 1080×1920px (tỉ lệ 9:16, dọc - mobile portrait)".

## Verification Plan
1. Mở admin `/admin/noi-dung` → Quản lý ảnh → thấy 2 field: "Ảnh Hero (Desktop)" + "Ảnh Hero (Mobile)" với hint kích thước riêng.
2. Upload 2 ảnh khác nhau, save.
3. Mở Trang chủ trên desktop → thấy ảnh desktop. Mở trên mobile (DevTools iPhone preset) → thấy ảnh mobile.
4. Hồi quy: nếu chỉ upload 1 ảnh (desktop) → hiển thị trên cả 2 viewport như cũ.

## Fix Applied
- **Files Changed**:
    - `supabase/migrations/003_hero_image_mobile.sql` (new): INSERT row `hero_image_mobile` với type=image, section=hero, label đầy đủ. Idempotent (ON CONFLICT DO NOTHING). **LƯU Ý**: chạy file này ở Supabase Dashboard SQL Editor để row có metadata sạch — không bắt buộc vì API `upsert` by key sẽ tự tạo row khi save lần đầu.
    - `components/sections/HeroSection.tsx`: thêm read `content.hero_image_mobile`. Render 2 `<Image>`: mobile (`md:hidden`) + desktop (`hidden md:block`). Mỗi ảnh fall back sang ảnh còn lại nếu thiếu (graceful degradation).
    - `app/admin/noi-dung/page.tsx`:
        - `IMAGE_HINTS`: thêm `hero_image_mobile` với hint "Khuyến nghị: 1080×1920px (tỉ lệ 9:16, mobile dọc)".
        - Đổi label "Ảnh Hero (Banner chính)" → "Ảnh Hero (Desktop)".
        - Thêm field hardcoded "Ảnh Hero (Mobile)" cùng pattern (ImageUploadField + Save button).
- **Test Results**:
    - `npm run build` → ✓ Compiled successfully + 27/27 pages OK.
    - Static verification 11/11 pass:
      ```
      PASS  Hero reads hero_image_mobile
      PASS  Hero: mobile image hidden on md+
      PASS  Hero: desktop image hidden on <md
      PASS  Hero: mobileSrc fallback to desktop
      PASS  Hero: desktopSrc fallback to mobile
      PASS  Admin: hint mentions 1080x1920
      PASS  Admin: hint mentions 9:16
      PASS  Admin: ImageUploadField for hero_image_mobile
      PASS  Admin: save button calls saveContentKey hero_image_mobile
      PASS  Admin: IMAGE_HINTS has hero_image_mobile entry
      PASS  Migration: INSERT hero_image_mobile row
      ```
- **Verification cần làm** (sau khi Vercel deploy):
    - Vào `/admin/noi-dung` → upload 1 ảnh dọc 1080×1920 vào field "Ảnh Hero (Mobile)" → Lưu.
    - Mở Trang chủ trên iPhone → thấy ảnh dọc fit khít màn hình.
    - Mở trên desktop → thấy ảnh ngang như cũ.
