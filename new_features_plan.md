# Implementation Plan: Phân loại sản phẩm & Cải tiến công cụ thiết kế

Mục tiêu:
1. Thêm tính năng chọn phân loại màu (variants) cho sản phẩm.
2. Cố định tỷ lệ khung thiết kế là 1772 x 1535 px.
3. Hỗ trợ upload ảnh PNG trong suốt cho khung thiết kế trong Admin.

---

## 1. Database & Type Definitions

### [MODIFY] [lib/supabase/types.ts](file:///e:/decoco-web/lib/supabase/types.ts)
- **Table `products`**: Thêm cột `variants` (kiểu `JSONB`). Cấu trúc: `[{ "id": "uuid", "name": "Vàng hồng", "image_url": "url_anh" }]`.
- **Table `orders`**: Thêm cột `variant_name` (kiểu `text`).
- Cập nhật interface `Product` và `Order` tương ứng.

---

## 2. Admin Panel: Quản lý Sản phẩm & Khung

### [MODIFY] [app/api/admin/products/route.ts](file:///e:/decoco-web/app/api/admin/products/route.ts) & `[id]/route.ts`
- Cập nhật Zod schema để chấp nhận trường `variants`.

### [MODIFY] [app/admin/san-pham/ProductEditDialog.tsx](file:///e:/decoco-web/app/admin/san-pham/ProductEditDialog.tsx)
- Thêm giao diện quản lý Phân loại: Cho phép thêm/xoá Phân loại, nhập tên (ví dụ: Vàng hồng) và chọn ảnh cho phân loại đó từ danh sách ảnh đã upload.

### [MODIFY] [app/admin/khung/page.tsx](file:///e:/decoco-web/app/admin/khung/page.tsx)
- Cập nhật `DEFAULT_CONFIG` để có `canvasWidth: 1772` và `canvasHeight: 1535`.
- Thêm nút Upload ảnh PNG trực tiếp trong Dialog sửa khung để cập nhật trường `config.backgroundImage`.

---

## 3. Trang Sản phẩm: Chọn Phân loại

### [MODIFY] [app/(site)/san-pham/[slug]/page.tsx](file:///e:/decoco-web/app/(site)/san-pham/[slug]/page.tsx)
- Thêm state `selectedVariant` để lưu phân loại khách đã chọn.
- Hiển thị danh sách phân loại (nếu có) dưới dạng các nút bấm hoặc ô chọn màu.
- Khi chọn phân loại: Cập nhật ảnh chính của sản phẩm bằng `variant.image_url`.
- Truyền `selectedVariant` vào component `DesignTool`.

---

## 4. Công cụ Thiết kế (Design Tool)

### [MODIFY] [components/DesignTool/DesignToolCanvas.tsx](file:///e:/decoco-web/components/DesignTool/DesignToolCanvas.tsx)
- Thay đổi hằng số kích thước:
  ```tsx
  const CANVAS_WIDTH = 1772;
  const CANVAS_HEIGHT = 1535;
  ```
- Cập nhật logic tính toán `scale` và hiển thị Canvas để hỗ trợ tỷ lệ hình chữ nhật mới.
- **Validation**: Kiểm tra nếu sản phẩm có phân loại mà khách chưa chọn thì disable nút "Tiếp theo — Đặt hàng" và hiển thị thông báo "Vui lòng chọn phân loại màu".
- Khi bấm "Tiếp theo": Lưu `variant_name` vào `sessionStorage` cùng với thông tin thiết kế.

---

## 5. Đặt hàng (Checkout)

### [MODIFY] [app/(site)/dat-hang/page.tsx](file:///e:/decoco-web/app/(site)/dat-hang/page.tsx)
- Lấy `variant_name` từ `sessionStorage`.
- Hiển thị phân loại đã chọn trong phần "Đơn hàng" (Summary).
- Gửi `variant_name` lên API `/api/orders` để lưu vào cơ sở dữ liệu.

---

## Các bước thực hiện (SQL):
Chạy các lệnh sau trong Supabase SQL Editor:
```sql
ALTER TABLE products ADD COLUMN variants jsonb DEFAULT '[]';
ALTER TABLE orders ADD COLUMN variant_name text;
```
