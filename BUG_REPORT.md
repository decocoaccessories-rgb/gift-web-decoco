# Báo cáo Lỗi

## Trạng thái
ĐÃ SỬA — Thành công

## Tiêu đề Lỗi
Lỗi hiển thị và hiệu ứng hover của các Button tại Hero Section (Trang chủ)

## Mô tả Lỗi
Các nút bấm trong phần Hero Section đang gặp vấn đề về màu sắc và độ tương phản khi ở trạng thái bình thường và khi hover, gây khó khăn cho trải nghiệm người dùng:
1. **Nút "Khám phá quà tặng"**: Khi hover, màu nền chuyển sang màu đỏ burgundy (màu primary) thay vì màu trắng mờ, làm cho chữ (cũng là màu tối) bị chìm vào nền.
2. **Nút "Tìm hiểu thêm"**: Ở trạng thái bình thường, nút có nền trắng (do kế thừa `bg-background` từ variant `outline`) nhưng chữ cũng màu trắng, dẫn đến chữ bị tàng hình trên nền trắng của chính nó.

## Các bước tái hiện
1. Truy cập vào trang chủ.
2. Quan sát nút "Tìm hiểu thêm" (thấy chữ bị mất, chỉ thấy một khối màu trắng nếu có border).
3. Di chuột (hover) vào nút "Khám phá quà tặng" (thấy nền chuyển sang đỏ burgundy và chữ trở nên khó đọc).
4. Di chuột (hover) vào nút "Tìm hiểu thêm" (thấy chữ hiện lên nhưng màu sắc không nhất quán).

## Kết quả Thực tế vs Kết quả Mong đợi
| Nút | Trạng thái | Kết quả Thực tế | Kết quả Mong đợi |
| :--- | :--- | :--- | :--- |
| **Khám phá quà tặng** | Hover | Nền đỏ burgundy, chữ tối (khó đọc) | Nền trắng mờ hoặc hồng nhạt, chữ vẫn rõ ràng |
| **Tìm hiểu thêm** | Bình thường | Nền trắng, chữ trắng (vô hình) | Nền trong suốt (outline), chữ trắng hiển thị rõ trên nền ảnh tối |

## Ngữ cảnh & Môi trường
- File liên quan: `components/sections/HeroSection.tsx`, `components/ui/button.tsx`
- Theme: DECOCO Brand (Burgundy & Pastel Pink)
- Framework: Next.js + Tailwind CSS (v4)

---

## Phân tích Nguyên nhân Gốc rễ (Root Cause Analysis)

### 1. Nút "Khám phá quà tặng"
Trong `components/ui/button.tsx`, variant `default` có selector đặc biệt:
`[a]:hover:bg-primary/80`.
Vì nút trong HeroSection sử dụng component `<Link>` (render ra thẻ `<a>`), selector này có độ ưu tiên cao hơn class `hover:bg-white/90` được truyền thêm vào trong `HeroSection.tsx`. Do đó, khi di chuột vào, Tailwind áp dụng màu nền primary (đỏ) thay vì màu trắng mờ mong muốn.

### 2. Nút "Tìm hiểu thêm"
Trong `components/ui/button.tsx`, variant `outline` có định nghĩa `bg-background`.
Trong `HeroSection.tsx`, nút này được truyền class `text-white`.
Vì `bg-background` mặc định là màu trắng (`oklch(0.99 0 0)`), tổ hợp này tạo ra chữ trắng trên nền trắng của nút, khiến nó không thể nhìn thấy được trên nền tối của Hero Section.

**Luồng logic gây lỗi:**
```
HeroSection (hasImage=true)
  |
  |-- Button "Khám phá quà tặng" (Link)
  |     |-- buttonVariants(default) -> [a]:hover:bg-primary/80 (Specificity thắng)
  |     |-- Class bổ sung: hover:bg-white/90 (Bị ghi đè)
  |     => Kết quả Hover: Nền đỏ burgundy
  |
  |-- Button "Tìm hiểu thêm" (Link)
        |-- buttonVariants(outline) -> bg-background (Màu trắng)
        |-- Class bổ sung: text-white
        => Kết quả: Chữ trắng trên nền trắng (Vô hình)
```

---

## Đề xuất Sửa lỗi (Proposed Fixes)

### Phương án 1: Điều chỉnh trực tiếp trong `HeroSection.tsx` (Khuyến nghị)
Sử dụng các class Tailwind cụ thể hơn để ghi đè các giá trị mặc định của variant.

- **Nút "Khám phá quà tặng"**: 
  - Thay vì dùng `variant: default` (mặc định), có thể dùng `variant: "secondary"` hoặc truyền `hover:bg-white/90!` (sử dụng important nếu cần) để ghi đè selector `[a]:hover`.
  - Hoặc đơn giản là sử dụng `bg-white text-primary hover:bg-brand-light` để đồng bộ với brand.

- **Nút "Tìm hiểu thêm"**: 
  - Thêm class `bg-transparent` để ghi đè `bg-background` của variant outline. 
  - Điều này giúp nút giữ được tính chất "outline" thực sự (nhìn xuyên qua được nền ảnh).

### Phương án 2: Cập nhật `components/ui/button.tsx`
Cập nhật variant `outline` để mặc định không có `bg-background` hoặc sử dụng `bg-transparent`. Tuy nhiên, điều này có thể ảnh hưởng đến các nút outline khác đang dùng `bg-background` để che nội dung bên dưới.

---

## Kế hoạch Xác minh
1. **Kiểm tra thủ công trên trình duyệt**:
   - Truy cập trang chủ, xác nhận nút "Tìm hiểu thêm" có viền trắng, chữ trắng và nền trong suốt.
   - Hover vào "Khám phá quà tặng", xác nhận nền không biến thành màu đỏ mà giữ tone sáng, chữ dễ đọc.
2. **Kiểm tra Dark Mode (nếu có)**: Đảm bảo độ tương phản vẫn tốt.
3. **Kiểm tra Responsive**: Xác nhận các nút hiển thị đúng trên các kích thước màn hình khác nhau.

---

## Kết quả Sửa lỗi (Fix Result)

**Trạng thái**: Thành công

### Thay đổi áp dụng (Phương án 1 — Minimal changes)
File: `components/sections/HeroSection.tsx`

1. Nút "Khám phá quà tặng": `hover:bg-white/90` → `hover:bg-white/90!` (thêm `!` Tailwind v4 important để thắng selector `[a]:hover:bg-primary/80` của variant `default`).
2. Nút "Tìm hiểu thêm": thêm `bg-transparent` để ghi đè `bg-background` của variant `outline`, giúp nút thật sự trong suốt trên ảnh hero.

### Kết quả kiểm thử

**a) Build production (`npm run build`)**
```
✓ Compiled successfully in 56s
  Running TypeScript ...
  Finished TypeScript in 30.6s ...
✓ Generating static pages using 3 workers (25/25) in 1798ms
```

**b) Test script `scripts/verify-hero-buttons.mjs`**
```
PASS - Button "Khám phá quà tặng" có hover:bg-white/90! (override [a]:hover:bg-primary/80)
PASS - Button "Tìm hiểu thêm" có bg-transparent (override bg-background của variant outline)
PASS - Không còn class hover:bg-white/90 không có ! (đảm bảo đã thay thế)

Tất cả kiểm tra đều qua.
```
