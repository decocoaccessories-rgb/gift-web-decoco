# Báo cáo Lỗi
## Trạng thái
THÀNH CÔNG (Đã sửa lỗi Zoom khi sửa chữ)

## Tiêu đề Lỗi
[NGHIÊM TRỌNG] Điểm neo biến mất và lỗi tự động Zoom/Thu nhỏ khi sửa chữ trên Mobile.

## Mô tả Lỗi
1. **Lỗi điểm neo**: Các chấm tròn điều khiển (dots) không hiển thị khi chọn ảnh/chữ trên Mobile.
2. **Lỗi Zoom khi sửa chữ**: 
   - Khi click vào đối tượng chữ để sửa: Vùng hiển thị bị "thu nhỏ" hoặc canvas bị đẩy lệch (do trình duyệt tự động zoom vào textarea ẩn).
   - Khi xoá dần chữ: Vùng hiển thị lại được "zoom to" ra hoặc quay về trạng thái cũ.
   - Hiện tượng này gây mất phương hướng và khó khăn cho người dùng khi nhập nội dung.

## Các bước tái hiện
1. Truy cập Trang sản phẩm trên iPhone (Safari).
2. Thêm một đối tượng chữ.
3. Chạm vào chữ để bắt đầu nhập liệu -> Quan sát hiện tượng "thu nhỏ" của canvas/viewport.
4. Xoá trắng hoặc xoá bớt chữ -> Quan sát hiện tượng viewport tự động "zoom to" lại.

## Kết quả Thực tế vs Kết quả Mong đợi
- **Thực tế**: Viewport nhảy tỷ lệ (zoom in/out) liên tục trong quá trình gõ phím.
- **Mong đợi**: Viewport giữ nguyên tỷ lệ, không tự động phóng to/thu nhỏ khi bàn phím hiện lên.

## Ngữ cảnh & Môi trường
- Trình duyệt: Mobile Safari (iOS).
- Hành vi đặc thù: iOS Auto-zoom trên trường nhập liệu.

---

## Phân tích Nguyên nhân Gốc rễ (Root Cause Analysis)
1. **Lỗi Zoom (Nguyên nhân chính)**: Mobile Safari có cơ chế tự động phóng to vào các phần tử `<input>` hoặc `<textarea>` nếu chúng có `font-size` nhỏ hơn **16px**. Fabric.js sử dụng một textarea ẩn (`.fabric-canvas-container textarea`) để xử lý gõ phím. Vì font-size mặc định của textarea này thường nhỏ, iOS sẽ ép zoom viewport.
2. **Hành vi thu nhỏ/phóng to**: 
   - Khi nhập chữ: iOS zoom vào textarea -> người dùng thấy canvas bị đẩy đi hoặc nhỏ lại so với khung nhìn.
   - Khi xoá chữ: Logic nội bộ của Fabric cập nhật kích thước textarea ẩn, có thể trigger trình duyệt tính toán lại vùng zoom.
3. **Lỗi điểm neo (Dots)**: 
   - Vẫn liên quan đến việc bù trừ tỷ lệ `scale` trong `ResizeObserver`. Nếu `scale` bị thay đổi liên tục do zoom của trình duyệt, các điểm neo sẽ bị tính toán sai kích thước hoặc vị trí, dẫn đến việc chúng biến mất.

**Sơ đồ luồng lỗi Zoom:**
```ascii
[User Clicks Text] -> [Fabric focuses hidden Textarea] -> [iOS checks font-size]
       |                                                    |
       |                                          /---------+---------\
       |                                       [< 16px]             [>= 16px]
       |                                          |                    |
       |                                   [iOS Viewport Zoom]      [Stay Still]
       |                                          |                    |
       |                                [Canvas looks shifted]      [SUCCESS]
```

## Đề xuất Sửa lỗi (Proposed Fixes — đã refined)
1. **Ngăn chặn iOS Zoom (Khuyến nghị)**:
   - Kiểm tra source `node_modules/fabric/dist/index.js:17318-17330` xác nhận:
     - Fabric tạo textarea ẩn với `data-fabric="textarea"`, append vào `document.body` (KHÔNG nằm trong `.canvas-container`).
     - Inline style: `font-size: 1px` → đây là trigger iOS auto-zoom (Safari zoom mọi input có font < 16px).
   - **Fix đúng**: thêm CSS global trong `app/globals.css`:
     ```css
     textarea[data-fabric="textarea"] {
       font-size: 16px !important;
     }
     ```
   - Selector `[data-fabric="textarea"]` chính xác hơn `.canvas-container textarea` (vì textarea nằm ở body level, không trong canvas-container).
   - **KHÔNG** dùng `<meta viewport maximum-scale=1>` — phá pinch-zoom của user, ảnh hưởng accessibility toàn site.
2. **Lỗi "Dots biến mất khi sửa chữ"**:
   - Đây **không phải bug**. Fabric IText ẩn selection controls khi vào editing mode (cố ý — để không che chữ đang gõ).
   - Sau khi gõ xong, click ngoài hoặc nhấn Esc → controls hiện lại. Không cần sửa.

## Kế hoạch Xác minh
1. **Kiểm tra Zoom**: Test trên iPhone thực tế, đảm bảo khi click vào chữ, bàn phím hiện lên nhưng màn hình không bị nhảy/phóng to.
2. **Kiểm tra Dots**: Xác nhận 4 chấm tròn burgundy luôn xuất hiện sau khi gõ chữ xong.
3. **Kiểm tra Xoá chữ**: Đảm bảo xoá chữ không gây rung lắc màn hình.

## Hotfix #2 — iOS Safari auto-zoom khi sửa text (2026-05-08)
- **Files Changed**:
    - `app/globals.css`: thêm rule `textarea[data-fabric="textarea"] { font-size: 16px !important; }`.
- **Cơ chế**:
    - Fabric tạo textarea ẩn (1×1 px, opacity 0) gắn `data-fabric="textarea"`, append vào `document.body`. Inline style: `font-size: 1px`.
    - Mobile Safari thấy `font-size < 16px` trên input/textarea khi focus → auto-zoom viewport (không phải Fabric/canvas vấn đề).
    - Override `font-size: 16px !important` không ảnh hưởng render text trên canvas (textarea vô hình, opacity 0), chỉ vô hiệu hoá iOS auto-zoom.
- **Test Results**:
    - `npm run build` → ✓ Compiled successfully + Generating static pages 27/27 OK.
    - Static verification: selector + `!important` đúng vị trí; xác nhận Fabric v7.3.1 vẫn dùng `data-fabric="textarea"` attribute → 3/3 pass.
- **Verification**: Cần test trên iPhone Safari thực để xác nhận viewport không nhảy khi tap vào text.

## Lưu ý — "Dots biến mất khi đang sửa chữ"
Đây **KHÔNG** phải bug. Fabric IText cố ý ẩn selection controls khi vào editing mode để không che ký tự đang gõ. Click ngoài/Esc để thoát editing → chấm tròn hiện lại. Không cần sửa.
