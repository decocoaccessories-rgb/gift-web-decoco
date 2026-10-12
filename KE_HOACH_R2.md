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

- [x] **Xác minh sharp có chạy trên Vercel không** — **XONG, sharp chạy được** (sau deploy `eef1033`):

```text
GET /media/products/1788762943877.png?w=640
-> HTTP 200, Content-Type: image/webp, Cache-Control: max-age=31536000, immutable
   (max-age dài = không rơi vào nhánh fallback 5 phút -> sharp nạp thành công)

Dung lượng thật đo trên production:
  gốc      1705,3 KB  image/png
  w=160        3,5 KB  image/webp   -99,8%
  w=320        9,1 KB  image/webp   -99,5%
  w=640       23,3 KB  image/webp   -98,6%   <- kích thước thẻ sản phẩm
  w=1024      44,0 KB  image/webp   -97,4%
  w=1600      56,9 KB  image/webp   -96,7%
```

Trước đó production trả `image/png` + `max-age=300` (sharp không nạp được). Fix:
`serverExternalPackages` + `outputFileTracingIncludes` trong `next.config.ts`.

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

- [x] Kiểm tra site đã hiện đủ: trang chủ trả HTTP 200 và có lại 4 link sản phẩm; REST API trả 200.
- [ ] Chụp màn hình Usage → Cached Egress làm mốc đối chiếu.

---

## Giai đoạn 2 — Chuyển Storage sang R2 (trong tháng Pro)

### 2a. Bạn chuẩn bị hạ tầng

- [x] **Bật R2 subscription** — chủ dự án đã bật 12/10/2026. Usage $0.00, chu kỳ 12/10–12/11.
      (mô tả gốc) — đã xác nhận 12/10/2026: Cloudflare **có** bắt bật
      subscription trước khi dùng R2, kể cả trong hạn mức free. Trang `/r2/plans`
      hiện nút "Add R2 subscription to my account" với điều khoản *"automatically
      renews and will be billed to your payment method on file"*. Chỉ bị tính tiền
      khi vượt hạn mức (10 GB storage / 1M Class A / 10M Class B, egress $0).
      **Bước này chủ dự án tự bấm** — là chấp nhận điều khoản + cam kết billing.
- [x] Bucket `decoco` đã tạo 12/10/2026, location **Asia-Pacific (APAC)**.
      Account ID (dùng cho `R2_ACCOUNT_ID`): `df5d6a94703273b40b8bed1522748e49`
- [x] Custom domain `cdn.trangsucdecoco.vn` đã gắn (CNAME `cdn` → `decoco`).
      Đã xác minh: `GET https://cdn.trangsucdecoco.vn/products/1788762943877.png`
      -> HTTP 200, 1.746.231 byte, image/png.
- [x] Token `decoco-web-storage` (Account API Token), quyền **Object Read & Write**,
      phạm vi đúng bucket `decoco`. Đã ghi vào `.env.local`.
- [x] `.env.local`: đủ 6 biến.
- [ ] **Vercel: mới có 3/5 biến bắt buộc** — còn thiếu `R2_ACCESS_KEY_ID` và
      `R2_SECRET_ACCESS_KEY` (chủ dự án tự nhập, type **Secret**, Production + Preview).
      ⚠️ **KHÔNG deploy cho tới khi đủ 5 biến**: `isR2Configured()` ném lỗi khi có
      một phần cấu hình, làm `/api/admin/upload` và `/api/design/export` trả 500 —
      cái sau nằm trong luồng đặt hàng của khách.

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
- [x] Deploy `eef1033` (12/10/2026). Resize WebP đã xác minh. `X-Media-Source: supabase` vì R2 chưa cấu hình — đúng như thiết kế fallback.

**Không phải sửa database.** URL Supabase đang nằm trong `products.images`,
`frames.config`, `orders.design_image_url` giữ nguyên — `getCachedStorageUrl` vốn
chỉ dùng chúng để suy ra `/media/<bucket>/<path>`, còn `/media` đọc ở đâu là
chuyện nội bộ của nó.

### 2c. Chạy di chuyển

- [x] `node --env-file=.env.local scripts/migrate-storage-to-r2.mjs --dry-run`: 417 object, 310,59 MiB ngày 12/10/2026; chỉ đọc danh sách, không tải ảnh.
- [x] Copy thật xong 12/10/2026: **418/418 object, 0 lỗi** (site 25, products 196,
      frames 47, designs 150). Số object R2 khớp nguồn từng bucket.
- [x] `--verify-only` chạy độc lập: **418/418 verified, 0 lỗi**.
- [ ] (cũ) Đối chiếu số object R2 với Supabase: chạy `node --env-file=.env.local scripts/migrate-storage-to-r2.mjs --verify-only`. Báo cáo từng bucket nằm trong `.vercel/r2-migration-verify.json`; phải có `failed=0` và `verified=sourceObjects`.
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
