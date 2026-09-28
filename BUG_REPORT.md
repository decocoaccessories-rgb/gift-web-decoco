# Báo cáo lỗi: Supabase vượt Cached Egress

## Trạng thái
ĐANG SỬA CHỮA

## Triệu chứng và nguyên nhân

Ngày 21/09/2026, API của project `xknkhczeuyjxtiljeaoz` trả HTTP 402 với `exceed_cached_egress_quota`. Trang chủ và danh mục nhận `data: null`, rồi hiển thị trạng thái trống thay cho sản phẩm, đánh giá và ảnh. Trang chi tiết cũng không lấy được sản phẩm/biến thể.

Nguồn cần xử lý là ảnh public từ Supabase Storage: `next.config.ts` đang đặt `images.unoptimized: true`, nên trình duyệt tải ảnh trực tiếp từ `*.supabase.co`. Cache hit của CDN Supabase vẫn tính vào **Cached Egress**; cache ở client Next.js chỉ giảm truy vấn PostgREST, không giảm byte ảnh tải từ Storage. Các route public trước đây dùng `createClient()` đọc `cookies()`; vì vậy không thể dựa vào `revalidate` của trang để bảo đảm cache mọi truy vấn. Đây là hai vấn đề riêng biệt.

Luồng lỗi: trình duyệt → Supabase Storage/CDN vượt quota → project bị hạn chế → PostgREST trả 402 → `app/page.tsx` chuyển `data: null` thành mảng rỗng. Không có bằng chứng dữ liệu trong database đã bị xóa.

## Review kế hoạch cũ

Phương án khuyến nghị cũ là nâng cấp Pro, trái với lựa chọn giữ Free Tier của chủ dự án. Tạo project Free mới cũng không giải quyết lượng egress và có nguy cơ thiếu dữ liệu/ảnh production. Fallback tĩnh không an toàn cho giá, tồn kho và đặt hàng vì repo không chứa bản sao đầy đủ. Ngày reset 27/09/2026 là thông tin lịch sử, không được coi là trạng thái hiện tại khi chưa kiểm tra lại dashboard.

## Đề xuất sửa lỗi được chọn (Recommended Fix)

1. Chỉ với URL ảnh public của đúng project Supabase, đổi nguồn hiển thị sang `/media/<bucket>/<path>` cùng domain. Route này lấy ảnh từ Storage khi Vercel CDN chưa có cache, trả `Vercel-CDN-Cache-Control` và browser cache 1 năm. Ảnh upload qua admin dùng đường dẫn có timestamp và `cacheControl: 31536000`; khi thay ảnh cần URL mới. Lỗi upstream và nội dung không phải ảnh không được cache.
2. Các truy vấn công khai của trang chủ, danh mục, chi tiết, footer và sitemap dùng anon client không đọc cookie, cache `fetch` 5 phút. Giữ nguyên client có session cho API đặt hàng và admin.
3. Không đổi schema, RLS, khóa API hoặc dữ liệu Supabase. Không tạo project khác, không nâng gói, không thêm dữ liệu giả.

Giới hạn: thay đổi code không gỡ restriction đã phát sinh trong kỳ tính phí. Ảnh chưa có trong Vercel CDN vẫn cần Supabase trả 200 ở lần tải đầu; nếu project còn bị hạn chế, một số ảnh/dữ liệu sẽ chưa phục hồi. Cần theo dõi Cached Egress trong dashboard sau triển khai để biết mức giảm thực tế. Không thể hứa chắc dưới 5 GB/tháng nếu traffic tăng mạnh.

## Kế hoạch xác minh

- Test URL: chỉ ảnh public của project mới đi qua `/media`; URL có query string/nguồn khác giữ nguyên.
- Test HTTP route ảnh bằng upstream giả: ảnh 200 có cache header; HTTP 402 và HTML không được cache.
- `npx.cmd tsc --noEmit` và `npm.cmd run build`.
- Sau push: kiểm tra GitHub/Vercel deployment, HTTP trang chủ, danh mục và URL `/media`; kiểm tra `x-vercel-cache` HIT ở lần truy cập lặp lại khi Supabase hoạt động. Dashboard Supabase cần cho thấy project đã hết restriction và Cached Egress tăng chậm hơn sau triển khai.

## Kết quả trước sửa (21/09/2026)

```text
products       -> HTTP 402, data: null, exceed_cached_egress_quota
feedback_items -> HTTP 402, data: null, exceed_cached_egress_quota
site_content   -> HTTP 402, data: null, exceed_cached_egress_quota
GET /          -> HTTP 200, hiển thị fallback sản phẩm
GET /san-pham  -> HTTP 200, hiển thị fallback sản phẩm
```

## Bản sửa và kết quả tự động (28/09/2026)

- Đã áp dụng trong `app/media/[...path]/route.ts`, `lib/supabase/storage-url.ts`, `lib/supabase/server.ts`, các điểm đọc public và upload ảnh admin.
- **Thành công (kiểm thử code):**

```text
node --experimental-strip-types scripts/test-cached-egress-fix.mjs
PASS: Supabase images are routed through the site CDN cache.
PASS: CDN/browser cache TTL is one year for immutable image paths.
PASS: New Supabase uploads use a one-year browser cache TTL.
PASS: Upstream errors and non-image responses are not cached.

npx.cmd tsc --noEmit -> exit 0
npm.cmd run build -> exit 0; Compiled successfully; 37/37 static pages generated
```

- Lần build đầu trong sandbox **thất bại do không kết nối được `fonts.googleapis.com`**. Chạy lại với quyền mạng đã pass. Kiểm tra API Supabase từ terminal sandbox cũng báo `Unable to connect to the remote server`, vì vậy chưa thể dùng kết quả đó để kết luận project còn hay hết restriction.
- Kiểm tra lại bằng kết nối mạng ngày 28/09/2026: `GET /rest/v1/products?select=slug&limit=1 -> HTTP 200`, trả về một slug sản phẩm. Project đã phục hồi truy vấn đọc; kết quả Storage và trang web sau deploy ghi dưới đây.
- **Thành công (production sau deploy commit `f17a2b6`):**

```text
GET /                         -> HTTP 200; không có fallback sản phẩm/đánh giá; có /media/products/
GET /san-pham                 -> HTTP 200; không có fallback sản phẩm; có /media/products/
GET /san-pham/<slug>          -> HTTP 200; có công cụ thiết kế và /media/products/
GET /media/products/1788762943877.png -> HTTP 200, image/png, 1,746,231 byte
Lần đầu qua Vercel CDN       -> x-vercel-cache: MISS
Hai lần truy cập tiếp theo    -> x-vercel-cache: HIT
Cache-Control                 -> public, max-age=31536000, immutable
```

Ảnh gốc trên Supabase cũng trả HTTP 200. Không cần `supabase db push` hoặc deploy Edge Function vì bản sửa không có migration hay thay đổi Supabase; đẩy code GitHub đã kích hoạt Vercel. Cần theo dõi Usage → Cached Egress trong kỳ tới để đánh giá mức tiết kiệm thực tế. Trạng thái vẫn là **ĐANG SỬA CHỮA** theo yêu cầu; chưa có số liệu đủ dài để xác nhận hạn mức 5 GB/tháng sẽ luôn được giữ.
