/**
 * Tải toàn bộ object trong Supabase Storage về máy, trước khi xoá.
 *
 *   node --env-file=.env.local scripts/backup-supabase-storage.mjs [--out <thư mục>]
 *
 * Mặc định lưu vào  E:/decoco-backup-supabase-storage-<YYYYMMDD>/<bucket>/<path>
 * (ngoài repo, để không lọt vào git).
 *
 * Mỗi file được ghi kèm manifest.json chứa đường dẫn, kích thước và SHA-256 để
 * sau này còn đối chiếu được. Chạy lại sẽ bỏ qua file đã tải đúng kích thước.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const BUCKETS = ["site", "products", "frames", "designs"];
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !KEY) throw new Error("Thiếu biến Supabase trong .env.local");

const outFlag = process.argv.indexOf("--out");
const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
const OUT = outFlag !== -1 ? process.argv[outFlag + 1] : `E:/decoco-backup-supabase-storage-${stamp}`;

const supabase = createClient(SUPABASE_URL, KEY, { auth: { persistSession: false } });

async function listBucket(bucket, prefix = "") {
  const out = [];
  for (let offset = 0; ; offset += 100) {
    const { data, error } = await supabase.storage
      .from(bucket)
      .list(prefix, { limit: 100, offset, sortBy: { column: "name", order: "asc" } });
    if (error) throw new Error(`list ${bucket}/${prefix}: ${error.message}`);
    if (!data?.length) break;
    for (const entry of data) {
      const p = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.id === null) out.push(...(await listBucket(bucket, p)));
      else out.push({ bucket, path: p, size: entry.metadata?.size ?? null });
    }
    if (data.length < 100) break;
  }
  return out;
}

console.log(`Thư mục đích: ${OUT}\n`);
fs.mkdirSync(OUT, { recursive: true });

const objects = [];
for (const b of BUCKETS) {
  const list = await listBucket(b);
  console.log(`  ${b.padEnd(9)} ${String(list.length).padStart(4)} object`);
  objects.push(...list);
}
const totalBytes = objects.reduce((s, o) => s + (o.size ?? 0), 0);
console.log(`  ${"TỔNG".padEnd(9)} ${String(objects.length).padStart(4)} object, ${(totalBytes / 1048576).toFixed(1)} MB\n`);

const manifest = [];
let done = 0, skipped = 0, failed = 0;

for (const obj of objects) {
  const dest = path.join(OUT, obj.bucket, ...obj.path.split("/"));
  fs.mkdirSync(path.dirname(dest), { recursive: true });

  if (fs.existsSync(dest) && obj.size !== null && fs.statSync(dest).size === obj.size) {
    const buf = fs.readFileSync(dest);
    manifest.push({ bucket: obj.bucket, path: obj.path, bytes: buf.length, sha256: crypto.createHash("sha256").update(buf).digest("hex") });
    skipped++;
    continue;
  }

  const { data, error } = await supabase.storage.from(obj.bucket).download(obj.path);
  if (error || !data) {
    console.error(`  LỖI ${obj.bucket}/${obj.path}: ${error?.message ?? "không có dữ liệu"}`);
    failed++;
    continue;
  }
  const buf = Buffer.from(await data.arrayBuffer());
  fs.writeFileSync(dest, buf);
  manifest.push({ bucket: obj.bucket, path: obj.path, bytes: buf.length, sha256: crypto.createHash("sha256").update(buf).digest("hex") });
  done++;
  if ((done + skipped) % 25 === 0) console.log(`  ... ${done + skipped}/${objects.length}`);
}

fs.writeFileSync(path.join(OUT, "manifest.json"), JSON.stringify({
  takenAt: new Date().toISOString(),
  source: SUPABASE_URL,
  buckets: BUCKETS,
  objectCount: manifest.length,
  totalBytes: manifest.reduce((s, m) => s + m.bytes, 0),
  objects: manifest,
}, null, 2));

const savedBytes = manifest.reduce((s, m) => s + m.bytes, 0);
console.log(`\n==================== KẾT QUẢ ====================`);
console.log(`Tải mới   : ${done}`);
console.log(`Bỏ qua    : ${skipped} (đã có sẵn, đúng kích thước)`);
console.log(`Lỗi       : ${failed}`);
console.log(`Tổng lưu  : ${manifest.length} file, ${(savedBytes / 1048576).toFixed(1)} MB`);
console.log(`Manifest  : ${path.join(OUT, "manifest.json")}`);
console.log(failed === 0 && manifest.length === objects.length ? "=> BACKUP ĐẦY ĐỦ" : "=> BACKUP CHƯA ĐỦ, xem lỗi ở trên");
process.exit(failed === 0 && manifest.length === objects.length ? 0 : 1);
