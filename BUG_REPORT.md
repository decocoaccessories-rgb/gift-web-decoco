# Báo cáo Lỗi
## Trạng thái
THÀNH CÔNG

## Tiêu đề Lỗi
Cải thiện bố cục Mobile và bổ sung tính năng hỗ trợ căn chỉnh trong Công cụ thiết kế.

## Mô tả Lỗi
1. **Bố cục Mobile**: Thứ tự các thành phần trong công cụ thiết kế trên mobile chưa tối ưu (Nút Upload/Thêm chữ đang ở trên cùng, che khuất khu vực thiết kế quan trọng).
2. **Trải nghiệm thiết kế**: Các đối tượng (ảnh, chữ) khi được chọn thiếu các điểm neo (dots) rõ ràng để điều chỉnh và thiếu các đường gióng (guidelines) để căn giữa, gây khó khăn cho người dùng khi muốn tạo thiết kế cân đối.

## Các bước tái hiện
1. Truy cập Trang sản phẩm trên thiết bị di động (hoặc chế độ giả lập mobile).
2. Quan sát thứ tự: Upload/Thêm chữ -> Chọn khung -> Canvas.
3. Thêm một ảnh hoặc chữ vào Canvas.
4. Chọn đối tượng và di chuyển: Không có điểm chấm 4 góc màu burgundy và không có đường kẻ căn giữa xuất hiện.

## Kết quả Thực tế vs Kết quả Mong đợi
- **Thực tế**:
    - Mobile: Upload/Thêm chữ nằm trên Chọn khung và Canvas.
    - Đối tượng chọn: Dùng mặc định của Fabric.js (thường là các ô vuông xanh/trắng).
    - Di chuyển: Không có đường gióng hỗ trợ.
- **Mong đợi**:
    - Mobile: 1. Chọn Khung -> 2. Canvas -> 3. Upload/Thêm chữ.
    - Đối tượng chọn: 4 điểm chấm tròn ở góc, màu Burgundy (#800020).
    - Di chuyển/Thay đổi kích thước: Hiện đường kẻ đứt (hoặc liền) căn giữa dọc/ngang khi đối tượng ở vị trí trung tâm.

## Ngữ cảnh & Môi trường
- Hệ điều hành: Windows/iOS/Android.
- Trình duyệt: Chrome/Safari/Edge.
- Thư viện sử dụng: Next.js, Fabric.js v7.3.1, Tailwind CSS v4.

---

## Phân tích Nguyên nhân Gốc rễ (Root Cause Analysis)
1. **Về Layout**: Trong file `DesignToolCanvas.tsx`, JSX đang render Toolbar trước container chứa Frame và Canvas. Hiện tại chưa có class `order` để đảo thứ tự này trên mobile.
2. **Về Control Dots**: Fabric.js mặc định sử dụng `cornerStyle: 'rect'`. Cần cấu hình lại `Object.prototype` hoặc từng đối tượng để có style `circle` và màu `cornerColor` tương ứng với brand.
3. **Về Guidelines**: Logic căn gióng chưa được cài đặt. Cần bắt sự kiện `object:moving` và `object:scaling`, tính toán tọa độ đối tượng so với tâm Canvas (1772x1535) và vẽ các đường Line tạm thời.

**Sơ đồ luồng xử lý Guidelines:**
```ascii
[Object Moving] -> [Get Object Center] -> [Compare with Canvas Center (W/2, H/2)]
       |                    |                            |
       |                    |                  [Within Threshold (e.g. 5px)?]
       |                    |                            |
       |                    |                 /----------+----------\
       |                    |               [YES]                  [NO]
       |                    |                |                      |
       |                    |       [Snap to Center &        [Remove Lines &
       |                    |        Draw Red Line]           Render All]
       \--------------------/
```

## Đề xuất Sửa lỗi (Proposed Fixes)
1. **Bố cục Mobile (Khuyến nghị)**:
    - Đổi parent wrapper từ `space-y-4` → `flex flex-col gap-4` (gap-4 hoạt động đúng với flex `order`; `space-y-*` chỉ áp theo DOM order, sẽ sai khi đảo bằng `order`).
    - Thêm `order-first lg:order-none` cho Main Content (Frame + Canvas).
    - Toolbar, TextPropsPanel, Proceed Button giữ nguyên DOM order (mặc định `order: 0`) → trên mobile chúng nằm sau Main Content; trên desktop quay về thứ tự DOM ban đầu.
    - Kết quả mobile: `Frames+Canvas → Toolbar → (TextPropsPanel) → Proceed`. Desktop: `Toolbar → Frames+Canvas → (TextPropsPanel) → Proceed` (không đổi).

2. **Cải thiện điểm neo (Dots)**:
    - Sau khi `import("fabric")`, cấu hình `FabricObject.prototype` 1 lần để áp dụng global cho mọi object mới (text, image, …):
        - `cornerStyle: 'circle'`
        - `cornerColor: '#800020'`
        - `cornerStrokeColor: '#ffffff'`
        - `transparentCorners: false`
        - `cornerSize: 12`
        - `borderColor: '#800020'`
        - `padding: 2`

3. **Thêm đường kẻ căn giữa + snap nhẹ**:
    - Tạo 2 `Line` object (`vGuide`, `hGuide`) với `excludeFromExport: true` (không vào `toJSON()`/`toDataURL()`) + `selectable: false, evented: false`.
    - Bind `canvas.on('object:moving', …)`: tính `obj.getCenterPoint()`, nếu `|cx - canvas.width/2| < 8px` → set `obj.left` để snap + `vGuide.visible = true`. Tương tự cho trục Y.
    - Bind `canvas.on('object:scaling', …)`: chỉ hiển thị guide (không snap để không phá thao tác kéo scale).
    - Bind `canvas.on('mouse:up' | 'selection:cleared', …)`: ẩn guides.
    - Khi `handleApplyFrame` gọi `canvas.clear()` → guides bị xoá; hàm `ensureGuides()` sẽ tự re-create lần move kế tiếp.
    - Màu: `oklch(0.78 0.12 80)` (Gold) — tương phản với Burgundy của điểm neo. Stroke dashed `[10, 10]`, width 2.

## Kế hoạch Xác minh
1. **Kiểm tra Layout**: Dùng DevTools giả lập iPhone/Pixel để xem thứ tự các panel.
2. **Kiểm tra UI**: Thêm đối tượng, click chọn để xem 4 chấm tròn ở góc.
3. **Kiểm tra Logic**: Di chuyển đối tượng từ từ vào giữa canvas, xác nhận đường kẻ xuất hiện và đối tượng có cảm giác "hít" (snap) nhẹ vào tâm.
4. **Hồi quy**: Kiểm tra trên Desktop xem Toolbar có bị nhảy vị trí không (không được phép thay đổi).

---

## Fix Applied
- **Files Changed**:
    - `components/DesignTool/DesignToolCanvas.tsx`
        - Layout: parent wrapper `space-y-4` → `flex flex-col gap-4`; Main Area thêm `order-first lg:order-none`.
        - Selection controls: cấu hình `FabricObject.prototype` (circle dots, `#800020`, `cornerSize: 12`, white stroke, `padding: 2`).
        - Guidelines: thêm 2 `Line` (vGuide/hGuide) màu gold `#D4AF37` dashed `[10,10]`, `excludeFromExport: true`. Bind `object:moving` (snap + show), `object:scaling` (chỉ show), `mouse:up`/`selection:cleared` (hide). `ensureGuides()` re-tạo nếu canvas bị clear (đổi frame).
- **Test Results**:
    - `npm run build` → ✓ Compiled successfully + Generating static pages 27/27 OK.
    - Static verification script (12 checks) → 12 passed / 0 failed:
      ```
      PASS  Mobile layout: parent flex flex-col gap-4
      PASS  Mobile layout: order-first lg:order-none on main area
      PASS  Control dots: cornerStyle circle
      PASS  Control dots: cornerColor burgundy
      PASS  Control dots: transparentCorners false
      PASS  Guides: vGuide Line creation
      PASS  Guides: hGuide Line creation
      PASS  Guides: object:moving listener
      PASS  Guides: object:scaling listener
      PASS  Guides: excludeFromExport
      PASS  Guides: gold dashed stroke
      PASS  Guides: hideGuides on mouse:up
      ```
- **Verification**: Code đã đúng vị trí, type-check sạch, build pass. Cần kiểm tra thị giác cuối cùng trên trình duyệt (mobile viewport + desktop) sau khi Vercel preview build xong.
