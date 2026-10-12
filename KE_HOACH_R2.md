# Kế hoạch: Supabase Pro 1 tháng → chuyển Storage sang Cloudflare R2

Mục tiêu: mở khoá site ngay, dùng đúng 1 tháng Pro làm cửa sổ để dời ảnh sang
Cloudflare R2 (egress $0), rồi hạ về Free và không bao giờ đụng hạn mức nữa.

**Nguyên tắc xuyên suốt**: copy ảnh ra khỏi Supabase *chính là egress*. Trên Free
nó khoá lại ngay lập tức. Vì vậy **toàn bộ việc copy phải xong trong tháng Pro**.

---

## Giai đoạn 0 — Mở khoá (bạn làm, ~5 phút)

- [ ] Nâng project `xknkhczeuyjxtiljeaoz` lên **Pro** trong Supabase Dashboard → Settings → Billing.
- [ ] **Ghi lại ngày gia hạn kế tiếp** mà dashboard hiển thị. Đặt nhắc lịch **trước ngày đó 3 ngày** — đây là hạn chót để hạ về Free, quên là mất thêm $25.
- [ ] Kiểm tra restriction đã gỡ:

```bash
curl -s -o /dev/null -w "%{http_code}\n" \
  "https://xknkhczeuyjxtiljeaoz.supabase.co/rest/v1/products?select=slug&limit=1" \
  -H "apikey: <NEXT_PUBLIC_SUPABASE_ANON_KEY>"
```

`200` = xong. `402` = chờ vài phút rồi thử lại.

---

## Giai đoạn 1 — Thu hồi thành quả đã code (ngay sau khi mở khoá)

- [ ] **Xác minh sharp có chạy trên Vercel không** — đây là ẩn số lớn nhất còn lại:

```bash
curl -sI 'https://trangsucdecoco.vn/media/products/1788762943877.png?w=640' \
  | grep -i 'content-type\|cache-control'
```

| Kết quả | Nghĩa là |
| --- | --- |
| `image/webp` | sharp OK, resize hoạt động |
| `image/png` + `max-age=300` | sharp không nạp được trên Vercel → cần sửa cách đóng gói |

- [ ] **Chạy backfill thumbnail khung**:

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

- [ ] `/media` route: đọc từ R2 trước, **fallback về Supabase** nếu object chưa có
      ở R2 → chuyển dần, không downtime.
- [ ] `/api/admin/upload` và `/api/design/export`: ghi vào R2 (`@aws-sdk/client-s3`).
- [ ] Script `scripts/migrate-storage-to-r2.mjs`: copy toàn bộ object từ 4 bucket
      Supabase (`site`, `products`, `frames`, `designs`) sang R2, giữ nguyên đường dẫn.
- [ ] Test + build + deploy.

**Không phải sửa database.** URL Supabase đang nằm trong `products.images`,
`frames.config`, `orders.design_image_url` giữ nguyên — `getCachedStorageUrl` vốn
chỉ dùng chúng để suy ra `/media/<bucket>/<path>`, còn `/media` đọc ở đâu là
chuyện nội bộ của nó.

### 2c. Chạy di chuyển

- [ ] `node --env-file=.env.local scripts/migrate-storage-to-r2.mjs --dry-run`
- [ ] `node --env-file=.env.local scripts/migrate-storage-to-r2.mjs`
- [ ] Đối chiếu số object R2 với Supabase.
- [ ] Duyệt lại site: trang chủ, danh mục, chi tiết, công cụ thiết kế, admin —
      xác nhận ảnh hiện đủ.

---

## Giai đoạn 3 — Cắt đuôi và hạ về Free (trước ngày gia hạn)

- [ ] Bỏ nhánh fallback Supabase trong `/media` (tôi làm). Deploy.
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

## Rủi ro cần biết trước

- **Quên hạ về Free** → mất thêm $25. Đặt nhắc lịch ngay ở Giai đoạn 0.
- **Copy chưa xong mà đã hết tháng Pro** → kẹt giữa chừng. Làm Giai đoạn 2 sớm,
  đừng để sát ngày.
- **Cloudflare có thể yêu cầu thẻ thanh toán cho R2** — chưa xác nhận.
- **sharp có thể không chạy trên Vercel** (Giai đoạn 1) — nếu vậy ảnh vẫn hiển thị
  bình thường, chỉ là không được thu nhỏ; xử lý riêng, không chặn kế hoạch R2.
