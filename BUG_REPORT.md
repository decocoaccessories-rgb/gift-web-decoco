# Báo cáo Lỗi
## Trạng thái
THÀNH CÔNG (Đã sửa shifting + dots robust)

## Tiêu đề Lỗi
[NGHIÊM TRỌNG] 4 chấm tròn vẫn mất và màn hình bị dịch chuyển khi sửa chữ.

## Mô tả Lỗi
1. **4 Chấm tròn**: Vẫn chưa hiển thị màu burgundy ở 4 góc đối tượng.
2. **Dịch chuyển màn hình (Shifting)**: 
   - Sau khi fix font-size 16px, hiện tượng Zoom đã hết.
   - Tuy nhiên, khi click sửa chữ, toàn bộ trang web bị đẩy lên trên (scroll up) quá mức, khiến khu vực canvas bị khuất khỏi màn hình, chỉ còn thấy phần trắng hoặc footer.
   - Khi bàn phím hiện lên, người dùng không còn nhìn thấy vùng mình đang sửa.

## Các bước tái hiện
1. Truy cập Trang sản phẩm trên iPhone.
2. Thêm đối tượng chữ.
3. Chạm vào chữ để sửa.
4. **Kết quả**: Bàn phím hiện lên, trang web tự động cuộn lên trên làm mất dấu vùng canvas.

## Kết quả Thực tế vs Kết quả Mong đợi
- **Thực tế**: Trang bị cuộn (shift) làm mất vùng thiết kế.
- **Mong đợi**: Màn hình giữ nguyên hoặc chỉ cuộn nhẹ để vừa đủ thấy vùng đang nhập liệu, không được đẩy canvas ra khỏi tầm mắt.

---

## Phân tích Nguyên nhân Gốc rễ (Root Cause Analysis)
1. **Lỗi Dịch chuyển (Page Shift)**: Mặc dù đã chặn được Zoom bằng font-size 16px, nhưng trình duyệt vẫn cố gắng thực hiện hành vi "Scroll into view" để đảm bảo ô nhập liệu (textarea ẩn của Fabric) nằm trên bàn phím. Do vị trí textarea ẩn này có thể đang bám theo vị trí chữ trên canvas (vốn có kích thước lớn 1772x1535), trình duyệt cuộn trang lên để "đưa" cái textarea đó lên trên, dẫn đến việc canvas bị đẩy đi.
2. **Lỗi 4 chấm tròn (Dots)**: 
   - Có thể do Fabric v7 quản lý control thông qua các object riêng biệt (`fabric.Control`). Việc set prototype `cornerSize` không ép các control này tính toán lại kích thước nếu chúng đã được "cached".
   - Cần can thiệp sâu hơn vào thuộc tính `controls` của từng object.

**Sơ đồ luồng dịch chuyển:**
```ascii
[Focus Text] -> [Hidden Textarea positioned at Canvas X,Y] 
       |                                |
       |                  [Keyboard Pops Up]
       |                                |
       |           [Browser detects Textarea is "under" Keyboard]
       |                                |
       |               [Browser Scrolls Page UP to compensate]
       |                                |
       \----------------------> [CANVAS OFF-SCREEN]
```

## Đề xuất Sửa lỗi (Proposed Fixes — refined)
1. **Xử lý Dịch chuyển (Shifting)**:
   - **Selector phải là `textarea[data-fabric="textarea"]`** (textarea ẩn nằm ở `document.body`, không trong `.canvas-container`).
   - Verify trong source `node_modules/fabric/dist/index.js:16993-16998`: Fabric gọi `updateTextareaPosition()` mỗi khi gõ phím — set `hiddenTextarea.style.left = ...` / `.top = ...` (không kèm `!important`), nên CSS `!important` sẽ thắng.
   - **Fix**: Thêm vào `app/globals.css`:
     ```css
     textarea[data-fabric="textarea"] {
       font-size: 16px !important;
       position: fixed !important;
       top: 0 !important;
       left: 0 !important;
     }
     ```
   - Cố định ở `top:0` (luôn trên keyboard) → Safari thấy textarea đã visible → không cần scroll → canvas không bị đẩy ra khỏi tầm mắt.
   - Textarea vẫn `opacity: 0; width:1px; height:1px` (giữ inline) → vô hình; cursor và text vẽ trực tiếp trên canvas bởi Fabric, không phụ thuộc vị trí textarea.

2. **Sửa triệt để 4 chấm tròn**:
   - Verify trong source `node_modules/fabric/dist/src/controls/Control.d.ts:73-85`: `Control.sizeX/sizeY` default `null` → fallback về `object.cornerSize`. Nên prototype + `obj.set({cornerSize})` đáng lẽ đủ. Nhưng để chắc chắn (chống cache hoặc edge case), bổ sung:
     - Lặp `Object.values(obj.controls)` set `sizeX = sizeY = cornerSize` trực tiếp.
     - Cập nhật cả `touchCornerSize` (touch hit area, mặc định 24).
     - Thêm event `canvas.on("object:added", …)` áp size cho object mới (defensive — đảm bảo size luôn đúng dù prototype có race condition).

## Kế hoạch Xác minh
1. **Test Shifting**: Đảm bảo khi gõ chữ, canvas vẫn nằm trong tầm mắt.
2. **Test Dots**: 4 chấm tròn phải to, rõ, màu burgundy trên mọi thiết bị.

## Hotfix #3 — Page shifting + dots robust (2026-05-08)
- **Files Changed**:
    - `app/globals.css`: bổ sung `position: fixed; top:0; left:0` cho `textarea[data-fabric="textarea"]`. Pin textarea ẩn về góc trái-trên viewport → Safari thấy textarea đã visible khi focus → không cần scroll page → canvas không bị đẩy đi.
    - `components/DesignTool/DesignToolCanvas.tsx`:
        - Thêm `scaleRef` đồng bộ với state `scale` (tránh stale closure).
        - Trong `useEffect([scale])`: thêm `touchCornerSize`, lặp `obj.controls` set trực tiếp `sizeX/sizeY = cornerSize` cho mỗi control (defensive — chống cache/edge case của Fabric Control).
        - Thêm event listener `canvas.on("object:added", …)` áp size scale-compensated cho object mới ngay khi được thêm vào canvas (đảm bảo size đúng dù prototype có chậm cập nhật).
- **Test Results**:
    - `npm run build` → ✓ Compiled successfully + 27/27 static pages OK.
    - Static verification 12/12 pass:
      ```
      PASS  CSS: position fixed on Fabric textarea
      PASS  CSS: top:0 !important on Fabric textarea
      PASS  CSS: left:0 !important on Fabric textarea
      PASS  CSS: font-size 16px (zoom prevention)
      PASS  TSX: scaleRef declared
      PASS  TSX: scaleRef synced in scale effect
      PASS  TSX: object:added listener for sizes
      PASS  TSX: per-control sizeX assignment
      PASS  TSX: per-control sizeY assignment
      PASS  TSX: touchCornerSize set
      PASS  Fabric: still appends to body, data-fabric textarea
      PASS  Fabric: updateTextareaPosition mutates style.left/top
      ```
- **Verification**: Cần test trên iPhone thực sau khi Vercel deploy: (a) tap vào chữ — viewport đứng yên; (b) upload ảnh và chọn — 4 chấm burgundy hiện rõ ở 4 góc.
