# Báo cáo Lỗi

## Trạng thái
ĐÃ SỬA CHỮA (Lần 2) — Thành công, đợi verify trên production

## Tiêu đề Lỗi
Đơn hàng không có ảnh thiết kế để tải về (Mã đơn: DCO-20260510-1E68)

## Mô tả Lỗi
Khách hàng đặt hàng sau khi thiết kế, nhưng trong trang quản trị `/admin/don-hang`, cột "Thiết kế" hiển thị dấu gạch ngang (`—`) và không có nút "Tải về". Điều này khiến bộ phận sản xuất không có mẫu để in ấn.

## Các bước tái hiện
1. Truy cập trang thiết kế sản phẩm.
2. Thực hiện thiết kế (thêm chữ, ảnh).
3. Nhấn "Tiếp theo — Đặt hàng".
4. Hoàn tất thông tin đặt hàng và gửi đơn.
5. Kiểm tra trong Admin → Đơn hàng.
6. Quan sát: Cột "Thiết kế" của đơn hàng vừa tạo bị trống.

## Kết quả Thực tế vs Kết quả Mong đợi
- **Thực tế**: `design_image_url` trong database là `NULL`, Admin không thấy ảnh.
- **Mong đợi**: Phải có ảnh thiết kế (PNG/JPG) được lưu trữ trên Supabase Storage và liên kết với đơn hàng.

## Ngữ cảnh & Môi trường
- **Mã đơn lỗi**: `DCO-20260510-1E68`
- **File liên quan**:
  - `app/api/design/export/route.ts` (API xử lý upload ảnh)
  - `components/DesignTool/DesignToolCanvas.tsx` (Logic gửi ảnh từ frontend)
  - `app/api/orders/route.ts` (API tạo đơn hàng)

---

## Phân tích Nguyên nhân Gốc rễ (Root Cause Analysis)

Lỗi xảy ra do cơ chế **"Thất bại trong im lặng" (Silent Failure)** tại cả API và Frontend:

1. **API xử lý xuất ảnh (`/api/design/export`)**:
   Khi upload ảnh lên Supabase Storage thất bại (ví dụ: chưa tạo bucket `designs`, lỗi quyền hạn, hoặc hết dung lượng), API vẫn trả về status `200 OK` với `url: null`.
   ```ts
   // app/api/design/export/route.ts:40-44
   if (uploadError) {
     console.error("Storage upload error:", uploadError);
     // LỖI: Trả về 200 dù thất bại, khiến frontend tưởng là thành công
     return NextResponse.json({ url: null, error: "Upload failed" }, { status: 200 });
   }
   ```

2. **Frontend (`DesignToolCanvas.tsx`)**:
   Hàm `handleExport` không kiểm tra giá trị `designImageUrl` có hợp lệ hay không trước khi chuyển hướng người dùng sang trang đặt hàng.
   ```ts
   // components/DesignTool/DesignToolCanvas.tsx:644-668
   const res = await fetch("/api/design/export", ...);
   if (res.ok) { // res.ok là true vì API trả về 200
     const json = await res.json();
     designImageUrl = json.url; // designImageUrl sẽ là null
   }
   // Chuyển hướng dù không có ảnh
   router.push("/dat-hang");
   ```

**Luồng dữ liệu gây lỗi:**
```
[User Clicks "Next"]
      │
      ▼
[DesignToolCanvas: handleExport()] ──► [canvas.toDataURL()]
      │
      ▼
[POST /api/design/export]
      │
      ├─► [Supabase Storage: Upload to 'designs' bucket]
      │          │
      │   ❌ LỖI (Vd: Bucket 'designs' chưa được tạo - Step 3 trong README)
      │          │
      └─► [API trả về { url: null, error: "Upload failed" }, status: 200]
                 │
                 ▼
[DesignToolCanvas nhận url = null ──► Lưu vào sessionStorage ──► Redirect sang /dat-hang]
                 │
                 ▼
[Trang đặt hàng lấy data từ session ──► design_image_url = null ──► Gửi POST /api/orders]
                 │
                 ▼
[Database lưu order với design_image_url = NULL]
```

## Đề xuất Sửa lỗi (Proposed Fixes)

### 1. Sửa API Export (Khuyến nghị)
Thay đổi `app/api/design/export/route.ts` để trả về status lỗi (500) nếu upload không thành công. Điều này giúp frontend nhận biết được sự cố.

### 2. Cải thiện Frontend
Trong `DesignToolCanvas.tsx`, kiểm tra chặt chẽ kết quả trả về từ API. Nếu không có `url`, hiển thị thông báo lỗi (Toast/Alert) cho người dùng thay vì chuyển hướng.

### 3. Kiểm tra Cấu hình (Môi trường)
Xác nhận rằng bucket `designs` đã được tạo trong Supabase Dashboard và được thiết lập là **Public** (theo hướng dẫn trong `README.md`).

---

## Kế hoạch Xác minh
1. **Kiểm tra bucket**: Đăng nhập Supabase Dashboard, kiểm tra sự tồn tại của bucket `designs`.
2. **Test API**: Dùng Postman hoặc script test gửi request export, giả lập lỗi storage để xem API có trả về lỗi không.
3. **Test End-to-end**: Thực hiện thiết kế và đặt hàng trên môi trường staging, kiểm tra xem ảnh có xuất hiện trong Admin không.

---

## Kết quả Sửa lỗi (2026-05-10)

### Thay đổi áp dụng (Minimal changes)
1. **`app/api/design/export/route.ts`** — Đổi nhánh `uploadError` từ `status: 200, { url: null }` → `status: 500, { error, detail }`. API không còn fail-silently.
2. **`components/DesignTool/DesignToolCanvas.tsx` :: `handleExport`** — Thêm guard `if (!res.ok || !designImageUrl)`: hiển thị alert tiếng Việt và `return` sớm thay vì redirect sang `/dat-hang`. Chỉ khi có URL hợp lệ mới lưu sessionStorage và push router.

### Test
- Script: `scripts/test-design-export-fix.mjs` (regression guard + behavioral simulation).
- Lệnh: `node scripts/test-design-export-fix.mjs`
- Kết quả: **Thành công** — 10/10 test cases pass.

```
[API] app/api/design/export/route.ts
  PASS  returns status 500 in upload-error branch
  PASS  does NOT silently return 200 on upload error
  PASS  does NOT return null url payload (silent failure)

[FE] components/DesignTool/DesignToolCanvas.tsx :: handleExport
  PASS  guards on missing designImageUrl
  PASS  guards on non-OK response
  PASS  early-returns before redirecting

[Behavior] simulated route handler
  PASS  upload error -> status 500
  PASS  upload error -> no url in response body
  PASS  upload success -> status 200
  PASS  upload success -> url returned

All tests passed.
```

- `npm run build`: **Thành công** — Compiled successfully in 35.8s, TypeScript pass, 27/27 static pages generated.

### Lưu ý vận hành
- Bucket `designs` trên Supabase phải tồn tại và public (đề xuất #3 trong Proposed Fixes). Nếu bucket vẫn thiếu, người dùng giờ sẽ thấy alert thay vì đặt được đơn rỗng.
- Đơn `DCO-20260510-1E68` đã tạo trước fix vẫn không có ảnh (lịch sử) — fix chỉ áp dụng cho đơn mới.

---

## Phát hiện thêm (sau lần fix #1) — Vercel `FUNCTION_PAYLOAD_TOO_LARGE`

Sau khi deploy fix lần 1, người dùng vẫn thấy alert "Không tải được ảnh thiết kế". Truy nguyên: bucket OK, service role OK, upload local OK — nhưng Vercel function trả `413 FUNCTION_PAYLOAD_TOO_LARGE`. Vercel giới hạn body ~4.5MB cho serverless function.

Probe production:
- 8MB body → `413 FUNCTION_PAYLOAD_TOO_LARGE`
- 4MB body (≈3MB JPEG base64) → `200 OK`
- 5.3MB body (≈4MB JPEG base64) → `413`

Canvas xuất ra 1772×1535×multiplier 2 = 3544×3070, PNG có thể 5–15MB. Sau base64 inflation 33% thì luôn vượt 4.5MB → fail.

### Fix lần 2 (Minimal, vẫn tối thiểu)
1. **Frontend (`DesignToolCanvas.tsx :: handleExport`)**:
   - Đổi format export `png` → `jpeg` (q0.92), giữ `multiplier: 2`. Canvas đã có background trắng nên JPEG không mất transparency.
   - Đổi cách POST: `JSON {dataUrl}` → `multipart/form-data` với `Blob` (binary). Loại bỏ overhead 33% của base64.
2. **API (`/api/design/export`)**:
   - Tách logic đọc ảnh thành `readImage()` hỗ trợ cả `multipart/form-data` (path mới) và `application/json` dataURL (giữ tương thích ngược).
   - Logic upload, error handling, response giữ nguyên.

### Test (lần 2)
- `node scripts/test-design-export-fix.mjs`: **Thành công** — 12/12 PASS (thêm test cho FormData và backwards-compat JSON).
- `npm run build`: **Thành công** — Compiled in 23.3s, 27/27 pages generated.
- Production smoke test (sau deploy): xem section "Verify production" bên dưới.
