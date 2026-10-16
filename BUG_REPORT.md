# Báo cáo Lỗi

## Trạng thái
ĐÃ SỬA XONG — THÀNH CÔNG (xác minh 16/10/2026, 30/30 case PASS)

## Tiêu đề Lỗi
Sửa thông tin / tên phân loại sản phẩm trong Admin (`/admin/san-pham`) thành công vào CSDL nhưng trên website (`/san-pham/[slug]`) không hiển thị bản cập nhật ngay do thiếu `revalidatePath`.

## Mô tả Lỗi
Người quản trị vào trang Admin (`/admin/san-pham`), mở hộp thoại chỉnh sửa sản phẩm "Set SAKURA hoa anh đào - Dây chuyền và vòng tay" và sửa tên các phân loại (ví dụ từ `Thiệp 3d` thành `Thiệp 3D`), sau đó lưu lại.
- Dữ liệu trong CSDL Supabase đã được cập nhật thành công (đã xác thực qua database record: `updated_at: 2026-10-16T09:46:40Z` với tên các phân loại đã lưu chuẩn thành `Thiệp 3D`).
- Tuy nhiên, khi truy cập vào trang chi tiết sản phẩm ngoài website (`https://trangsucdecoco.vn/san-pham/set-sakura-co-4-la-2-mon`), giao diện vẫn hiển thị tên cũ (`Thiệp 3d`) trong vòng 5 phút (300 giây) sau khi lưu.
- Nguyên nhân: API cập nhật sản phẩm `PATCH /api/admin/products/[id]` không gọi `revalidatePath` để xóa cache Next.js Data Cache / ISR, trong khi client đọc dữ liệu ngoài site (`createPublicClient`) cấu hình cache tự động 300 giây (`revalidate: 300`).

## Các bước tái hiện
1. Đăng nhập trang Admin, vào mục **Sản phẩm** (`/admin/san-pham`).
2. Nhấn nút "Sửa" tại sản phẩm "Set SAKURA hoa anh đào".
3. Thay đổi tên phân loại (hoặc giá, tồn kho phân loại, ảnh) rồi nhấn **Lưu thay đổi**.
4. Mở tab mới hoặc chuyển sang tab website xem trang chi tiết sản phẩm (`/san-pham/set-sakura-co-4-la-2-mon`).
5. Quan sát: Tên phân loại vẫn giữ giá trị cũ trước khi sửa; phải đợi hết 300 giây (5 phút) cache của Next.js mới tự hết hạn và tải lại dữ liệu mới.

## Kết quả Thực tế vs Kết quả Mong đợi
- **Kết quả Thực tế**: Sau khi bấm Lưu trong Admin, dữ liệu trong CSDL đã đổi nhưng website ngoài vẫn hiển thị phiên bản cũ do Next.js Data Cache lưu giữ 300 giây mà không nhận được lệnh revalidate.
- **Kết quả Mong đợi**: Ngay sau khi bấm Lưu trong Admin, cache trang chi tiết sản phẩm (`/san-pham/[slug]`), trang danh sách (`/san-pham`) và trang chủ (`/`) được làm mới ngay lập tức (On-demand Revalidation). Người dùng F5 hoặc truy cập lại web sẽ thấy ngay nội dung vừa sửa.

## Ngữ cảnh & Môi trường
- **Môi trường**: Next.js 16 (App Router), Vercel Serverless / ISR, Supabase PostgreSQL.
- **File liên quan**:
  - `app/api/admin/products/[id]/route.ts`: API `PATCH` và `DELETE` sản phẩm.
  - `app/api/admin/products/route.ts`: API `POST` tạo sản phẩm mới.
  - `lib/supabase/server.ts`: Hàm `createPublicClient()` cấu hình `next: { revalidate: 300 }`.
  - `app/(site)/san-pham/[slug]/page.tsx`: Trang chi tiết sản phẩm đọc dữ liệu qua `createPublicClient()`.

---

## Phân tích Nguyên nhân Gốc rễ (Root Cause Analysis)

### 1. Chi tiết kỹ thuật:
1. **API route cập nhật sản phẩm thiếu lệnh `revalidatePath`**:
   - Trong `app/api/admin/products/[id]/route.ts` (dòng 25-50), hàm `PATCH` nhận payload từ Admin, gọi `admin.from("products").update(...)` và trả về kết quả JSON.
   - Hoàn toàn **không có bất kỳ dòng code nào gọi `revalidatePath`**.
   - Tương tự, hàm `DELETE` trong cùng file và hàm `POST` tạo sản phẩm mới trong `app/api/admin/products/route.ts` cũng thiếu `revalidatePath`.
   
2. **Cơ chế Cache Data 300 giây của `createPublicClient`**:
   - Trong `lib/supabase/server.ts` (dòng 38-45), hàm `createPublicClient()` đóng gói fetch với cấu hình:
     ```ts
     global: {
       fetch: (input, init) =>
         fetch(input, {
           ...init,
           next: { revalidate: 300 },
         }),
     }
     ```
   - Trang `/san-pham/[slug]/page.tsx` gọi hàm `getProduct()` sử dụng `createPublicClient()`.
   - Do đó, Next.js Data Cache lưu phản hồi truy vấn sản phẩm trong **300 giây (5 phút)**.
   - Khi Admin cập nhật phân loại sản phẩm trong DB lúc 16:46:40, người dùng xem trang lúc 16:50:00 (sau 3.5 phút) vẫn nhận về bản cache cũ (chưa đủ 5 phút để cache tự hết hạn).
   - Đến 16:55:00 (sau hơn 5 phút), cache tự hết hạn thì trang mới hiển thị bản mới `Thiệp 3D`.

3. **So sánh với chức năng Reorder sản phẩm đã làm trước đó**:
   - Ở tính năng sắp xếp thứ tự sản phẩm (`app/api/admin/products/reorder/route.ts:48-49`), hệ thống đã áp dụng thành công:
     ```ts
     revalidatePath("/");
     revalidatePath("/san-pham");
     ```
   - Tuy nhiên các nhánh CRUD cơ bản (`PATCH`, `POST`, `DELETE`) của sản phẩm lại chưa được bổ sung cơ chế này.

### 2. Biểu đồ luồng dữ liệu (Data Flow):

```text
[HIỆN TẠI - THIẾU REVALIDATION]
Admin sửa tên phân loại -> Bấm "Lưu thay đổi"
            │
            ▼
PATCH /api/admin/products/[id]
            │
            ├─► Ghi vào Supabase DB: THÀNH CÔNG NGAY (updated_at = 16:46:40)
            │
            └─► (KHÔNG gọi revalidatePath) ──x Next.js không biết dữ liệu đã đổi
                                                      │
Khách/Admin vào xem /san-pham/[slug] (16:50:00) ──────▼
                                     Next.js phục vụ Data Cache (TTL 300s)
                                     ==> Vẫn hiện bản cũ "Thiệp 3d"!


[SAU KHI SỬA - ON-DEMAND REVALIDATION]
PATCH /api/admin/products/[id]
            │
            ├─► Ghi vào Supabase DB: THÀNH CÔNG
            │
            └─► Gọi revalidatePath:
                 ├─► revalidatePath(`/san-pham/${slug}`)
                 ├─► revalidatePath("/san-pham")
                 └─► revalidatePath("/")
                        │
                        ▼
Next.js đánh dấu cache các trang liên quan là stale ngay lập tức.
Khách/Admin tải lại trang ──► Server render dữ liệu mới từ DB ngay lập tức!
```

---

## Đề xuất Sửa lỗi (Proposed Fixes)

### Phương án 1 (Khuyến nghị): Bổ sung `revalidatePath` đồng bộ vào các Route Handlers sản phẩm
- **File cần sửa**:
  1. `app/api/admin/products/[id]/route.ts`:
     - Trong `PATCH`:
       - Trước khi update, nếu có đổi slug thì lưu lại `oldSlug`.
       - Sau khi update thành công `products`, gọi:
         ```ts
         revalidatePath(`/san-pham/${data.slug}`);
         if (oldSlug && oldSlug !== data.slug) {
           revalidatePath(`/san-pham/${oldSlug}`);
         }
         revalidatePath("/san-pham");
         revalidatePath("/");
         ```
     - Trong `DELETE`:
       - Trước khi xóa, query lấy `slug` của sản phẩm.
       - Sau khi xóa thành công, gọi:
         ```ts
         if (deletedSlug) revalidatePath(`/san-pham/${deletedSlug}`);
         revalidatePath("/san-pham");
         revalidatePath("/");
         ```
  2. `app/api/admin/products/route.ts`:
     - Trong `POST` (tạo sản phẩm mới):
       - Sau khi insert thành công, gọi:
         ```ts
         revalidatePath(`/san-pham/${data.slug}`);
         revalidatePath("/san-pham");
         revalidatePath("/");
         ```
- **Ưu điểm**:
  - Chuẩn theo đúng quy chuẩn Next.js App Router và khớp 100% với kiến trúc hiện có của dự án (giống `app/api/admin/products/reorder/route.ts`).
  - Xóa cache đúng trang chi tiết, trang danh sách và trang chủ; không ảnh hưởng đến các trang khác.
  - Giải quyết dứt điểm vấn đề sửa sản phẩm, đổi slug, đổi tồn kho, đổi phân loại, bật/tắt hiển thị đều có hiệu lực ngay lập tức ngoài web.
- **Rủi ro**: Không có rủi ro; chi phí render lại theo yêu cầu trên Vercel là rất nhỏ và đúng chuẩn.

### Phương án 2 (Thay thế): Giảm thời gian `revalidate: 300` xuống thấp hơn hoặc tắt cache
- **Mô tả**: Giảm TTL trong `createPublicClient()` từ 300s xuống 10s hoặc `cache: "no-store"`.
- **Nhược điểm**:
  - Không giải quyết được tận gốc: người dùng vẫn phải đợi một khoảng thời gian nếu có cache.
  - Nếu chuyển sang `no-store`, mỗi lượt khách vào xem sản phẩm sẽ phát sinh query trực tiếp đến Supabase, làm tăng egress và có nguy cơ chạm hạn mức của Supabase Free tier (lý do ban đầu tạo ra `createPublicClient` là để tránh egress này).
- **Kết luận**: Không nên chọn phương án 2. Nên chọn Phương án 1.

---

## Review Kế hoạch (16/10/2026)

**Kết luận: kế hoạch ĐÚNG, chọn Phương án 1. Giữ nguyên, không cần sửa hướng.** Các điểm đã đối chiếu lại với mã nguồn thật và tài liệu Next.js đi kèm (`node_modules/next/dist/docs/01-app/03-api-reference/04-functions/revalidatePath.md`, Next 16.2.4):

1. **Nguyên nhân gốc rễ đã được xác nhận đúng.** `createPublicClient()` (`lib/supabase/server.ts:32-48`) gắn `next: { revalidate: 300 }` cho mọi fetch. Trang `/san-pham/[slug]` **không** khai báo `export const revalidate`, nên Next lấy TTL thấp nhất từ các fetch bên trong — đúng 300 giây như báo cáo mô tả. (Để so sánh: `/san-pham` có `revalidate = 30`, `/` có `revalidate = 60`, nhưng cả hai vẫn đọc qua cùng Data Cache 300s nên vẫn cần revalidate thủ công.)
2. **Dạng tham số `revalidatePath` trong kế hoạch là đúng chuẩn Next 16.** Tài liệu quy định: đường dẫn *literal* (`/san-pham/abc`) thì **bỏ** tham số `type`; chỉ khi dùng *route pattern* (`/san-pham/[slug]`) mới bắt buộc truyền `'page'`. Kế hoạch dùng literal nên không cần `type`.
3. **Route group `(site)` không được đưa vào đường dẫn.** Trang nằm ở `app/(site)/san-pham/[slug]/page.tsx`, nhưng `(site)` không xuất hiện trong URL nên `revalidatePath("/san-pham/abc")` là đúng; chỉ dạng pattern mới phải viết `(site)`. Mã đã sửa làm đúng điểm này.
4. **Gọi trong Route Handler là đủ.** Tài liệu ghi rõ: trong Route Handler, `revalidatePath` đánh dấu đường dẫn và việc render lại xảy ra ở lần truy cập kế tiếp — đúng với kỳ vọng "khách F5 là thấy ngay".
5. **Phạm vi 3 trang là đủ và không thừa.** Đã rà toàn bộ nơi dùng `createPublicClient`: chỉ `/`, `/san-pham`, `/san-pham/[slug]` đọc bảng `products`. `components/layout/Footer.tsx` đọc `site_content` (không liên quan).
6. **Bác bỏ Phương án 2 là hợp lý** — `createPublicClient` sinh ra chính là để chặn egress Supabase, hạ TTL sẽ đi ngược mục đích đó.

**Hai điểm kế hoạch chưa nhắc tới (đã ghi nhận, CỐ Ý không sửa trong lần này để giữ nguyên tắc thay đổi tối thiểu):**

- `app/sitemap.ts` cũng đọc `products` và có `revalidate = 3600`. Sản phẩm mới / đổi slug / bị xoá sẽ lệch trong sitemap tối đa 1 giờ. Chỉ ảnh hưởng SEO, không phải lỗi người dùng nhìn thấy → đề xuất xử lý ở một lần sửa riêng.
- Cùng loại lỗi này còn tồn tại ở các route admin khác chưa gọi `revalidatePath` (khung/frames, `site_content` của Footer, feedback, FAQ). Nằm ngoài phạm vi báo cáo này → nên mở báo cáo riêng.

---

## Kế hoạch Xác minh
1. **Kiểm tra luồng cập nhật sản phẩm trong Admin**:
   - Sử dụng tài khoản admin chỉnh sửa thử nghiệm một trường của sản phẩm (ví dụ thêm ghi chú hoặc đổi chữ hoa/thường phân loại).
   - Bấm "Lưu thay đổi".
2. **Kiểm tra phản hồi ngoài website**:
   - Truy cập ngay trang `/san-pham/[slug]` bằng `curl` / `fetch` hoặc trình duyệt.
   - Xác nhận trang trả về phiên bản mới ngay lập tức mà không cần đợi 300 giây.
3. **Kiểm tra trường hợp đổi slug**:
   - Đổi slug và xác nhận đường dẫn cũ bị xóa cache, đường dẫn mới cập nhật ngay.
4. **Kiểm tra regression**:
   - Chạy test suite hiện có của dự án để đảm bảo không bị lỗi biên dịch hay phá vỡ các chức năng khác.

---

## KẾT QUẢ SỬA LỖI & KIỂM THỬ — THÀNH CÔNG (16/10/2026)

### 1. Thay đổi đã áp dụng (đúng Phương án 1, thay đổi tối thiểu, không refactor)

| File | Thay đổi |
|---|---|
| `app/api/admin/products/[id]/route.ts` | `PATCH`: đọc `slug` cũ trước khi update (chỉ khi payload có `slug`), sau khi update thành công gọi `revalidatePath` cho slug mới, slug cũ (nếu khác), `/san-pham` và `/`. `DELETE`: đọc `slug` trước khi xoá, sau khi xoá gọi `revalidatePath` cho trang chi tiết, `/san-pham` và `/`. |
| `app/api/admin/products/route.ts` | `POST`: sau khi insert thành công gọi `revalidatePath` cho trang chi tiết sản phẩm mới, `/san-pham` và `/`. |
| `scripts/test-product-revalidate.mjs` | **(mới)** Script tái hiện lỗi + xác minh bản sửa. |

Không đụng vào `lib/supabase/server.ts` — TTL 300s giữ nguyên để không tăng egress Supabase.

### 2. Cách script chứng minh (không pass giả)

Điểm then chốt: mỗi case đều **mồi cache trước** — fetch trang lặp lại cho tới khi HTML thực sự chứa giá trị hiện tại (mốc A) — rồi mới gọi API đổi sang mốc B và fetch lại ngay. Nếu thiếu `revalidatePath`, bản cache chứa mốc A còn sống đủ 300 giây, nên lần fetch ngay sau đó buộc phải trả mốc A → FAIL. Script chỉ PASS khi web đổi trong **dưới 15 giây** (thực tế đo được 0.2–1.5 giây), tức là nhờ on-demand revalidation chứ không phải do hết TTL.

### 3. Chạy đối chứng: script có thật sự bắt được lỗi không?

Đã tạm gỡ bản sửa (`git stash`), build lại và chạy cùng script trên code **chưa sửa**:

```
PASS: 21   FAIL: 14
=> THẤT BẠI
```

Các FAIL đúng y hệt triệu chứng người dùng báo:

```
  FAIL  /san-pham/[slug] hiện mốc B, sạch mốc A (sau 6.2s << TTL 300s)
        còn thiếu: ["KTBmvat6w8a"]
  FAIL  /san-pham hiện mốc B, sạch mốc A (sau 11.8s << TTL 300s)
  FAIL  / (trang chủ) hiện mốc B, sạch mốc A (sau 16.0s << TTL 300s)
  FAIL  đường dẫn CŨ đã bị xoá cache (404, không còn phục vụ bản cũ)
        nhận 200 — vẫn đang trả bản cache cũ
  FAIL  /san-pham có sản phẩm mới ngay (sau 6.0s << TTL 300s)
  FAIL  trang chi tiết sản phẩm đã ẩn trả 404
        nhận 200
  FAIL  trang chi tiết sản phẩm đã xoá trả 404 (sau 6.2s)
        nhận 200 — vẫn phục vụ bản cache cũ
```

→ Script tái hiện được đúng lỗi. Sau đó khôi phục bản sửa (`git stash pop`) và build lại.

### 4. Kết quả chạy trên code ĐÃ SỬA

Lệnh:

```
npm run build && npx next start -p 3100
node --experimental-strip-types --import ./scripts/alias-hook.mjs scripts/test-product-revalidate.mjs
```

Output:

```
BASE = http://localhost:3100

Sản phẩm dùng để test: "Set SAKURA hoa anh đào - Dây chuyền và vòng tay" (/san-pham/set-sakura-co-4-la-2-mon)
  có 4 phân loại -> kiểm cả đổi tên phân loại

Case 1 — authz: gọi API khi chưa đăng nhập
  PASS  PATCH ẩn danh -> 401
  PASS  POST ẩn danh -> 401
  PASS  DELETE ẩn danh -> 401
  PASS  DB không bị request ẩn danh thay đổi

Case 2 — PATCH tên sản phẩm + tên phân loại, web phải đổi NGAY
  PASS  PATCH lần 1 (đặt mốc A) -> 200
  đã mồi cache 3 trang với mốc A=KTAmvat3uek (TTL 300s)
  PASS  PATCH lần 2 (đổi sang mốc B) -> 200
  PASS  /san-pham/[slug] hiện mốc B, sạch mốc A (sau 0.5s << TTL 300s)
  PASS  /san-pham hiện mốc B, sạch mốc A (sau 0.8s << TTL 300s)
  PASS  / (trang chủ) hiện mốc B, sạch mốc A (sau 1.5s << TTL 300s)
  PASS  DB lưu đúng tên phân loại mới

Case 3 — PATCH đổi slug: đường dẫn mới sống, đường dẫn cũ hết cache
  PASS  PATCH đổi slug -> 200
  PASS  /san-pham/set-sakura-co-4-la-2-mon-ktmvat3ygs render được ngay (sau 0.5s << TTL 300s)
  PASS  đường dẫn CŨ đã bị xoá cache (404, không còn phục vụ bản cũ)
  PASS  /san-pham đã trỏ sang slug mới (sau 1.0s << TTL 300s)
  PASS  PATCH trả slug về như cũ -> 200
  PASS  đường dẫn cũ sống lại ngay sau khi trả slug (sau 0.9s << TTL 300s)

Case 4 — POST tạo sản phẩm mới, phải hiện ngay ngoài /san-pham
  PASS  POST -> 201
  PASS  /san-pham có sản phẩm mới ngay (sau 0.5s << TTL 300s)
  PASS  trang chi tiết sản phẩm mới trả 200

Case 5 — PATCH tắt hiển thị, phải biến mất ngay
  PASS  PATCH is_visible=false -> 200
  PASS  /san-pham không còn sản phẩm vừa ẩn (sau 0.4s << TTL 300s)
  PASS  trang chi tiết sản phẩm đã ẩn trả 404

Case 6 — DELETE, trang chi tiết phải hết cache ngay
  PASS  DELETE -> 200
  PASS  trang chi tiết sản phẩm đã xoá trả 404 (sau 0.5s)
  PASS  /san-pham không còn sản phẩm đã xoá (sau 0.6s << TTL 300s)
  PASS  sản phẩm tạm đã bị xoá khỏi DB

Case 7 — khôi phục nguyên trạng sản phẩm đã mượn để test
  PASS  PATCH khôi phục -> 200
  PASS  DB đã về đúng tên + slug ban đầu
  PASS  DB đã về đúng phân loại ban đầu
  PASS  website sạch hết dấu vết kiểm thử (sau 0.2s << TTL 300s)

==================== KẾT QUẢ ====================
PASS: 30   FAIL: 0
=> THÀNH CÔNG
```

### 5. Regression & trạng thái dữ liệu

- `npm run build` **PASS** (exit code 0), không lỗi TypeScript, không cảnh báo mới.
- Dữ liệu thật đã được khôi phục nguyên trạng: kiểm tra lại DB còn đúng **13 sản phẩm**, **0 bản ghi còn dấu vết kiểm thử** (tên, slug, phân loại của "Set SAKURA" trùng khớp bản gốc).
- Không thay đổi schema → **không cần migration Supabase** cho lần sửa này.

### 6. Kết luận

**THÀNH CÔNG.** Sau khi bấm "Lưu thay đổi" trong Admin (hoặc tạo mới / xoá / ẩn sản phẩm), website cập nhật trong **dưới 1,5 giây** thay vì phải chờ tới 300 giây như trước.
