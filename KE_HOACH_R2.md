# Kế hoạch: Supabase Pro 1 tháng → chuyển Storage sang Cloudflare R2

Mục tiêu: mở khoá site ngay, dùng đúng 1 tháng Pro làm cửa sổ để dời ảnh sang
Cloudflare R2 (egress $0), rồi hạ về Free và không bao giờ đụng hạn mức nữa.

**Nguyên tắc xuyên suốt**: copy ảnh ra khỏi Supabase *chính là egress*. Trên Free
nó khoá lại ngay lập tức. Vì vậy **toàn bộ việc copy phải xong trong tháng Pro**.

---

## Giai đoạn 0 — Mở khoá (bạn làm, ~5 phút)

- [x] Nâng project `xknkhczeuyjxtiljeaoz` lên **Pro** trong Supabase Dashboard → Settings → Billing. Người dùng xác nhận 12/10/2026.
- [x] **Ngày gia hạn Supabase Pro: 12/11/2026.** Đã đọc trực tiếp từ dashboard
      (Billing → Upcoming Invoice: "October 12 - November 12 · 30 days left").
      Chu kỳ Free cũ reset ngày 27 **không còn áp dụng** — Supabase lấy ngày nâng
      cấp làm mốc mới.
      ⚠️ **HẠN CHÓT HẠ VỀ FREE: trước 12/11/2026.** Quên là mất thêm $25.
      (Đừng nhầm với chu kỳ R2 cũng là 12/10–12/11 — hai thứ khác nhau.)
- [ ] Chủ dự án đặt nhắc lịch ~09/11/2026.
- [x] **Spend cap của Supabase đang TẮT** ("Spend cap is disabled — You will be
      charged for usage beyond the included quota"). Trên Free, spend cap bật là
      lý do project bị *khoá* thay vì bị tính tiền; trên Pro thì ngược lại —
      không còn chốt chặn, vượt hạn mức là trừ thẻ. Pro bao 250 GB egress, mức
      dùng thực ~5 GB/tháng nên rủi ro thấp, nhưng lưới an toàn đã bị gỡ.
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
- [~] ~~Chụp màn hình Usage → Cached Egress làm mốc đối chiếu.~~ **BỎ** (14/10/2026):
      mốc này để so trước/sau khi dời ảnh, nhưng Giai đoạn 2 đã xong từ 12/10 nên
      không còn "trước" để chụp. Thay bằng số đo trực tiếp ở mục kiểm tra dưới đây.

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
- [x] **Vercel: đủ 5/5 biến bắt buộc + `R2_SUPABASE_FALLBACK`**, cả Production
      lẫn Preview (2 biến credential do chủ dự án tự nhập, type Secret).
      Bài học giữ lại: `isR2Configured()` ném lỗi khi cấu hình **dở dang** (có
      một phần, không đủ 5). Nếu sau này sửa biến R2, đừng để deploy chạy giữa
      chừng — `/api/admin/upload` và `/api/design/export` sẽ trả 500, cái sau nằm
      trong luồng đặt hàng của khách.

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
- [x] Đối chiếu số object R2 với Supabase — đã chạy, 418/418 verified, 0 lỗi: `node --env-file=.env.local scripts/migrate-storage-to-r2.mjs --verify-only`. Báo cáo từng bucket nằm trong `.vercel/r2-migration-verify.json`; phải có `failed=0` và `verified=sourceObjects`.
- [x] Duyệt lại site sau deploy `eb4b666` — **Giai đoạn 2 HOÀN TẤT 12/10/2026**:

```text
GET /media/products/1788762943877.png        -> 200, image/png,  X-Media-Source: r2
GET /media/products/1788762943877.png?w=640  -> 200, image/webp, X-Media-Source: r2
Trang chủ: HTTP 200, 4 sản phẩm, 17 ảnh /media, 0 thẻ ảnh trỏ Supabase
```

- [x] **Đường GHI vào R2 đã kiểm chứng** (upload thật từ admin, không phải script):

```text
products/1791791317603.jpeg — 83 KB, KHÔNG có metadata supabase-id -> do app ghi
  /media/<key>        -> 200, image/jpeg,  X-Media-Source: r2
  /media/<key>?w=640  -> 200, 25.662 byte, image/webp
  cdn.trangsucdecoco.vn/<key> -> 200, 85.302 byte
  Supabase Storage cùng key   -> HTTP 400 (không tồn tại)
```

Cái cuối là bằng chứng app ghi **chỉ** vào R2, không fallback sang Supabase.

- [x] Budget alert `R2 decoco - vuot han muc free`: ngưỡng **$1**, email
      decoco.accessories@gmail.com, trạng thái Enabled. R2 không có spend cap nên
      đây là lớp cảnh báo duy nhất (cạnh default alert Cloudflare tự tạo).

### Chi phí R2 thực tế (12/10/2026)

| Khoản | Đang dùng | Free tier | Vượt thì tính |
| --- | --- | --- | --- |
| Lưu trữ | **0,303 GB (3,0%)** | 10 GB/tháng | $0,015/GB-tháng |
| Class A (ghi) | 446 | 1 triệu/tháng | $4,50/triệu |
| Class B (đọc) | 1.330 | 10 triệu/tháng | $0,36/triệu |
| **Egress** | 309 MB | **không giới hạn** | **$0 ở mọi mức** |

Bucket `designs` lớn dần theo đơn (~0,63 MB/thiết kế) — cần thêm ~15.000 đơn mới
chạm 10 GB, và khi đó 15 GB cũng chỉ $0,075/tháng.

---

## Giai đoạn 3 — Cắt đuôi và hạ về Free (trước ngày gia hạn)

- [x] **Kiểm tra sẵn sàng cắt (14/10/2026): 424/424 key có trong R2, 0 thiếu.**
      `node --env-file=.env.local scripts/check-r2-cutover-ready.mjs`
      Script đối chiếu **hai chiều**, kiểm trực tiếp trên `cdn.trangsucdecoco.vn`
      (domain của R2) để không bị cache CDN Vercel đánh lừa:

      A. 418 object đang nằm trong 4 bucket Supabase (site 25 / products 196 /
         frames 47 / designs 150) — bắt file nào được thêm vào Supabase SAU lần migrate.
      B. 149 key ảnh mà database đang tham chiếu (`products.images`,
         `products.variants[].image_url`, `frames.thumbnail_url`,
         `frames.config.backgroundImage`, `feedback_items`, `site_content`,
         `orders.design_image_url`) — bắt ảnh được tham chiếu nhưng thiếu ở cả hai nơi.

      Hợp lại 424 key duy nhất, tất cả trả HTTP 200 từ R2. (424 > 418 vì có 6 ảnh
      upload sau migration, chỉ tồn tại ở R2 — đúng như mong đợi.)

- [x] **Audit code đường ghi (14/10/2026)**: trong toàn bộ `app/`, `lib/`,
      `components/`, chỉ `lib/storage/upload.ts` chạm Supabase Storage lúc runtime,
      và nó đã ưu tiên R2 (`isR2Configured()` → `uploadR2Image`). Các chỗ còn lại
      là script chạy tay. Nghĩa là sau khi cắt, app không còn đường nào đọc hay
      ghi Supabase Storage.

- [ ] Tắt fallback Supabase bằng `R2_SUPABASE_FALLBACK=false` trong Production + Preview rồi deploy. Cờ này chặn cả đọc lẫn ghi Supabase Storage; chỉ bật sau khi copy + verify hoàn tất.
      ⚠️ **Phải do chủ dự án làm**: Vercel CLI đã cài nhưng chưa đăng nhập
      (`vercel whoami` treo ở prompt login), nên tôi không đổi được biến môi trường.
      Cách nhanh nhất: Vercel Dashboard → project `gift-web-decoco` → Settings →
      Environment Variables → sửa `R2_SUPABASE_FALLBACK` thành `false` cho cả
      Production và Preview → Redeploy. Hoặc chạy `vercel login` rồi báo tôi.
- [ ] Theo dõi 2–3 ngày, xác nhận không còn request nào chạm Supabase Storage.
      (Phần lớn đã được thay bằng 2 bước kiểm tra ở trên — chúng quét toàn bộ
      object thay vì lấy mẫu. Việc theo dõi còn lại chỉ để bắt các luồng phát
      sinh lúc chạy thật, ví dụ khách đặt đơn mới sinh ảnh thiết kế.)
- [ ] **Xoá toàn bộ object trong Supabase Storage** — Free chỉ cho 1 GB, và không
      còn lý do giữ bản sao. Giữ lại một bản backup ở máy nếu thấy cần.
      Chỉ làm SAU khi đã tắt fallback và theo dõi xong. Đây là thao tác không hoàn
      tác được — cần chủ dự án xác nhận rõ ràng trước khi chạy.
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

**Giai đoạn 0, 1, 2: XONG. Giai đoạn 3: đã kiểm tra sẵn sàng, chờ chủ dự án đổi biến môi trường trên Vercel.** (cập nhật 14/10/2026)

- Inventory cuối: `site` 25 / `products` 196 / `frames` 47 / `designs` 150 =
  **418 object, 310,65 MB**. Copy 418/418, verify độc lập 418/418, 0 lỗi.
  (Con số 417 ghi trong bản nháp trước là inventory cũ, đã lỗi thời.)
- Các URL cũ trong database **giữ nguyên** — `/media` là lớp gián tiếp, nó đọc ở
  đâu là chuyện nội bộ. Không có migration database nào.
- Link tải ảnh thiết kế trong admin và email đi qua `/media`; upload R2 trả URL
  tuyệt đối của website để API đặt hàng tiếp tục chấp nhận.
- Migration kiểm Content-MD5 khi upload, lưu SHA-256 + metadata nguồn, HEAD verify
  sau upload, `IfNoneMatch` chống ghi đè; chạy lại bỏ qua file đã xác minh.
  `--verify-only` chỉ đối chiếu metadata/dung lượng, không tải lại nội dung.
- Đường đọc **và** đường ghi R2 đều đã kiểm chứng trên production (xem mục 2c).
- Budget alert $1 đã bật. R2 không có spend cap.
- Vercel CLI chưa cài/đăng nhập — không cần, deploy đi qua git push như thường lệ.

### Sự cố phát sinh trong quá trình làm (chi tiết ở BUG_REPORT.md)

- `/media` trả **500 toàn bộ** sau deploy `4192094` vì `import sharp` ở đầu route;
  runtime Vercel không nạp được native binary thì cả route sập. Sửa ở `68adb7a`
  bằng lazy import + fallback phục vụ ảnh gốc với cache 5 phút.
- Sharp ban đầu **không chạy** trên Vercel. Sửa bằng `serverExternalPackages` +
  `outputFileTracingIncludes` trong `next.config.ts`. Đã xác minh sau deploy:
  `?w=640` trả `image/webp` với `max-age=31536000` (không rơi vào nhánh fallback).
- Credential GitHub bị xoá nhầm dựa trên chẩn đoán sai (`git push` treo trong tool
  call là do GCM chặn prompt, không phải hết hạn). Cách đúng: chạy push ở chế độ
  nền. Credential vẫn luôn hợp lệ.

## Rủi ro còn lại

- **Quên hạ về Free trước 12/11/2026** → mất thêm $25. Đây là rủi ro lớn nhất
  còn lại, và là việc duy nhất có deadline cứng.
- ~~Copy chưa xong mà đã hết tháng Pro~~ — **không còn rủi ro**, copy xong 12/10.
- ~~Cloudflare có thể yêu cầu thẻ thanh toán cho R2~~ — **đã xác nhận: có.**
  Phải bật R2 subscription (tự gia hạn, gắn payment method) kể cả khi dùng trong
  hạn mức free. Chủ dự án đã bật 12/10/2026.
- ~~sharp có thể không chạy trên Vercel~~ — **đã xảy ra và đã sửa xong**, xem mục
  sự cố ở trên.
- **Supabase spend cap đang tắt** — vượt hạn mức Pro là trừ thẻ, không bị chặn.


## Cập nhật 14/10/2026

Đã chạy kiểm tra sẵn sàng cho Giai đoạn 3 — **424/424 key đã có trong R2, 0 thiếu**.
Thêm `scripts/check-r2-cutover-ready.mjs` để chạy lại bất cứ lúc nào (nên chạy lại
ngay trước khi bấm cắt, phòng khi có ảnh mới phát sinh).

**Việc còn lại, theo thứ tự bắt buộc:**

1. Chủ dự án đổi `R2_SUPABASE_FALLBACK=false` (Production + Preview) rồi redeploy.
2. Chạy lại `scripts/check-r2-cutover-ready.mjs` + duyệt site, xác nhận ảnh vẫn hiện.
3. Chủ dự án xác nhận → xoá object trong Supabase Storage (không hoàn tác được).
4. Hạ gói về Free trong Supabase Dashboard.

**Rủi ro có deadline cứng vẫn còn nguyên: phải hạ về Free trước 12/11/2026, nếu không
mất thêm $25.** Mục "đặt nhắc lịch ~09/11/2026" vẫn chưa tick.
