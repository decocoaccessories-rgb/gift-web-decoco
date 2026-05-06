# Implementation Plan: Cập nhật quản lý "Điểm nổi bật" của sản phẩm

Mục tiêu: Chuyển các dòng thông tin "selling points" (khoanh đỏ trong ảnh) từ dạng mã cứng (hardcoded) sang dữ liệu có thể chỉnh sửa được từ Admin Panel cho từng sản phẩm.

## 1. Thay đổi Database (Supabase)
- Thêm cột `highlights` vào bảng `products`.
- Kiểu dữ liệu: `text` (cho phép lưu nhiều dòng, mỗi dòng là một điểm nổi bật).
- Ghi chú: Sử dụng dấu xuống dòng để phân tách các ý.

## 2. Cập nhật Type Definitions
### [MODIFY] [lib/supabase/types.ts](file:///e:/decoco-web/lib/supabase/types.ts)
- Thêm thuộc tính `highlights: string | null` vào interface `Product`.

## 3. Cập nhật Admin API (Backend)
### [MODIFY] [app/api/admin/products/route.ts](file:///e:/decoco-web/app/api/admin/products/route.ts)
- Cập nhật Zod schema `createSchema` để chấp nhận trường `highlights`.
### [MODIFY] [app/api/admin/products/[id]/route.ts](file:///e:/decoco-web/app/api/admin/products/[id]/route.ts)
- Cập nhật Zod schema `patchSchema` để chấp nhận trường `highlights`.

## 4. Cập nhật Admin UI (Frontend)
### [MODIFY] [app/admin/san-pham/ProductEditDialog.tsx](file:///e:/decoco-web/app/admin/san-pham/ProductEditDialog.tsx)
- Thêm trường `highlights` vào state `form`.
- Thêm một `textarea` trong giao diện chỉnh sửa để người dùng nhập "Điểm nổi bật" (mỗi dòng một ý).
- Cập nhật hàm `handleSave` để gửi dữ liệu `highlights` lên server.

## 5. Hiển thị trên trang chi tiết sản phẩm
### [MODIFY] [app/(site)/san-pham/[slug]/page.tsx](file:///e:/decoco-web/app/(site)/san-pham/[slug]/page.tsx)
- Cập nhật hàm `getProduct` để lấy thêm trường `highlights`.
- Tại phần hiển thị các dấu tích, thay thế mã cứng bằng logic:
    ```tsx
    {product.highlights && (
      <div className="text-xs text-muted-foreground bg-secondary/30 rounded-lg px-4 py-3 space-y-1">
        {product.highlights.split('\n').filter(line => line.trim()).map((line, index) => (
          <p key={index}>✓ {line.trim()}</p>
        ))}
      </div>
    )}
    ```
- Lưu ý: Cần thêm logic fallback để hiển thị các giá trị cũ nếu sản phẩm chưa có dữ liệu `highlights` mới (giúp dữ liệu cũ không bị biến mất ngay lập tức).

---

**Ghi chú cho việc thực hiện:**
1. Chạy lệnh SQL sau để thêm cột:
   `ALTER TABLE products ADD COLUMN highlights text;`
2. Thực hiện lần lượt các bước chỉnh sửa code theo thứ tự từ 2 đến 5.
