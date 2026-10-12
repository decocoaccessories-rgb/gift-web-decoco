# Kế hoạch: Supabase Pro 1 tháng → chuyển Storage sang Cloudflare R2

Mục tiêu: mở khoá site ngay, dùng đúng 1 tháng Pro làm cửa sổ để dời ảnh sang
Cloudflare R2 (egress $0), rồi hạ về Free và không bao giờ đụng hạn mức nữa.

**Nguyên tắc xuyên suốt**: copy ảnh ra khỏi Supabase *chính là egress*. Trên Free
nó khoá lại ngay lập tức. Vì vậy **toàn bộ việc copy phải xong trong tháng Pro**.

---

## Giai đoạn 0 — Mở khoá (bạn làm, ~5 phút)

- [x] Nâng project `xknkhczeuyjxtiljeaoz` lên **Pro** trong Supabase Dashboard → Settings → Billing. Người dùng xác nhận 12/10/2026.
- [ ] **Ghi lại ngày gia hạn kế tiếp** mà dashboard hiển thị. Đặt nhắc lịch **trước ngày đó 3 ngày** — đây là hạn chót để hạ về Free, quên là mất thêm $25.
- [x] Kiểm tra restriction đã gỡ: REST products trả HTTP 200 ngày 12/10/2026.

```bash
curl -s -o /dev/null -w "%{http_code}\n" \
  "https://xknkhczeuyjxtiljeaoz.supabase.co/rest/v1/products?select=slug&limit=1" \
  -H "apikey: <NEXT_PUBLIC_SUPABASE_ANON_KEY>"
```

`200` = xong. `402` = chờ vài phút rồi thử lại.

---

## Giai đoạn 1 — Thu hồi thành quả đã code (ngay sau khi mở khoá)

- [x] **Xác minh sharp có chạy trên Vercel không**: production trả `image/png` và `max-age=300` ngày 12/10/2026. Sharp chưa nạp được. Đã thêm tracing native package vào `next.config.ts`, chờ deploy rồi kiểm tra WebP.

```bash
curl -sI 'https://trangsucdecoco.vn/media/products/1788762943877.png?w=640' \
  | grep -i 'content-type\|cache-control'
```

| Kết quả | Nghĩa là |
| --- | --- |
| `image/webp` | sharp OK, resize hoạt động |
| `image/png` + `max-age=300` | sharp không nạp được trên Vercel → cần sửa cách đóng gói |

- [x] **Chạy backfill thumbnail khung**: 4 khung, 0 lỗi; 1,28 MB → 0,03 MB (-97,9%). Kiểm tra cả 4 thumbnail trả HTTP 200, chiều rộng 400px. Chạy lại bỏ qua cả 4.

```bash
node --env-file=.env.local scripts/backfill-frame-thumbnails.mjs --dry-run
node --env-file=.env.local scripts/backfill-frame-thumbnails.mjs
```

Ghi lại con số "trước → sau" mà script in ra, dán vào `BUG_REPORT.md`.

- [ ] Kiểm tra site đã hiện đủ: trang chủ có hero + sản phẩm, `/san-pham` có lưới,
      `/san-pham/<slug>` có công cụ thiết kế và lưới chọn khung.
- [ ] Chụp màn hình Usage → Cached Egress làm mốc đối chiếu.

---

## Giai đoạn 2 — Chuyển Storage sang R2 (trong tháng Pro)

### 2a. Bạn chuẩn bị hạ tầng

- [ ] Cloudflare Dashboard → **R2** → Create bucket, tên `decoco`.
      (Lưu ý: có thể Cloudflare bắt gắn thẻ thanh toán để bật R2 kể cả khi dùng
      trong hạn mức free — chưa xác nhận, bạn kiểm tra lúc bật.)
- [ ] Bucket → Settings → **Custom domain**: gắn `cdn.trangsucdecoco.vn`.
      DNS đã ở Cloudflare nên chỉ vài cú click.
- [ ] R2 → **Manage API Tokens** → tạo token quyền *Object Read & Write*, phạm vi
      đúng bucket `decoco`. Lưu lại Access Key ID + Secret.
- [ ] Thêm env vào `.env.local` **và** Vercel (Production + Preview):

```
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=decoco
R2_PUBLIC_BASE_URL=https://cdn.trangsucdecoco.vn
```

### 2b. Tôi làm phần code

- [x] `/media` route: đọc từ R2 trước, **fallback về Supabase** nếu object chưa có
      ở R2 → chuyển dần, không downtime.
- [x] `/api/admin/upload` và `/api/design/export`: ghi vào R2 (`@aws-sdk/client-s3`). Khi chưa có cấu hình R2, vẫn dùng Supabase trong giai đoạn chuẩn bị; lỗi ghi R2 không chuyển ngược sang Supabase.
- [x] Script `scripts/migrate-storage-to-r2.mjs`: copy toàn bộ object từ 4 bucket
      Supabase (`site`, `products`, `frames`, `designs`) sang R2, giữ nguyên đường dẫn.
- [x] Test + build: `npm.cmd test`, `npm.cmd run test:r2`, test export thiết kế và test email người nhận đều qua; `npm.cmd run build` thành công, TypeScript và 37/37 trang.
- [ ] Deploy rồi xác minh resize WebP trên Vercel và nguồn ảnh R2.

**Không phải sửa database.** URL Supabase đang nằm trong `products.images`,
`frames.config`, `orders.design_image_url` giữ nguyên — `getCachedStorageUrl` vốn
chỉ dùng chúng để suy ra `/media/<bucket>/<path>`, còn `/media` đọc ở đâu là
chuyện nội bộ của nó.

### 2c. Chạy di chuyển

- [x] `node --env-file=.env.local scripts/migrate-storage-to-r2.mjs --dry-run`: 417 object, 310,59 MiB ngày 12/10/2026; chỉ đọc danh sách, không tải ảnh.
- [ ] `node --env-file=.env.local scripts/migrate-storage-to-r2.mjs`
- [ ] Đối chiếu số object R2 với Supabase: chạy `node --env-file=.env.local scripts/migrate-storage-to-r2.mjs --verify-only`. Báo cáo từng bucket nằm trong `.vercel/r2-migration-verify.json`; phải có `failed=0` và `verified=sourceObjects`.
- [ ] Duyệt lại site: trang chủ, danh mục, chi tiết, công cụ thiết kế, admin —
      xác nhận ảnh hiện đủ.

---

## Giai đoạn 3 — Cắt đuôi và hạ về Free (trước ngày gia hạn)

- [ ] Tắt fallback Supabase bằng `R2_SUPABASE_FALLBACK=false` trong Production + Preview rồi deploy. Cờ này chặn cả đọc lẫn ghi Supabase Storage; chỉ bật sau khi copy + verify hoàn tất.
- [ ] Theo dõi 2–3 ngày, xác nhận không còn request nào chạm Supabase Storage.
- [ ] **Xoá toàn bộ object trong Supabase Storage** — Free chỉ cho 1 GB, và không
      còn lý do giữ bản sao. Giữ lại một bản backup ở máy nếu thấy cần.
- [ ] Hạ về **Free** trong Settings → Billing.
- [ ] Kiểm tra lại site sau khi hạ: egress Supabase giờ chỉ còn JSON của database
      (vài trăm KB, cache 5 phút) — không có đường nào chạm nổi 5 GB.

---

## Sau khi xong

| Thành phần | Nơi ở | Chi phí |
| --- | --- | --- |
| Postgres + Auth | Supabase Free | $0 |
| Ảnh (4 bucket) | Cloudflare R2 | $0 (dưới 10 GB, egress free) |
| Hosting + CDN | Vercel | $0 |

Và lời khuyên "gộp deploy để đỡ tốn egress" trở thành vô nghĩa — R2 không tính
tiền egress, deploy bao nhiêu lần cũng được.

## Tiến độ thực hiện 12/10/2026

- Inventory: `site` 25 file / 20,48 MiB; `products` 196 / 174,52 MiB; `frames` 47 / 21,93 MiB; `designs` 149 / 93,66 MiB. Tổng 417 file / 310,59 MiB.
- Các URL cũ trong database giữ nguyên. Link tải ảnh thiết kế trong admin và email mới đi qua `/media`; upload R2 trả URL tuyệt đối của website để API đặt hàng tiếp tục chấp nhận.
- Migration kiểm tra Content-MD5 khi upload, lưu SHA-256 + metadata nguồn, xác minh HEAD sau upload; chạy lại bỏ qua file đã xác minh và từ chối ghi đè file khác nguồn. `--verify-only` chỉ đối chiếu metadata/dung lượng, không tải lại toàn bộ nội dung.
- `.env.local` chưa có `R2_*`; chưa có thông tin ngày gia hạn. Chưa copy thật hoặc tắt fallback.
- Vercel connector báo 403 cho team dự án; Vercel CLI chưa đăng nhập. Cần đăng nhập `vercel.cmd login` trước khi deploy.
- Trang chủ, danh mục và một trang chi tiết sản phẩm đều HTTP 200. Chưa hoàn tất kiểm tra trực quan/Usage Dashboard vì công cụ trình duyệt không khởi tạo được.
- Hướng dẫn R2: [tạo token S3](https://developers.cloudflare.com/r2/api/tokens/), [gắn custom domain](https://developers.cloudflare.com/r2/buckets/public-buckets/).
- Thêm đủ 5 biến `R2_*` ở mục 2a vào `.env.local` và Vercel Production + Preview. Không gửi secret vào chat hoặc commit. Để `R2_SUPABASE_FALLBACK=true` trong giai đoạn copy.
- Sau deploy, kiểm tra `/media/...` có `X-Media-Source: r2` cho file đã copy; kiểm tra `?w=640` có `Content-Type: image/webp` để xác nhận sharp trên Linux.

## Rủi ro còn lại

- **Quên hạ về Free** → mất thêm $25. Đặt nhắc lịch ngay ở Giai đoạn 0.
- **Copy chưa xong mà đã hết tháng Pro** → kẹt giữa chừng. Làm Giai đoạn 2 sớm,
  đừng để sát ngày.
- **Cloudflare có thể yêu cầu thẻ thanh toán cho R2** — chưa xác nhận.
- **sharp có thể không chạy trên Vercel** (Giai đoạn 1) — nếu vậy ảnh vẫn hiển thị
  bình thường, chỉ là không được thu nhỏ; xử lý riêng, không chặn kế hoạch R2.
