# Báo cáo Lỗi

## Trạng thái
ĐÃ SỬA XONG

## Tiêu đề Lỗi
Các liên kết chính sách ở Footer không hoạt động và chưa có trang nội dung tương ứng.

## Mô tả Lỗi
Hiện tại, ở phần footer của trang chủ, các mục "Chính sách bảo mật", "Điều khoản sử dụng", và "Đổi trả" chỉ là các thẻ `<span>` với hiệu ứng con trỏ chuột, nhưng không có logic chuyển trang và cũng chưa có các trang nội dung này trong hệ thống. Người dùng cũng chưa thể chỉnh sửa nội dung này từ trang quản trị.

## Các bước tái hiện
1. Cuộn xuống phần Footer ở trang chủ.
2. Bấm vào "Chính sách bảo mật", "Điều khoản sử dụng" hoặc "Đổi trả".
3. Kết quả: Không có gì xảy ra, trang không chuyển.

## Kết quả Thực tế vs Kết quả Mong đợi
- **Kết quả thực tế**: Các link không phản hồi khi click. Không có trang nội dung tương ứng.
- **Kết quả mong đợi**: Khi click sẽ chuyển sang trang nội dung tương ứng (VD: `/chinh-sach-bao-mat`). Nội dung trang này có thể chỉnh sửa được từ `/admin/noi-dung`.

## Ngữ cảnh & Môi trường
- File liên quan: `components/layout/Footer.tsx`, `app/admin/noi-dung/page.tsx`.
- Cơ sở dữ liệu: Bảng `site_content`.

---

## Phân tích Nguyên nhân Gốc rễ (Root Cause Analysis)
1. **UI Layout**: Trong `Footer.tsx`, các liên kết đang được để trong thẻ `<span>` thay vì `Link` hoặc `<a>`.
2. **Routing**: Hệ thống chưa định nghĩa các route cho các trang chính sách này.
3. **Data Model**: Bảng `site_content` chưa có các bản ghi (keys) để lưu trữ nội dung cho các trang này.
4. **Admin UI**: Trang quản lý nội dung chưa hiển thị các trường để biên tập nội dung chính sách.

```ascii
[Footer.tsx] --(span)--> [No Link]
      |
      X (Missing Route)
      |
[App Directory] --(Missing)--> [policy pages]
      |
[site_content] --(Missing Keys)--> [policy_privacy, policy_terms, ...]
```

## Đề xuất Sửa lỗi (Proposed Fixes)
1. **Cơ sở dữ liệu**: Thêm 3 bản ghi mới vào bảng `site_content` với các key: `policy_privacy`, `policy_terms`, `policy_shipping`. Thiết lập `type = 'richtext'`.
2. **Routing & Pages**: 
   - Tạo route động `app/(site)/chinh-sach/[slug]/page.tsx` hoặc các trang tĩnh riêng biệt để hiển thị nội dung từ `site_content`.
   - Sử dụng một component để render HTML an toàn (dangerouslySetInnerHTML) từ trường `value` trong DB.
3. **Footer**: Cập nhật `components/layout/Footer.tsx`, thay thế các thẻ `<span>` bằng `Link` trỏ đến các route mới tạo.
4. **Admin Panel**: 
   - Cập nhật `app/admin/noi-dung/page.tsx`, thêm section "Chính sách & Điều khoản" vào `SECTION_LABELS`.
   - Đảm bảo các key mới xuất hiện trong giao diện chỉnh sửa.

**Phương án khuyến nghị**: Sử dụng route động `/chinh-sach/[slug]` để tối ưu code và dễ dàng mở rộng thêm các trang nội dung tĩnh khác sau này.

## Kết quả Xác minh
1. **Kiểm tra UI**: 
   - [x] Click "Chính sách bảo mật" -> chuyển hướng thành công tới `/chinh-sach/chinh-sach-bao-mat`.
   - [x] Click "Điều khoản sử dụng" -> chuyển hướng thành công tới `/chinh-sach/dieu-khoan-su-dung`.
   - [x] Click "Đổi trả" -> chuyển hướng thành công tới `/chinh-sach/doi-tra`.
2. **Kiểm tra Nội dung**: 
   - [x] Nội dung hiển thị đúng tiêu đề và nội dung mặc định từ database.
   - [x] Sử dụng `dangerouslySetInnerHTML` để render định dạng Rich Text.
3. **Kiểm tra Admin**:
   - [x] Mục "Chính sách & Điều khoản" đã xuất hiện trong `/admin/noi-dung`.
   - [x] Có thể chỉnh sửa nội dung qua giao diện quản trị.

**Trạng thái cuối cùng**: Thành công.
**Build Output**: `Compiled successfully`.
