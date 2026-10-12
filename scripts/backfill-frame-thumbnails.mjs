/**
 * Sinh thumbnail nhỏ cho các khung đã có trong Supabase.
 *
 * Khung cũ lưu `thumbnail_url` = chính ảnh nền gốc (PNG 1772x1535, vài MB), nên
 * lưới chọn khung tải ảnh gốc ở mọi lượt xem trang sản phẩm. Script tải ảnh gốc
 * một lần, sinh bản WebP 400px, upload vào bucket `frames` rồi cập nhật
 * `frames.thumbnail_url`.
 *
 *   node --env-file=.env.local scripts/backfill-frame-thumbnails.mjs --dry-run
 *   node --env-file=.env.local scripts/backfill-frame-thumbnails.mjs
 *
 * Cần NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY. Chạy lại được nhiều
 * lần: khung đã có thumbnail riêng sẽ bị bỏ qua.
 */
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

const DRY_RUN = process.argv.includes("--dry-run");
const BUCKET = "frames";
const THUMBNAIL_WIDTH = 400;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceKey) {
  console.error("Thiếu NEXT_PUBLIC_SUPABASE_URL hoặc SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const PUBLIC_PREFIX = "/storage/v1/object/public/";

/** `https://ref.supabase.co/storage/v1/object/public/frames/a.png` -> `frames/a.png` */
function toObjectPath(url) {
  try {
    const parsed = new URL(url);
    if (new URL(supabaseUrl).origin !== parsed.origin) return null;
    if (!parsed.pathname.startsWith(PUBLIC_PREFIX)) return null;
    return decodeURIComponent(parsed.pathname.slice(PUBLIC_PREFIX.length)) || null;
  } catch {
    return null;
  }
}

function toThumbnailPath(objectPath) {
  const dot = objectPath.lastIndexOf(".");
  const slash = objectPath.lastIndexOf("/");
  const base = dot > slash ? objectPath.slice(0, dot) : objectPath;
  return `${base}-thumb.webp`;
}

const { data: frames, error } = await supabase
  .from("frames")
  .select("id, name, thumbnail_url, config")
  .order("sort_order");

if (error) {
  console.error("Không đọc được bảng frames:", error.message);
  process.exitCode = 1;
}

let converted = 0;
let skipped = 0;
let failed = 0;
let bytesBefore = 0;
let bytesAfter = 0;

// Lỗi đọc bảng -> không có gì để xử lý, bỏ qua vòng lặp và phần tổng kết.
for (const frame of error ? [] : (frames ?? [])) {
  const background = frame.config?.backgroundImage ?? null;
  const label = `${frame.name} (${frame.id})`;

  if (!background) {
    console.log(`SKIP  ${label} — không có backgroundImage`);
    skipped++;
    continue;
  }
  if (frame.thumbnail_url && frame.thumbnail_url !== background) {
    console.log(`SKIP  ${label} — đã có thumbnail riêng`);
    skipped++;
    continue;
  }

  const objectPath = toObjectPath(background);
  if (!objectPath) {
    console.log(`SKIP  ${label} — backgroundImage không nằm trong Storage của project`);
    skipped++;
    continue;
  }

  const bucket = objectPath.split("/")[0];
  const inBucketPath = objectPath.slice(bucket.length + 1);
  const thumbnailPath = toThumbnailPath(inBucketPath);

  try {
    const { data: original, error: downloadError } = await supabase.storage
      .from(bucket)
      .download(inBucketPath);
    if (downloadError) throw downloadError;

    const source = Buffer.from(await original.arrayBuffer());
    const thumbnail = await sharp(source)
      .rotate()
      .resize({ width: THUMBNAIL_WIDTH, withoutEnlargement: true, fit: "inside" })
      .webp({ quality: 72 })
      .toBuffer();

    bytesBefore += source.length;
    bytesAfter += thumbnail.length;

    const saved = (100 - (thumbnail.length / source.length) * 100).toFixed(1);
    console.log(
      `${DRY_RUN ? "DRY   " : "FIX   "}${label} — ${(source.length / 1024).toFixed(0)} KB -> ${(thumbnail.length / 1024).toFixed(0)} KB (-${saved}%)`
    );

    if (DRY_RUN) {
      converted++;
      continue;
    }

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(thumbnailPath, thumbnail, {
        contentType: "image/webp",
        cacheControl: "31536000",
        upsert: true,
      });
    if (uploadError) throw uploadError;

    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(thumbnailPath);
    const { error: updateError } = await supabase
      .from("frames")
      .update({ thumbnail_url: urlData.publicUrl })
      .eq("id", frame.id);
    if (updateError) throw updateError;

    converted++;
  } catch (err) {
    console.error(`FAIL  ${label} — ${err?.message ?? err}`);
    failed++;
  }
}

if (!error) {
  const savedPct = bytesBefore ? (100 - (bytesAfter / bytesBefore) * 100).toFixed(1) : "0";
  console.log("");
  console.log(`${DRY_RUN ? "[dry-run] " : ""}Đã xử lý: ${converted} | Bỏ qua: ${skipped} | Lỗi: ${failed}`);
  console.log(
    `Dung lượng lưới chọn khung: ${(bytesBefore / 1024 / 1024).toFixed(2)} MB -> ${(bytesAfter / 1024 / 1024).toFixed(2)} MB (-${savedPct}%)`
  );
  process.exitCode = failed ? 1 : 0;
}
