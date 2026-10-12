// Kiểm chứng việc sinh thumbnail cho ảnh nền khung (BUG_REPORT.md — rò rỉ #1).
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import sharp from "sharp";
import {
  FRAME_THUMBNAIL_WIDTH,
  createFrameThumbnail,
  toThumbnailPath,
} from "../lib/images/frame-thumbnail.ts";

// Ảnh nền khung thật có kích thước canvas 1772x1535 và được lưu dạng PNG.
const original = await sharp({
  create: {
    width: 1772,
    height: 1535,
    channels: 3,
    noise: { type: "gaussian", mean: 128, sigma: 42 },
  },
})
  .png()
  .toBuffer();

const thumbnail = await createFrameThumbnail(original);
const meta = await sharp(thumbnail).metadata();

assert.equal(meta.format, "webp", "thumbnail must be WebP");
assert.equal(meta.width, FRAME_THUMBNAIL_WIDTH, `thumbnail must be ${FRAME_THUMBNAIL_WIDTH}px wide`);
assert.equal(meta.height, 347, "thumbnail must keep the frame aspect ratio");
assert.ok(
  thumbnail.length < original.length / 10,
  `thumbnail must be far smaller than the original (got ${thumbnail.length} vs ${original.length})`
);

// Ảnh vốn đã nhỏ hơn mức thumbnail thì không được phóng to.
const small = await sharp({
  create: { width: 120, height: 120, channels: 3, background: "#ffffff" },
})
  .png()
  .toBuffer();
const smallThumb = await sharp(await createFrameThumbnail(small)).metadata();
assert.equal(smallThumb.width, 120, "images smaller than the target must not be enlarged");

// Đường dẫn thumbnail nằm cạnh ảnh gốc, không ghi đè lên nó.
assert.equal(toThumbnailPath("1788000000000.png"), "1788000000000-thumb.webp");
assert.equal(toThumbnailPath("khung/1788000000000.jpeg"), "khung/1788000000000-thumb.webp");
assert.equal(toThumbnailPath("khung/no-extension"), "khung/no-extension-thumb.webp");

// Route upload phải sinh thumbnail cho bucket frames và fail-soft khi lỗi.
const uploadSource = await readFile(new URL("../app/api/admin/upload/route.ts", import.meta.url), "utf8");
assert.match(uploadSource, /bucket === "frames"/, "upload route must thumbnail the frames bucket");
assert.match(uploadSource, /createFrameThumbnail/, "upload route must call createFrameThumbnail");
assert.match(uploadSource, /thumbnailUrl/, "upload route must return the thumbnail URL");
assert.match(
  uploadSource,
  /catch \(error\) \{[\s\S]*console\.warn\("Frame thumbnail generation failed/,
  "thumbnail failures must not fail the upload"
);

// Admin phải lưu thumbnail nhỏ vào frames.thumbnail_url, không lưu ảnh gốc.
const adminSource = await readFile(new URL("../app/admin/khung/page.tsx", import.meta.url), "utf8");
assert.match(
  adminSource,
  /thumbnail_url: thumbnailUrl \|\| config\.backgroundImage \|\| null/,
  "the frame editor must prefer the generated thumbnail over the full-size background"
);
assert.match(adminSource, /setThumbnailUrl\(\(data\.thumbnailUrl/, "the frame editor must read thumbnailUrl from the upload response");

const ratio = ((1 - thumbnail.length / original.length) * 100).toFixed(1);
console.log(`PASS: Frame thumbnails are WebP ${FRAME_THUMBNAIL_WIDTH}px, aspect ratio preserved.`);
console.log(
  `PASS: ảnh mẫu 1772x1535 PNG ${(original.length / 1024).toFixed(0)} KB -> ${(thumbnail.length / 1024).toFixed(0)} KB (-${ratio}%); 1772px -> 400px là ~1/20 số pixel.`
);
console.log("PASS: Small images are not enlarged; thumbnails never overwrite the original.");
console.log("PASS: Upload route generates thumbnails fail-soft; admin saves the thumbnail URL.");
