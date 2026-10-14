/**
 * Kiểm tra xem đã an toàn để tắt fallback Supabase Storage chưa
 * (Giai đoạn 3 của KE_HOACH_R2.md).
 *
 *   node --env-file=.env.local scripts/check-r2-cutover-ready.mjs
 *
 * Sau khi đặt R2_SUPABASE_FALLBACK=false, mọi object KHÔNG có trong R2 sẽ trả
 * 404 vĩnh viễn. Script này tìm trước những object đó, theo 2 chiều:
 *
 *   A. Mọi object đang nằm trong 4 bucket Supabase -> có trong R2 chưa?
 *      (bắt những file được thêm vào Supabase SAU lần migrate)
 *   B. Mọi URL ảnh đang được database tham chiếu -> có trong R2 chưa?
 *      (bắt những ảnh được tham chiếu nhưng thiếu ở cả hai nơi)
 *
 * Kiểm tra trực tiếp trên `cdn.trangsucdecoco.vn` (domain của chính R2) chứ
 * không qua `/media`, để không bị cache CDN của Vercel đánh lừa.
 */
import { createClient } from "@supabase/supabase-js";

const BUCKETS = ["site", "products", "frames", "designs"];
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const R2_BASE = (process.env.R2_PUBLIC_BASE_URL ?? "").replace(/\/+$/, "");
const PUBLIC_PREFIX = "/storage/v1/object/public/";

if (!SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error("Thiếu biến Supabase");
if (!R2_BASE) throw new Error("Thiếu R2_PUBLIC_BASE_URL");

const supabase = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

/** Liệt kê đệ quy mọi object của một bucket (API trả theo trang, có thư mục con). */
async function listBucket(bucket, prefix = "") {
  const out = [];
  for (let offset = 0; ; offset += 100) {
    const { data, error } = await supabase.storage
      .from(bucket)
      .list(prefix, { limit: 100, offset, sortBy: { column: "name", order: "asc" } });
    if (error) throw new Error(`list ${bucket}/${prefix}: ${error.message}`);
    if (!data?.length) break;
    for (const entry of data) {
      const path = prefix ? `${prefix}/${entry.name}` : entry.name;
      // Thư mục không có id; đệ quy xuống.
      if (entry.id === null) out.push(...(await listBucket(bucket, path)));
      else out.push(`${bucket}/${path}`);
    }
    if (data.length < 100) break;
  }
  return out;
}

/** Đổi một URL Supabase public (hoặc /media/...) thành storage key. null nếu không phải. */
function toKey(value) {
  if (typeof value !== "string" || !value) return null;
  if (value.startsWith("/media/")) return value.slice("/media/".length).split("?")[0];
  try {
    const u = new URL(value);
    if (u.pathname.startsWith("/media/")) return u.pathname.slice("/media/".length);
    if (u.origin === new URL(SUPABASE_URL).origin && u.pathname.startsWith(PUBLIC_PREFIX)) {
      return u.pathname.slice(PUBLIC_PREFIX.length);
    }
    if (R2_BASE && u.origin === new URL(R2_BASE).origin) return u.pathname.replace(/^\/+/, "");
  } catch { /* không phải URL tuyệt đối */ }
  return null;
}

/**
 * Mặc định hỏi thẳng R2 (dùng TRƯỚC khi cắt, để biết có an toàn không).
 * Với `--via-media`, hỏi qua route /media của site (dùng SAU khi cắt, để chứng
 * minh người dùng thật vẫn tải được ảnh và không rơi về Supabase nữa).
 */
const VIA_MEDIA = process.argv.includes("--via-media");
const SITE = (process.env.CHECK_SITE ?? "https://trangsucdecoco.vn").replace(/\/+$/, "");
const TARGET = VIA_MEDIA ? `${SITE}/media` : R2_BASE;

async function existsInR2(key) {
  const url = `${TARGET}/${key.split("/").map(encodeURIComponent).join("/")}`;
  try {
    const r = await fetch(url, { method: "HEAD", cache: "no-store" });
    if (!VIA_MEDIA) return r.status;
    // Sau khi cắt fallback, bất kỳ "supabase" nào cũng là lỗi.
    const src = r.headers.get("x-media-source");
    return r.status === 200 && src !== "r2" ? `200 nhưng X-Media-Source=${src}` : r.status;
  } catch (e) {
    return `ERR ${e.message}`;
  }
}

/** Chạy n việc song song có giới hạn, để không nã hàng trăm request cùng lúc. */
async function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (i < items.length) {
        const idx = i++;
        results[idx] = await fn(items[idx], idx);
      }
    })
  );
  return results;
}

// ---------------------------------------------------------------- A
console.log("A. Object đang nằm trong Supabase Storage\n");
const supabaseKeys = [];
for (const b of BUCKETS) {
  const keys = await listBucket(b);
  console.log(`   ${b.padEnd(9)} ${String(keys.length).padStart(4)} object`);
  supabaseKeys.push(...keys);
}
console.log(`   ${"TỔNG".padEnd(9)} ${String(supabaseKeys.length).padStart(4)} object\n`);

// ---------------------------------------------------------------- B
console.log("B. Ảnh được database tham chiếu\n");
const referenced = new Map(); // key -> nguồn tham chiếu (để báo lỗi cho rõ)
function note(key, where) {
  if (key && !referenced.has(key)) referenced.set(key, where);
}

const { data: products } = await supabase.from("products").select("slug, images, variants");
for (const p of products ?? []) {
  for (const img of p.images ?? []) note(toKey(img), `products.images (${p.slug})`);
  for (const v of p.variants ?? []) note(toKey(v.image_url), `products.variants (${p.slug} / ${v.name})`);
}
const { data: frames } = await supabase.from("frames").select("name, thumbnail_url, config");
for (const f of frames ?? []) {
  note(toKey(f.thumbnail_url), `frames.thumbnail_url (${f.name})`);
  note(toKey(f.config?.backgroundImage), `frames.config.backgroundImage (${f.name})`);
}
const { data: feedback } = await supabase.from("feedback_items").select("id, image_url");
for (const f of feedback ?? []) note(toKey(f.image_url), `feedback_items (${f.id})`);
const { data: content } = await supabase.from("site_content").select("key, value");
for (const c of content ?? []) note(toKey(c.value), `site_content (${c.key})`);
const { data: orders } = await supabase
  .from("orders")
  .select("order_number, design_image_url")
  .not("design_image_url", "is", null);
for (const o of orders ?? []) note(toKey(o.design_image_url), `orders (${o.order_number})`);

console.log(`   ${referenced.size} key duy nhất được tham chiếu từ database\n`);

// ---------------------------------------------------------------- Đối chiếu
const allKeys = [...new Set([...supabaseKeys, ...referenced.keys()])];
console.log(`Đang kiểm tra ${allKeys.length} key trên ${TARGET} ...`);
console.log(VIA_MEDIA
  ? "   (chế độ --via-media: qua route /media của site, đòi X-Media-Source=r2)\n"
  : "   (hỏi thẳng R2, bỏ qua cache CDN của Vercel)\n");

const statuses = await mapLimit(allKeys, 12, existsInR2);
const missing = allKeys.filter((_, i) => statuses[i] !== 200);

const onlyInSupabase = supabaseKeys.filter((k) => missing.includes(k));
const referencedMissing = [...referenced.keys()].filter((k) => missing.includes(k));

console.log("==================== KẾT QUẢ ====================");
console.log(`Key đã kiểm tra        : ${allKeys.length}`);
console.log(`Có trong R2            : ${allKeys.length - missing.length}`);
console.log(`THIẾU trong R2         : ${missing.length}`);

if (missing.length) {
  console.log("\nCác key sẽ hỏng khi tắt fallback:");
  for (const k of missing) {
    const i = allKeys.indexOf(k);
    const where = referenced.get(k);
    console.log(`  [${statuses[i]}] ${k}${where ? `  <- ${where}` : "  <- chỉ có trong Supabase Storage"}`);
  }
  console.log(`\n  ${onlyInSupabase.length} object chỉ tồn tại trong Supabase Storage`);
  console.log(`  ${referencedMissing.length} key được database tham chiếu nhưng R2 không có`);
  console.log("\n=> CHƯA an toàn để đặt R2_SUPABASE_FALLBACK=false");
  process.exit(1);
}

console.log("\n=> AN TOÀN để đặt R2_SUPABASE_FALLBACK=false");
console.log("   Mọi object trong Supabase Storage và mọi ảnh database tham chiếu đều đã có trong R2.");
