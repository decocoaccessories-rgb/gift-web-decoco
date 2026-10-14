# Báo cáo Lỗi

## Trạng thái
ĐÃ SỬA XONG — ĐÃ KIỂM THỬ: **THÀNH CÔNG**

## Tiêu đề Lỗi
Trang Admin Quản lý Sản phẩm (`/admin/san-pham`) thiếu cơ chế sắp xếp lại thứ tự sản phẩm (Reorder / Kéo thả / Lên-Xuống) và chưa có API đồng bộ thứ tự hiển thị ra ngoài website.

## Mô tả Lỗi
Trong trang quản trị Admin (`/admin/san-pham`), danh sách sản phẩm hiện tại chỉ được hiển thị dưới dạng bảng HTML tĩnh (`table`). Người quản trị không thể thay đổi thứ tự các sản phẩm từ trên xuống dưới (không có tính năng kéo thả drag-and-drop, không có nút di chuyển lên/xuống). Do đó, thứ tự các sản phẩm hiển thị trên trang chủ (`/`) và trang danh mục (`/san-pham`) bị cố định theo thứ tự ban đầu trong cơ sở dữ liệu, không thể chủ động sắp xếp vị trí hiển thị theo nhu cầu kinh doanh.

## Các bước tái hiện
1. Đăng nhập vào trang Admin và truy cập đường dẫn `/admin/san-pham`.
2. Quan sát bảng danh sách sản phẩm: Các sản phẩm được liệt kê theo thứ tự hiện tại với các cột *Sản phẩm*, *Giá*, *Tồn kho*, *Hiển thị*, *Actions*.
3. Thử tìm kiếm tính năng kéo thả hàng hoặc nút mũi tên di chuyển thứ tự lên/xuống.
4. Mở hộp thoại "Sửa" sản phẩm: Không có trường thông tin trực quan để thay đổi vị trí thứ tự hiển thị của sản phẩm trong danh sách.
5. Kiểm tra mã nguồn API và trang người dùng: Chưa có API cập nhật hàng loạt thứ tự sản phẩm và chưa có cơ chế revalidate cache ISR tức thì khi thay đổi thứ tự.

## Kết quả Thực tế vs Kết quả Mong đợi
- **Kết quả Thực tế**: Bảng sản phẩm Admin là bảng tĩnh; không có handle kéo thả, không có nút di chuyển vị trí, không có endpoint batch reorder cho sản phẩm. Thứ tự ngoài website không thể điều chỉnh được từ giao diện quản trị.
- **Kết quả Mong đợi**: 
  - Tại trang `/admin/san-pham`, Admin có thể dễ dàng thay đổi thứ tự sản phẩm theo chiều từ trên xuống dưới thông qua kéo thả (drag-and-drop) hoặc nút bấm Lên/Xuống tiện lợi.
  - Khi thứ tự thay đổi, hệ thống tự động lưu vị trí mới (`sort_order`) vào cơ sở dữ liệu Supabase.
  - Ngoài website (trang chủ `/` và trang danh sách `/san-pham`), thứ tự hiển thị của các sản phẩm được cập nhật ngay lập tức theo đúng thứ tự vừa sắp xếp trong trang Admin.

## Ngữ cảnh & Môi trường
- **Môi trường**: Next.js 16 (App Router), React 19, Supabase PostgreSQL, Tailwind CSS v4.
- **Thư viện đã có sẵn**: `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` (đã được cấu hình và sử dụng thành công tại `/admin/khung`).
- **File liên quan**:
  - Giao diện Admin: `app/admin/san-pham/page.tsx`
  - Modal biên tập: `app/admin/san-pham/ProductEditDialog.tsx`
  - API sản phẩm: `app/api/admin/products/route.ts` & `app/api/admin/products/[id]/route.ts`
  - Trang hiển thị Website: `app/page.tsx` (trang chủ) & `app/(site)/san-pham/page.tsx` (danh mục)

---

## Review Kế hoạch (2026-10-14)

Kế hoạch về tổng thể **đúng hướng** (Phương án 1 được chọn), nhưng có 3 điểm sai/thiếu đã được chỉnh lại trước khi thi công:

1. **Bước 3 của Phương án 1 là một no-op.** Kế hoạch ghi "Bổ sung secondary sort fallback trong `app/api/admin/products/route.ts`: `.order("sort_order", { ascending: true })`" — nhưng dòng này **đã tồn tại sẵn** (`app/api/admin/products/route.ts:35`) và hoàn toàn tương đương `.order("sort_order")`. Nó không thêm tiebreaker nào cả.
   → **Sửa lại**: thêm sort phụ thực sự là `.order("created_at", { ascending: true })`.

2. **RCA #4 (trùng `sort_order`) có nêu vấn đề nhưng không có bước khắc phục dữ liệu.** Kiểm tra CSDL production xác nhận: 5/13 sản phẩm đang có `sort_order = 0`. Nghĩa là thứ tự hiện tại ở cả admin lẫn website đều **không xác định** (Postgres tự do trả về). Nếu chỉ thêm UI kéo thả mà không chuẩn hoá dữ liệu, danh sách admin trước lần kéo đầu tiên vẫn có thể nhảy lung tung.
   → **Bổ sung**: migration `013_normalize_product_sort_order.sql` gán lại `sort_order` tuần tự 0..n theo `(sort_order, created_at)`.

3. **Hai trang website cũng cần cùng tiebreaker** thì thứ tự admin mới khớp 100% thứ tự ngoài site. Kế hoạch chỉ nhắc API admin.
   → **Bổ sung**: thêm `.order("created_at", { ascending: true })` vào `app/page.tsx` và `app/(site)/san-pham/page.tsx`.

Các điểm đã xác minh là đúng và giữ nguyên:
- Cột `products.sort_order INTEGER DEFAULT 0` đã có sẵn (`supabase/migrations/001_initial_schema.sql:16`) + index `idx_products_sort` → **không cần đổi schema**.
- `@dnd-kit/core@6.3.1`, `@dnd-kit/sortable@10.0.0`, `@dnd-kit/utilities@3.2.2` đã cài; mẫu kéo thả hoàn chỉnh tại `app/admin/khung/page.tsx` + `app/api/admin/frames/reorder/route.ts`.
- `revalidatePath` gọi được trong Route Handler (xác nhận trong `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/revalidatePath.md`). Lưu ý đúng theo tài liệu: trong Route Handler nó **đánh dấu** path cần revalidate, việc render lại xảy ra ở lần truy cập kế tiếp — với người dùng cuối thì hiệu quả là "thấy ngay", không phải chờ hết 30/60s.
- Dự án chưa dùng `revalidatePath` ở bất kỳ đâu; `next.config.ts` không bật `cacheComponents` nên ISR cổ điển (`export const revalidate`) vẫn đúng.
- `ProductEditDialog` tuy không có ô nhập "Thứ tự" trên UI nhưng **có giữ và gửi lại** `sort_order` cũ khi lưu (dòng 35, 145) → sửa sản phẩm sẽ không làm mất thứ tự vừa kéo. Không cần đụng tới file này.

---

## Phân tích Nguyên nhân Gốc rễ (Root Cause Analysis)

### 1. Phân tích chi tiết mã nguồn:
1. **Thiếu cơ chế tương tác sắp xếp trên UI Admin (`app/admin/san-pham/page.tsx`)**:
   - Component `AdminProductsPage` sử dụng thẻ `<table>` truyền thống để render mảng `products` (dòng 104-189).
   - Trang chưa tích hợp `DndContext`, `SortableContext` của `@dnd-kit` (trong khi trang `app/admin/khung/page.tsx` đã có sẵn logic kéo thả mẫu rất hoàn chỉnh).
   - Không có handle kéo thả (`GripVertical`) hay nút điều hướng (`ChevronUp`/`ChevronDown`) trên mỗi dòng.

2. **Thiếu API lưu thứ tự hàng loạt (`/api/admin/products/reorder`)**:
   - Hiện tại backend chỉ có `PATCH /api/admin/products/[id]` cập nhật từng sản phẩm riêng lẻ.
   - Khi di chuyển 1 sản phẩm từ vị trí A sang vị trí B, cần cập nhật lại trường `sort_order` cho nhiều sản phẩm trong một giao dịch/batch để tránh trùng lặp hoặc sai lệch thứ tự.
   - Dự án đã có mẫu `app/api/admin/frames/reorder/route.ts`, nhưng nhánh sản phẩm chưa được xây dựng route tương tự.

3. **Cơ chế Cache ISR trên Website chưa được làm mới tức thì (`revalidatePath`)**:
   - `app/page.tsx` đang cấu hình `revalidate = 60;` (cache 60 giây).
   - `app/(site)/san-pham/page.tsx` đang cấu hình `revalidate = 30;` (cache 30 giây).
   - Cả hai trang đều đã truy vấn sản phẩm có `.order("sort_order")`. Tuy nhiên, nếu sau khi đổi thứ tự trong Admin mà không gọi `revalidatePath("/")` và `revalidatePath("/san-pham")`, người dùng ngoài website sẽ bị trễ cache 30-60 giây mới thấy thay đổi.

4. **Trùng lặp chỉ số `sort_order` ban đầu**:
   - Khi các sản phẩm mới được tạo với giá trị mặc định `sort_order = 0`, Postgres sẽ sắp xếp không theo thứ tự mong muốn nếu không có tiebreaker (`.order("sort_order").order("created_at", { ascending: false })`). Khi có tính năng reorder, mỗi sản phẩm sẽ được gán số thứ tự chuẩn xác (0, 1, 2, 3...).

### 2. Biểu đồ luồng dữ liệu (Data Flow):

```text
[HIỆN TẠI]
Admin UI (table tĩnh) ──(Không có kéo thả / không có nút di chuyển)
                               │
                      (Không có API reorder)
                               │
               Supabase products.sort_order (cố định)
                               │
      Trang Website (/san-pham, /) hiển thị thứ tự cố định


[SAU KHI NÂNG CẤP ĐỀ XUẤT]
Admin UI ──► Kéo thả (DndContext) HOẶC Bấm nút Lên/Xuống
   │
   ├─► Cập nhật ngay trên giao diện (Optimistic UI)
   │
   └─► Gọi PUT /api/admin/products/reorder { items: [{id, sort_order}] }
         │
         ├─► Cập nhật hàng loạt sort_order vào CSDL Supabase
         │
         └─► Gọi revalidatePath("/") & revalidatePath("/san-pham")
               │
               ▼
   Website (/ và /san-pham) hiển thị đúng thứ tự mới NGAY LẬP TỨC
```

---

## Đề xuất Sửa lỗi (Proposed Fixes)

### Phương án 1 (Khuyến nghị): Tích hợp Drag-and-Drop (@dnd-kit) kết hợp Nút di chuyển nhanh (Lên / Xuống) & API Batch Reorder

- **Cách tiếp cận**:
  1. **Tạo API `app/api/admin/products/reorder/route.ts`**:
     - Nhận payload danh sách `{ id: string, sort_order: number }[]`.
     - Xác thực quyền Admin (`createClient` + `getUser`).
     - Cập nhật đồng loạt trường `sort_order` cho các sản phẩm trong database Supabase bằng `createAdminClient()`.
     - Gọi `revalidatePath("/")` và `revalidatePath("/san-pham")` để xóa cache ISR, giúp website đổi thứ tự ngay lập tức.
  2. **Nâng cấp `app/admin/san-pham/page.tsx`**:
     - Áp dụng `@dnd-kit/core` và `@dnd-kit/sortable` (chiến lược `verticalListSortingStrategy`).
     - Thêm cột đầu tiên hiển thị **Số thứ tự (STT)** + **Icon kéo thả (`GripVertical`)** + **2 nút bấm nhỏ (Lên ▲ / Xuống ▼)**.
       - *Lợi ích của việc kết hợp*: Người dùng dùng chuột có thể kéo thả trực quan; người dùng trên máy tính bảng/điện thoại hoặc muốn đổi nhanh 1-2 vị trí có thể bấm nút Lên/Xuống chỉ với 1 click mà không sợ trượt tay.
     - Xử lý sự kiện kéo thả `handleDragEnd` và sự kiện bấm nút `moveProduct(index, direction)`: Tự động đổi vị trí trên giao diện (Optimistic UI) và gửi request đến API `/api/admin/products/reorder`. Báo toast thành công/thất bại.
  3. **Đồng bộ truy vấn hiển thị**:
     - Bổ sung secondary sort fallback trong `app/api/admin/products/route.ts`: `.order("sort_order", { ascending: true })`.

- **Ưu điểm**:
  - Trải nghiệm người dùng mượt mà, chuyên nghiệp, chuẩn phong cách admin hiện đại.
  - Tận dụng 100% các thư viện đã được cài đặt trong dự án (`@dnd-kit`).
  - Website đồng bộ ngay lập tức nhờ `revalidatePath`.
- **Rủi ro**: Thấp, không ảnh hưởng đến cấu trúc bảng CSDL hay các tính năng giỏ hàng/thanh toán.

---

### Phương án 2 (Phương án phụ): Thêm cột nhập số "Thứ tự" trực tiếp trong bảng

- **Cách tiếp cận**:
  - Thêm một cột `Thứ tự` với thẻ `<input type="number">` tương tự như cột `Tồn kho`.
  - Admin tự gõ số thứ tự (ví dụ: 1, 2, 3...) cho từng sản phẩm và nhấn nút "Lưu thay đổi".
- **Ưu điểm**: Dễ triển khai, cấu trúc mã đơn giản.
- **Nhược điểm**:
  - Trải nghiệm kém trực quan. Khi muốn chèn một sản phẩm từ cuối lên vị trí thứ 2, người quản trị phải sửa thủ công số thứ tự của tất cả các sản phẩm khác. Dễ xảy ra trường hợp nhập trùng số thứ tự.

---

## Kế hoạch Xác minh

1. **Kiểm tra Giao diện Admin (`/admin/san-pham`)**:
   - Thử kéo thả sản phẩm bất kỳ từ trên xuống dưới hoặc từ dưới lên trên.
   - Thử bấm nút di chuyển Lên ▲ và Xuống ▼.
   - Kiểm tra số thứ tự (1, 2, 3...) hiển thị tự động cập nhật lại tương ứng.
2. **Kiểm tra API & Cơ sở dữ liệu**:
   - Kiểm tra request `PUT /api/admin/products/reorder` trả về mã HTTP 200 `success: true`.
   - Tải lại trang (F5) trang admin để xác nhận thứ tự mới được duy trì bền vững từ Supabase.
3. **Kiểm tra Website người dùng (`/` và `/san-pham`)**:
   - Mở trang chủ `http://localhost:3000/` (khu vực Sản phẩm nổi bật): Xác nhận 4 sản phẩm đầu tiên hiển thị đúng theo 4 sản phẩm trên cùng của Admin.
   - Mở trang `/san-pham`: Xác nhận toàn bộ danh sách sản phẩm hiển thị chuẩn xác 100% theo thứ tự vừa sắp xếp trong Admin.
   - Xác nhận không còn tình trạng bị trễ cache do Next.js đã kích hoạt `revalidatePath`.
4. **Kiểm tra Phân quyền & Hồi quy**:
   - Thử nghiệm khi chưa đăng nhập Admin: API reorder phải từ chối truy cập (HTTP 401 Unauthorized).
   - Kiểm tra các chức năng sẵn có (Sửa sản phẩm, Ẩn/Hiện, Sửa tồn kho, Thêm mới) vẫn hoạt động hoàn hảo.


---

## Kết quả Thực thi Sửa lỗi (2026-10-14)

### Trạng thái: **THÀNH CÔNG**

### Các thay đổi đã áp dụng (theo Phương án 1, đã chỉnh theo mục "Review Kế hoạch")

| # | File | Thay đổi |
|---|------|----------|
| 1 | `app/api/admin/products/reorder/route.ts` *(mới)* | `PUT` batch reorder. Auth bằng `createClient().auth.getUser()` → 401 nếu chưa đăng nhập; validate payload bằng zod → 422; ghi `sort_order` hàng loạt bằng `createAdminClient()`; gọi `revalidatePath("/")` + `revalidatePath("/san-pham")`. Theo đúng khuôn mẫu sẵn có của `app/api/admin/frames/reorder/route.ts`. |
| 2 | `app/admin/san-pham/page.tsx` | Thêm `DndContext` + `SortableContext` (`verticalListSortingStrategy`); tách `<tr>` ra component `SortableProductRow`. Cột "Thứ tự" mới gồm: handle kéo `GripVertical`, số STT (1,2,3…), và 2 nút `ChevronUp`/`ChevronDown` (tự disable ở đầu/cuối danh sách). Cả kéo thả lẫn bấm nút đều đi qua một hàm `persistOrder()` chung — cập nhật Optimistic UI, gọi API, **rollback về trạng thái cũ nếu API lỗi** và báo toast. |
| 3 | `app/api/admin/products/route.ts` | Thêm sort phụ `.order("created_at", { ascending: true })` (sửa lại bước 3 vốn là no-op trong kế hoạch gốc). |
| 4 | `app/page.tsx`, `app/(site)/san-pham/page.tsx` | Thêm cùng sort phụ `created_at` để thứ tự ngoài website khớp tuyệt đối với thứ tự trong admin. |
| 5 | `supabase/migrations/013_normalize_product_sort_order.sql` *(mới)* | Gán lại `sort_order` thành dãy liên tục 0..n-1 theo `(sort_order, created_at)`. |
| 6 | `scripts/test-product-reorder.mjs` *(mới)* | Script kiểm thử tự động, theo đúng quy ước `scripts/test-*.mjs` có sẵn của dự án. |

**Không** đụng tới: schema bảng `products` (cột `sort_order` + index `idx_products_sort` đã có sẵn), `ProductEditDialog.tsx`, và toàn bộ luồng giỏ hàng / thanh toán.

### Đã đồng bộ lên Supabase

Migration 013 đã chạy trên CSDL production (`xknkhczeuyjxtiljeaoz`). Trước đó **5/13 sản phẩm cùng có `sort_order = 0`**; sau khi chuẩn hoá, 13 sản phẩm mang giá trị duy nhất 0..12, giữ nguyên thứ tự hiển thị đang có.

### Kiểm thử tự động

Lệnh chạy (server production build `next start -p 3100`):

```
npm run build && npx next start -p 3100
node scripts/test-product-reorder.mjs
```

Script đăng nhập bằng **session admin Supabase thật** (magic-link → `verifyOtp` → cookie sinh bởi chính `@supabase/ssr`), nên nó gọi API qua đúng lớp xác thực như trình duyệt, không bypass.

Output:

```
Case 0 — sort_order đã chuẩn hoá (migration 013)
  PASS  sort_order không trùng lặp
  PASS  sort_order liên tục 0..n-1

Case 1 — authz: gọi reorder khi chưa đăng nhập
  PASS  trả về 401 Unauthorized
  PASS  DB không bị thay đổi bởi request ẩn danh

Đăng nhập admin bằng session Supabase thật...
  cookie: sb-xknkhczeuyjxtiljeaoz-auth-token=base6... (2608 ký tự)

Case 2 — validation payload
  PASS  items rỗng -> 422
  PASS  id không phải uuid -> 422

Case 3 — reorder: đưa sản phẩm ĐANG HIỆN xếp cuối lên vị trí ĐẦU
  thứ tự công khai TRƯỚC: set-sakura-co-4-la-2-mon > set-bless-2-mon > set-babi-2-mon > set-flower-2-mon
  đưa "Set FLOWER hoa 5 cánh - Dây chuyền và khuyên tai " lên đầu
  PASS  API trả 200
  PASS  body { success: true }
  PASS  DB lưu đúng thứ tự mới
  PASS  sort_order vẫn liên tục 0..n-1, không trùng

Case 4 — website cập nhật ngay (revalidatePath, không chờ ISR 30/60s)
  thứ tự mong đợi (chỉ sản phẩm đang hiện): set-flower-2-mon > set-sakura-co-4-la-2-mon > set-bless-2-mon > set-babi-2-mon
  PASS  thứ tự công khai thực sự đã đổi (bảo đảm test không pass giả)
  PASS  /san-pham hiển thị đúng thứ tự
  PASS  / (4 sản phẩm nổi bật) đúng thứ tự

Case 5 — khôi phục thứ tự ban đầu
  PASS  API khôi phục trả 200
  PASS  DB đã về đúng thứ tự ban đầu

==================== KẾT QUẢ ====================
PASS: 15   FAIL: 0
=> THÀNH CÔNG
```

Lưu ý về Case 4: lần chạy đầu test chọn nhầm một sản phẩm **đang ẩn** để di chuyển, nên thứ tự công khai không đổi và Case 4 pass một cách vô nghĩa. Test đã được sửa để luôn chọn sản phẩm **đang hiển thị** xếp cuối, kèm một assertion riêng xác nhận thứ tự công khai thực sự khác trước — chống pass giả. Hai trang `/` và `/san-pham` được fetch chỉ ~1 giây sau lời gọi reorder, trong khi `revalidate` của chúng là 60s và 30s → chứng minh `revalidatePath` thực sự có tác dụng.

### Kiểm thử bổ sung

- `npx tsc --noEmit` → không lỗi.
- `npm run build` → pass; route `/api/admin/products/reorder` xuất hiện trong bảng route.
- `GET /admin/san-pham` (có cookie admin) → HTTP 200, render đủ cột "Thứ tự" và dòng hướng dẫn kéo thả, không có error overlay.

### Còn lại cần người kiểm tra thủ công

Thao tác kéo-thả bằng chuột thật trên `/admin/san-pham` không nằm trong phạm vi script tự động (script kiểm tra tầng API + CSDL + HTML website). Đề nghị kiểm tra nhanh bằng tay sau khi Vercel deploy xong.
