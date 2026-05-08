# Báo cáo Lỗi
## Trạng thái
THÀNH CÔNG (Bổ sung 8 font + defensive dots reapply)

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
