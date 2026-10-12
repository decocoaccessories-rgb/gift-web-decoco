# Báo cáo lỗi: Supabase vượt Cached Egress (tái phát)

## Trạng thái
ĐANG SỬA CHỮA

## Tóm tắt vòng đời sự cố

| Mốc | Sự việc |
| --- | --- |
| 21/09/2026 | Lần đầu vượt quota → API trả HTTP 402 `exceed_cached_egress_quota`, trang trống |
| 28/09/2026 | Fix vòng 1 (commit `f17a2b6`): ảnh public đi qua `/media/<bucket>/<path>` cache ở Vercel CDN; truy vấn public dùng anon client cache 5 phút. Production verify PASS |
| 12/10/2026 | **Tái phát**: lại HTTP 402 `exceed_cached_egress_quota` trong chu kỳ mới (reset 27/09 → mới ~15 ngày đã hết 5 GB) |

## Triệu chứng hiện tại (12/10/2026)

Ảnh chụp `Capture 12.10.26.JPG`: trang chủ `trangsucdecoco.vn` render khung hero rỗng — không có ảnh nền, không có sản phẩm.

```text
GET https://trangsucdecoco.vn/                                   -> HTTP 200 (shell render được)
   trong HTML: 0 link /san-pham/..., 0 thẻ <img> sản phẩm       -> dữ liệu rỗng
GET /rest/v1/products?select=slug,name&limit=3                   -> HTTP 402
   {"message":"Service for this project is restricted ... exceed_cached_egress_quota ..."}
GET https://xknkhczeuyjxtiljeaoz.supabase.co/storage/.../products/1788762943877.png -> HTTP 402
GET https://trangsucdecoco.vn/media/products/1788762943877.png   -> HTTP 200, x-vercel-cache: HIT, Age: 446325
```

Điểm mấu chốt: **ảnh đi qua `/media` vẫn sống** (Vercel CDN phục vụ, không chạm Supabase), còn **ảnh trỏ thẳng `*.supabase.co` thì chết**. Fix vòng 1 hoạt động đúng — nhưng nó **chưa phủ hết** các điểm render ảnh.

## Root Cause Analysis

Fix vòng 1 chỉ sửa 5 điểm render (`FallbackImage`, `HeroSection`, `StorySection`, `FeedbackCarousel`, sitemap/footer). **Toàn bộ công cụ thiết kế bị bỏ sót** — và đó chính là nơi ngốn băng thông nặng nhất.

### Rò rỉ #1 — `FramePanel` tải ảnh khung ở kích thước gốc, trực tiếp từ Supabase

`app/admin/khung/page.tsx:317` lưu `thumbnail_url = config.backgroundImage` → **thumbnail chính là file ảnh nền gốc**, không có bản thu nhỏ.

`components/DesignTool/FramePanel.tsx:26,41` render thẳng URL đó bằng `next/image`:

```tsx
const previewUrl = frame.thumbnail_url || (frame.config as FrameConfig).backgroundImage;
<Image src={previewUrl} fill sizes="100px" />   // ← URL *.supabase.co
```

`next.config.ts` đặt `images.unoptimized: true` → `sizes="100px"` **bị bỏ qua**, trình duyệt tải nguyên file gốc (canvas chuẩn 1772×1535 PNG).

```
/san-pham/<slug>  →  getFrames()  →  N khung
                        └─ FramePanel: N × ảnh GỐC  ──► *.supabase.co  (cached egress)
                                       mỗi lượt xem trang, mỗi khách
```

Mỗi lượt xem trang sản phẩm = N file PNG gốc tải thẳng từ Supabase CDN. Với N≈6–10 khung, đây là nguồn egress lớn hơn nhiều lần so với ảnh sản phẩm đã được fix vòng 1.

### Rò rỉ #2 — Fabric canvas nạp ảnh nền khung trực tiếp

`components/DesignTool/DesignToolCanvas.tsx:553`:

```tsx
const bg = await FabricImage.fromURL(config.backgroundImage, { crossOrigin: "anonymous" });
```

Mỗi lần khách bấm chọn một khung → thêm một lần tải file gốc từ Supabase (không qua Vercel CDN).

### Rò rỉ #3 — Các điểm còn lại trỏ thẳng Supabase

| File:line | Ngữ cảnh |
| --- | --- |
| `app/(site)/dat-hang/page.tsx:665` | Ảnh thiết kế của khách ở trang đặt hàng (public) |
| `app/admin/khung/page.tsx:200` | Danh sách khung trong admin — tải toàn bộ ảnh gốc mỗi lần mở trang |
| `app/admin/khung/page.tsx:363` | Preview ảnh nền trong dialog sửa khung |
| `app/admin/san-pham/page.tsx:137` | Thumbnail sản phẩm trong bảng admin |
| `app/admin/san-pham/ProductEditDialog.tsx:341` | Lưới ảnh trong dialog sửa sản phẩm |
| `app/admin/noi-dung/page.tsx:429` | Ảnh feedback trong admin |
| `app/admin/don-hang/OrderDetailDialog.tsx:100` | Ảnh thiết kế trong chi tiết đơn |

### Kết luận

Nguyên nhân gốc **không phải** `/media` hỏng, cũng không phải truy vấn database (JSON, đã cache 5 phút, dung lượng không đáng kể). Nguyên nhân là **ảnh khung kích thước gốc được tải trực tiếp từ Supabase Storage ở mọi lượt xem trang sản phẩm**, vì fix vòng 1 không chạm tới thư mục `components/DesignTool/` và `app/admin/`.

## Đề xuất sửa lỗi được chọn (Recommended Fix)

Áp dụng đúng cơ chế của fix vòng 1 cho các điểm còn sót — thay đổi tối thiểu, mỗi chỗ một dòng:

1. Bọc mọi URL ảnh Supabase còn lại bằng `getCachedStorageUrl()` để đi qua `/media/<bucket>/<path>` (Vercel CDN, `max-age=31536000, immutable`).
   - `components/DesignTool/FramePanel.tsx` (rò rỉ #1 — tác động lớn nhất)
   - `components/DesignTool/DesignToolCanvas.tsx` (rò rỉ #2)
   - `app/(site)/dat-hang/page.tsx` và 6 điểm admin (rò rỉ #3)
2. Thêm test nguồn (`scripts/test-design-tool-media-cache.mjs`) chặn hồi quy: quét mã nguồn, fail nếu một điểm render ảnh nào đó không đi qua `getCachedStorageUrl`.

Trước / sau:

```
TRƯỚC:  trình duyệt ──► *.supabase.co/storage/...  (mỗi lượt xem = cached egress)
SAU:    trình duyệt ──► /media/...  ──► Vercel CDN HIT   (0 byte Supabase)
                                   └─► Supabase chỉ ở lần MISS đầu tiên / mỗi region
```

Không đổi schema, RLS, khóa API hay dữ liệu Supabase. Không nâng gói, không tạo project mới.

**Giới hạn cần nói rõ:** sửa code **không gỡ** restriction đang có trong chu kỳ hiện tại. Project sẽ còn trả 402 cho tới khi chủ dự án nâng gói / bỏ spend cap, hoặc tới ngày reset chu kỳ (≈27/10/2026). Bản sửa này giảm egress của **chu kỳ sau**. Cũng không giảm số byte khách tải về (vẫn ảnh gốc, do `images.unoptimized: true` vì quota Vercel Image Optimization đã hết) — chỉ chuyển byte đó từ Supabase sang Vercel CDN.

## Kế hoạch xác minh

- `node --experimental-strip-types scripts/test-cached-egress-fix.mjs` (test vòng 1, chống hồi quy).
- `node --experimental-strip-types scripts/test-design-tool-media-cache.mjs` (test mới).
- `npx.cmd tsc --noEmit` và `npm.cmd run build`.
- Sau deploy: `curl` trang `/san-pham/<slug>`, xác nhận HTML **không còn** chuỗi `supabase.co/storage`; ảnh khung trả về từ `/media/frames/...` với `x-vercel-cache: HIT` ở lần thứ hai.
- Theo dõi Usage → Cached Egress trong chu kỳ tới.

---

## Bản sửa và kết quả tự động (12/10/2026)

### Files Changed

| File | Thay đổi |
| --- | --- |
| `components/DesignTool/FramePanel.tsx` | Thumbnail khung đi qua `getCachedStorageUrl` (rò rỉ #1) |
| `components/DesignTool/DesignToolCanvas.tsx` | `FabricImage.fromURL` nạp ảnh nền qua `getCachedStorageUrl` (rò rỉ #2) |
| `app/(site)/dat-hang/page.tsx` | Ảnh thiết kế của khách qua `getCachedStorageUrl` |
| `app/admin/khung/page.tsx` | Preview khung (danh sách + dialog) qua `getCachedStorageUrl` |
| `app/admin/noi-dung/page.tsx` | Ảnh feedback qua `getCachedStorageUrl` |
| `app/admin/don-hang/OrderDetailDialog.tsx` | Ảnh thiết kế trong chi tiết đơn qua `getCachedStorageUrl` |
| `app/admin/san-pham/page.tsx` | Thumbnail sản phẩm trong bảng admin qua `getCachedStorageUrl` |
| `scripts/test-design-tool-media-cache.mjs` | **Mới** — test chống hồi quy |

Không đổi logic nghiệp vụ, không refactor, không đổi schema/RLS/env.

### Test Results — **Thành công**

Test mới tái hiện được lỗi gốc (fail khi chưa sửa):

```text
# revert tạm FramePanel.tsx rồi chạy test:
AssertionError [ERR_ASSERTION]: components/DesignTool/FramePanel.tsx renders Supabase
Storage images and must import/use getCachedStorageUrl
exit=1
```

Sau khi áp bản sửa:

```text
node --experimental-strip-types scripts/test-design-tool-media-cache.mjs
PASS: Frame thumbnails are served through the site CDN cache.
PASS: The fabric canvas loads frame backgrounds through the site CDN cache.
PASS: Checkout and admin image previews are served through the site CDN cache.
PASS: No render path hard-codes a Supabase Storage URL.
exit=0

node --experimental-strip-types scripts/test-cached-egress-fix.mjs   (chống hồi quy vòng 1)
PASS: Supabase images are routed through the site CDN cache.
PASS: CDN/browser cache TTL is one year for immutable image paths.
PASS: New Supabase uploads use a one-year browser cache TTL.
PASS: Upstream errors and non-image responses are not cached.
exit=0

npx.cmd tsc --noEmit  -> exit 0
npm.cmd run build     -> exit 0, build thành công, route /media/[...path] có mặt
```

### Verification

- Mã nguồn: không còn điểm render nào trỏ thẳng `*.supabase.co/storage`.
- Runtime hiện tại: `/media/...` vẫn HTTP 200 `x-vercel-cache: HIT` trong khi Supabase trả 402 → xác nhận đường đi mới không phụ thuộc Supabase khi CDN đã có cache.
- **Chưa thể verify end-to-end trên production**: project Supabase vẫn đang bị restriction `exceed_cached_egress_quota` nên ảnh khung chưa có trong Vercel CDN sẽ chưa hiển thị, và trang vẫn thiếu dữ liệu. Cần chủ dự án bỏ spend cap / nâng gói, hoặc chờ reset chu kỳ (≈27/10/2026). Khi Supabase trả 200 trở lại, chạy lại bước xác minh `curl /san-pham/<slug>` trong "Kế hoạch xác minh".

---

## Phụ lục — fix vòng 1 (28/09/2026), giữ để tham chiếu

- Đã áp dụng: `app/media/[...path]/route.ts`, `lib/supabase/storage-url.ts`, `lib/supabase/server.ts` (`createPublicClient` cache 5 phút), các điểm đọc public và upload ảnh admin.
- Kết quả production sau commit `f17a2b6`: trang chủ/danh mục/chi tiết HTTP 200, `/media/products/1788762943877.png` HTTP 200 (1.746.231 byte), `x-vercel-cache` MISS→HIT, `Cache-Control: public, max-age=31536000, immutable`.
- Kết quả 21/09/2026 trước fix: `products` / `feedback_items` / `site_content` đều HTTP 402 `exceed_cached_egress_quota`.
