# Báo cáo Lỗi
## Trạng thái
THÀNH CÔNG (Hotfix #5c: double-tap mobile + long-press select word + sync textarea)

## [Hotfix #5c] 3 vấn đề mới sau 5b
1. **Double-tap không selectAll**: Fabric `mousedblclick` chỉ fire từ native browser `dblclick` (`node_modules/fabric/dist/index.js:12136`). Mobile Safari KHÔNG dispatch `dblclick` reliable cho touch → override `doubleClickHandler` của ta không bao giờ được gọi.
   - **Fix**: detect double-tap thủ công trong `mouse:down` handler (2 taps trong 300ms + cách nhau < 40 scene-px).
2. **Long-press hiện chỉ bôi đen 1 chữ cái** (idx → idx+1), user muốn 1 từ.
   - **Fix**: dùng `t.selectWord(idx)` (`fabric/dist/index.js:16837`). Hàm này tự `searchWordBoundary` 2 chiều và gọi `_updateTextarea` + `renderCursorOrSelection`.
3. **Backspace từ keyboard xoá chữ đầu tiên thay vì chữ trước cursor**: khi ta tự set `selectionStart/End` thủ công cho cursor follow, hidden textarea (Fabric L17318) không được sync → `selectionStart/End` của textarea vẫn là 0/0 → keyboard input handler đọc từ textarea → tác động ở vị trí 0.
   - **Fix**: gọi `t._updateTextarea()` (L16958) sau mỗi lần set selectionStart/End thủ công. Hàm này sync `hiddenTextarea.selectionStart/End` với IText state.

### Test Results (5c)
- `npm run build` → ✓ Compiled successfully + 27/27 pages OK.
- Static verification 10/10 pass:
  ```
  PASS  Manual double-tap detection in mouse:down
  PASS  Double-tap calls selectAll
  PASS  Long-press calls selectWord (not selectionEnd=idx+1)
  PASS  No more idx+1 single-char selection
  PASS  moveCursorTo calls _updateTextarea after setting selection
  PASS  DOUBLE_TAP_MS=300
  PASS  DOUBLE_TAP_PX2=40*40
  PASS  Fabric: selectWord exists
  PASS  Fabric: _updateTextarea exists
  PASS  Fabric: dblclick gated on native event
  ```

### Verification cần làm trên iPhone (sau khi Vercel deploy)
1. Thêm chữ → tap để vào edit mode → tap 2 lần nhanh (trong 300ms) → bôi đen TOÀN BỘ chữ.
2. Trong edit mode, giữ ngón tay yên ~0.5s trên 1 từ → cả TỪ đó được bôi đen (không phải 1 chữ cái).
3. Hold + drag → cursor chạy theo ngón tay; nhấn nút Backspace trên bàn phím → chữ TRƯỚC CURSOR bị xoá (không còn xoá chữ đầu tiên).

## [Hotfix #5] Mobile touch interactions cho IText editing
### Yêu cầu
Trên mobile, trong Công cụ thiết kế:
1. **Bấm 2 lần (double-tap)** vào text → bôi đen TOÀN BỘ chữ.
2. **Giữ tay (long-press)** ở 1 chữ cái → bôi đen chữ cái đó.
3. **Giữ tay + di chuyển (long-press + drag)** → con trỏ chạy theo ngón tay sang vị trí chữ cái mới.

### Phân tích & Đề xuất Sửa lỗi
- Verify Fabric source `node_modules/fabric/dist/index.js`:
    - L17763 `doubleClickHandler`: mặc định gọi `selectWord` → cần override sang `selectAll`.
    - L16736 `selectAll()` + L17838 `getSelectionStartFromPointer(e)` + `renderCursorOrSelection()` đều có sẵn.
- **Fix**:
    - Override `IText.prototype.doubleClickHandler` → `selectAll() + renderCursorOrSelection()`.
    - Thêm canvas listener `mouse:down/move/up`:
        - mousedown trên IText.isEditing → start timer 400ms.
        - Trong khoảng đó, nếu di chuyển > ~30 scene-px (≈10 screen-px ở scale 0.34) → cancel timer (drag-select bình thường của Fabric).
        - Timer bắn → `selectionStart = idx; selectionEnd = idx+1` (bôi 1 chữ).
        - Sau khi long-press active, mỗi mousemove → `selectionStart = selectionEnd = idx` (cursor follows finger).
        - mouseup → reset state.

### Test Results
- `npm run build` → ✓ Compiled successfully + 27/27 static pages OK.
- Static verification 10/10 pass:
  ```
  PASS  IText imported in dynamic import
  PASS  doubleClickHandler overridden to selectAll
  PASS  LONG_PRESS_MS defined
  PASS  mouse:down sets press timer
  PASS  long-press selects single char
  PASS  mouse:move updates cursor while longPressActive
  PASS  movement cancels timer
  PASS  mouse:up resets state
  PASS  Fabric: doubleClickHandler exists
  PASS  Fabric: selectAll exists
  ```

### Verification cần làm trên iPhone
1. Thêm chữ → tap 1 lần để vào edit mode → tap 2 lần nhanh → bôi đen toàn bộ chữ.
2. Ở trạng thái edit, giữ ngón tay yên trên 1 chữ ~0.5s → chữ đó được bôi đen.
3. Trong khi đang giữ, kéo ngón tay sang chữ khác → cursor (vạch nháy) chạy theo ngón tay.
4. Tap rồi kéo nhanh (không giữ) → vẫn drag-select range như mặc định Fabric (không bị phá).

## Hotfix #5b — Disable Fabric drag-select (2026-05-08)
- **User report**: "giữ tay và di chuyển thì vẫn là bôi đen chữ từ chỗ tôi bắt đầu chạm tay đến chữ mà tôi di tay qua".
- **Phát hiện root cause**:
    - Verify `node_modules/fabric/dist/index.js:12517`: trong `__onMouseMove`, Fabric gọi `this.textEditingManager.onMouseMove(e)` TRƯỚC khi emit `mouse:move`.
    - `textEditingManager.onMouseMove` (L11767) gọi `target.updateSelectionOnMouseMove(e)` (L16897) — đây mới là chỗ Fabric mở rộng selectionEnd theo finger → tạo range "từ điểm chạm đến điểm hiện tại".
    - Listener `canvas.on("mouse:move")` của ta chạy SAU, nhưng nếu finger di chuyển quá MOVE_CANCEL_PX2 (30 scene-px ≈ 10 screen-px) trước khi timer 400ms bắn → `pressTimer` bị huỷ → `longPressActive = false` mãi → handler chỉ no-op → Fabric range giữ nguyên.
    - Trên mobile, finger jitter dễ vượt 10 screen-px → dễ rơi vào case này.
- **Fix mới (Hotfix #5b)**:
    - **Override `IText.prototype.updateSelectionOnMouseMove` thành no-op** → vô hiệu hoá Fabric drag-select hoàn toàn. Cursor giờ do canvas mouse handler của ta quản lý 100%.
    - Logic mới đơn giản hơn:
        - mousedown trên IText.isEditing → start 400ms timer.
        - mousemove khi `isPressed`: cursor follow finger (single-pos, không range).
        - timer fires → `selectionStart=idx, selectionEnd=idx+1` (bôi 1 chữ), lưu `longPressOrigin`.
        - sau long-press, mousemove giữ 1-char selection nếu finger chưa di chuyển > 25 scene-px; vượt threshold → cursor follow finger (range collapse).
        - mouseup → reset state.
    - Bỏ logic `MOVE_CANCEL_PX2` (timer luôn bắn — không cần huỷ vì Fabric drag-select đã chết).

### Test Results (5b)
- `npm run build` → ✓ Compiled successfully + 27/27 pages OK.
- Static verification 9/9 pass:
  ```
  PASS  Override updateSelectionOnMouseMove to no-op
  PASS  Override doubleClickHandler to selectAll
  PASS  Helper moveCursorTo collapses selection
  PASS  mouse:move uses moveCursorTo when pressed
  PASS  HOLD_THRESHOLD_PX2 defined
  PASS  No more MOVE_CANCEL_PX2 cancel logic
  PASS  mouse:up resets isPressed and longPressActive
  PASS  Fabric: updateSelectionOnMouseMove still in source (target of override)
  PASS  Fabric: textEditingManager calls updateSelectionOnMouseMove
  ```
- **Lưu ý hành vi sau Hotfix 5b**:
    - Drag-select range của Fabric đã bị **vô hiệu hoá globally** cho IText. Nếu sau này muốn drag-select range trở lại (ví dụ trên desktop), cần khôi phục `updateSelectionOnMouseMove` (hoặc gating theo touch device).
    - Tap + drag bây giờ luôn = cursor follow finger (single-pos). Đây là behavior phù hợp cho design tool text ngắn.

## Tiêu đề Lỗi
[TIẾP TỤC] 4 chấm tròn vẫn mất, màn hình dịch chuyển và lỗi không đổi Font chữ.

## Mô tả Lỗi
1. **4 Chấm tròn**: Vẫn chưa hiển thị màu burgundy ở 4 góc đối tượng.
2. **Dịch chuyển màn hình (Shifting)**: Khi click sửa chữ, trang web bị cuộn lên làm mất dấu canvas.
3. **Lỗi Font chữ**:
   - Các font từ vị trí thứ 4 (`Pacifico`) trở xuống trong danh sách không có tác dụng khi chọn.
   - Chỉ có 3 font đầu tiên có sự thay đổi (thực tế có thể chỉ 2 font hệ thống đã load).

## Các bước tái hiện
1. Truy cập Trang sản phẩm -> Thêm chữ.
2. Mở danh sách Font trong phần Thuộc tính chữ.
3. Chọn các font như `Pacifico`, `Montserrat`, `Raleway`...
4. **Kết quả**: Chữ trên canvas không thay đổi kiểu dáng, giữ nguyên font mặc định.

## Kết quả Thực tế vs Kết quả Mong đợi
- **Thực tế**: Chỉ một số ít font hoạt động, các font nghệ thuật/fancy không hiển thị đúng.
- **Mong đợi**: Toàn bộ 10 font trong danh sách phải hiển thị đúng kiểu dáng khi chọn.

---

## Phân tích Nguyên nhân Gốc rễ (Root Cause Analysis)
1. **Lỗi Font chữ**: Các font như `Pacifico`, `Montserrat`, `Lobster`... chưa được import vào dự án. Trong Next.js, cần khai báo các font này trong `layout.tsx` sử dụng `next/font/google` để trình duyệt tải về. Hiện tại chỉ có `Be Vietnam Pro` và `Playfair Display` được load chính thức.
2. **Lỗi Dịch chuyển (Page Shift)**: Trình duyệt cố gắng cuộn trang để đưa textarea ẩn của Fabric vào vùng nhìn thấy được trên bàn phím.
3. **Lỗi 4 chấm tròn (Dots)**: Cấu hình Prototype không đủ để ghi đè các control đã được cache của Fabric v7.

**Sơ đồ luồng lỗi Font:**
```ascii
[Select Font: Pacifico] -> [Fabric sets fontFamily: 'Pacifico']
       |                                |
       |                  [Browser checks local/loaded fonts]
       |                                |
       |                 /----------+----------\
       |            [Not Found]              [Found]
       |                |                      |
       |        [Fallback to Serif]       [Render Pacifico]
       |                |                      |
       \--------> [RESULT: NO CHANGE]      [SUCCESS]
```

## Đề xuất Sửa lỗi (Proposed Fixes — refined)
1. **Tải đầy đủ Font chữ (Khuyến nghị)**:
   - Verify trong `components/DesignTool/TextPropsPanel.tsx:8-19`: dropdown liệt kê 10 font; chỉ `Be Vietnam Pro` + `Playfair Display` được load qua `next/font/google` ở `app/layout.tsx:6-18`. 8 font khác KHÔNG được load → browser fallback → không thay đổi được kiểu chữ.
   - **Fix**: Dùng Google Fonts CDN qua `<link>` trong `app/layout.tsx` (đơn giản hơn 8 next/font imports cho design-tool fonts; preconnect để giảm latency).
   - **Đồng thời**: trong `TextPropsPanel.tsx`, `await document.fonts.load("16px <fontFamily>")` trước khi `applyProp` — tránh canvas vẽ bằng fallback trong khi font đang download (Fabric đo dimensions tại thời điểm `renderAll`).

2. **Page Shift & Dots**: Đã fix ở Hotfix #3 (commit 57552b8). Nếu vẫn còn:
   - Có thể Vercel chưa deploy xong / browser cache → cần hard-refresh hoặc đợi vài phút.
   - **Defensive bổ sung**: thêm listener `canvas.on("selection:created", …)` re-apply scale-compensated `cornerSize/sizeX/sizeY` ngay khi user click chọn object — bảo vệ khỏi race condition khi object được add trước khi ResizeObserver fire (lúc đó `scaleRef.current` còn là 1).

## Kế hoạch Xác minh
1. **Test Font**: Chọn lần lượt 10 font, đảm bảo mỗi font đều hiển thị kiểu dáng riêng biệt.
2. **Test Shifting**: Sửa chữ mà không bị cuộn trang.
3. **Test Dots**: Hiện đầy đủ 4 chấm tròn ở góc.

## Hotfix #4 — Fonts + defensive dots (2026-05-08)
- **Files Changed**:
    - `app/layout.tsx`: Thêm `<link>` Google Fonts (preconnect + stylesheet) load 8 font còn thiếu: Dancing Script, Great Vibes, Lobster, Montserrat, Nunito, Oswald, Pacifico, Raleway. (Be Vietnam Pro + Playfair Display vẫn qua `next/font` như cũ.)
    - `components/DesignTool/TextPropsPanel.tsx`: `await document.fonts.load("16px <font>")` trước khi `applyProp({ fontFamily })` — đảm bảo font đã download xong trước khi Fabric đo dimensions và `renderAll`.
    - `components/DesignTool/DesignToolCanvas.tsx`: Thêm defensive re-apply `cornerSize/touchCornerSize/borderScaleFactor` + per-control `sizeX/sizeY` trong handler `selection:created` (chống race condition khi object được add trước ResizeObserver).
- **Test Results**:
    - `npm run build` → ✓ Compiled successfully + 27/27 static pages OK, không warning.
    - Static verification 12/12 pass:
      ```
      PASS  Layout: preconnect Google Fonts
      PASS  Layout: preconnect gstatic
      PASS  TextPropsPanel: awaits document.fonts.load
      PASS  Canvas: selection:created applies cornerSize
      PASS  Layout loads font: Dancing+Script
      PASS  Layout loads font: Pacifico
      PASS  Layout loads font: Montserrat
      PASS  Layout loads font: Nunito
      PASS  Layout loads font: Lobster
      PASS  Layout loads font: Oswald
      PASS  Layout loads font: Raleway
      PASS  Layout loads font: Great+Vibes
      ```
- **Verification cần làm**:
    - Sau khi Vercel deploy, vào `/san-pham/[slug]` trên iPhone:
        - Thêm chữ → dropdown Font, chọn từng font (Pacifico, Montserrat, …) → text trên canvas đổi kiểu rõ ràng.
        - Tap vào chữ để sửa → canvas vẫn ở vị trí cũ, không bị đẩy lên.
        - Upload ảnh → click chọn → 4 chấm tròn burgundy rõ ở 4 góc.
- **Lưu ý**: Page-shift + dots size đã fix ở Hotfix #2/#3 (commit `ca56972`/`57552b8`). Nếu user vẫn thấy lỗi, hãy hard-refresh (Cmd+Shift+R / clear Safari cache) hoặc đợi Vercel deploy xong (~1-2 phút).
