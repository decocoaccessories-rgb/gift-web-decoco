// Chặn hồi quy cho sự cố "Supabase vượt Cached Egress" (BUG_REPORT.md).
// Mọi điểm render ảnh lấy từ Supabase Storage phải đi qua getCachedStorageUrl()
// để byte được phục vụ từ Vercel CDN thay vì Supabase.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { getCachedStorageUrl } from "../lib/supabase/storage-url.ts";

const projectUrl = "https://project-ref.supabase.co";

// 1. Ảnh khung (nguồn rò rỉ nặng nhất: ảnh gốc 1772x1535, tải mỗi lượt xem trang)
const frameBackground = `${projectUrl}/storage/v1/object/public/frames/1788000000000.png`;
assert.equal(
  getCachedStorageUrl(frameBackground, projectUrl),
  "/media/frames/1788000000000.png",
  "frame background images must be served through the site CDN route"
);

// 2. Ảnh thiết kế của khách ở trang đặt hàng
assert.equal(
  getCachedStorageUrl(`${projectUrl}/storage/v1/object/public/designs/orders/abc.png`, projectUrl),
  "/media/designs/orders/abc.png",
  "customer design images must be served through the site CDN route"
);

// 3. Quét nguồn: không file nào được render URL Supabase thô nữa.
const guardedSources = [
  ["components/DesignTool/FramePanel.tsx", ["previewUrl"]],
  ["components/DesignTool/DesignToolCanvas.tsx", ["config.backgroundImage"]],
  ["app/(site)/dat-hang/page.tsx", ["designInfo.designImageUrl"]],
  ["app/admin/khung/page.tsx", ["previewUrl", "getCurrentBgUrl"]],
  ["app/admin/noi-dung/page.tsx", ["draft.image_url"]],
  ["app/admin/don-hang/OrderDetailDialog.tsx", ["order.design_image_url"]],
  ["app/admin/san-pham/page.tsx", ["img"]],
];

for (const [file] of guardedSources) {
  const source = await readFile(new URL(`../${file}`, import.meta.url), "utf8");
  assert.match(
    source,
    /getCachedStorageUrl/,
    `${file} renders Supabase Storage images and must import/use getCachedStorageUrl`
  );
}

// FramePanel + DesignToolCanvas là hai điểm nặng nhất -> kiểm tra chính xác dòng gọi.
const framePanel = await readFile(new URL("../components/DesignTool/FramePanel.tsx", import.meta.url), "utf8");
assert.match(
  framePanel,
  /const previewUrl = rawPreviewUrl \? getCachedStorageUrl\(rawPreviewUrl\)/,
  "FramePanel thumbnails must go through getCachedStorageUrl"
);

const canvas = await readFile(new URL("../components/DesignTool/DesignToolCanvas.tsx", import.meta.url), "utf8");
assert.match(
  canvas,
  /FabricImage\.fromURL\(getCachedStorageUrl\(config\.backgroundImage\)/,
  "the fabric canvas must load frame backgrounds through getCachedStorageUrl"
);

// 4. Không còn URL Supabase hard-code trong mã render.
for (const [file] of guardedSources) {
  const source = await readFile(new URL(`../${file}`, import.meta.url), "utf8");
  assert.doesNotMatch(
    source,
    /supabase\.co\/storage/,
    `${file} must not hard-code a Supabase Storage URL`
  );
}

console.log("PASS: Frame thumbnails are served through the site CDN cache.");
console.log("PASS: The fabric canvas loads frame backgrounds through the site CDN cache.");
console.log("PASS: Checkout and admin image previews are served through the site CDN cache.");
console.log("PASS: No render path hard-codes a Supabase Storage URL.");
