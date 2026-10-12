import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { HeadBucketCommand, HeadObjectCommand, ListObjectsV2Command, PutObjectCommand } from "@aws-sdk/client-s3";
import { getR2Client, getStorageKey, STORAGE_BUCKETS } from "../lib/storage/r2.ts";
import { listStorageObjects, matchesSource } from "./lib/storage-migration.mjs";

const flags = new Set(process.argv.slice(2));
const dryRun = flags.has("--dry-run");
const verifyOnly = flags.has("--verify-only");
if ([...flags].some((flag) => !["--dry-run", "--verify-only"].includes(flag)) || (dryRun && verifyOnly)) {
  throw new Error("Usage: node --env-file=.env.local scripts/migrate-storage-to-r2.mjs [--dry-run | --verify-only]");
}
if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Missing Supabase URL or service role key");
}

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const report = { startedAt: new Date().toISOString(), mode: dryRun ? "dry-run" : verifyOnly ? "verify" : "copy", buckets: {}, failures: [] };
const client = dryRun ? null : getR2Client();
const r2Bucket = process.env.R2_BUCKET;
if (client) await client.send(new HeadBucketCommand({ Bucket: r2Bucket }));

async function headObject(key) {
  try {
    return await client.send(new HeadObjectCommand({ Bucket: r2Bucket, Key: key }));
  } catch (error) {
    if (error.$metadata?.httpStatusCode === 404) return null;
    throw error;
  }
}

for (const bucket of STORAGE_BUCKETS) {
  const objects = await listStorageObjects(supabase.storage, bucket);
  const stats = { sourceObjects: objects.length, sourceBytes: objects.reduce((total, object) => total + object.size, 0), copied: 0, skipped: 0, verified: 0, failed: 0, r2Objects: null };
  report.buckets[bucket] = stats;
  console.log(`${bucket}: ${objects.length} objects, ${(stats.sourceBytes / 1024 / 1024).toFixed(2)} MB`);
  if (dryRun) continue;

  for (const object of objects) {
    const key = getStorageKey(bucket, object.path);
    try {
      const existing = await headObject(key);
      if (existing && matchesSource(object, existing)) {
        stats.skipped++;
        stats.verified++;
        continue;
      }
      if (verifyOnly) throw new Error(existing ? "Destination differs from source" : "Missing destination");
      if (existing) throw new Error("Destination exists but does not match; refusing to overwrite");

      const { data, error } = await supabase.storage.from(bucket).download(object.path);
      if (error) throw error;
      const body = Buffer.from(await data.arrayBuffer());
      if (body.length !== object.size) throw new Error("Source size changed during migration; rerun inventory");
      const sha256 = createHash("sha256").update(body).digest("hex");
      const uploaded = await client.send(new PutObjectCommand({
        Bucket: r2Bucket, Key: key, Body: body,
        ContentType: object.contentType || data.type || "application/octet-stream",
        ContentMD5: createHash("md5").update(body).digest("base64"),
        CacheControl: "public, max-age=31536000, immutable",
        IfNoneMatch: "*",
        Metadata: { "supabase-id": object.id, "supabase-updated-at": object.updatedAt, sha256 },
      }));
      const verified = await headObject(key);
      if (!verified || !matchesSource(object, verified) || verified.Metadata.sha256 !== sha256 || verified.ETag !== uploaded.ETag) {
        throw new Error("Destination verification failed");
      }
      stats.copied++;
      stats.verified++;
      console.log(`COPY ${key}`);
    } catch (error) {
      stats.failed++;
      report.failures.push({ key, error: error.message });
      console.error(`FAIL ${key}: ${error.message}`);
    }
  }

  let continuationToken;
  stats.r2Objects = 0;
  do {
    const page = await client.send(new ListObjectsV2Command({ Bucket: r2Bucket, Prefix: `${bucket}/`, ContinuationToken: continuationToken }));
    stats.r2Objects += page.Contents?.length ?? 0;
    continuationToken = page.IsTruncated ? page.NextContinuationToken : undefined;
    if (page.IsTruncated && !continuationToken) throw new Error("Missing R2 continuation token");
  } while (continuationToken);
}

report.finishedAt = new Date().toISOString();
await mkdir(".vercel", { recursive: true });
const reportPath = `.vercel/r2-migration-${report.mode}.json`;
await writeFile(reportPath, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report.buckets, null, 2));
console.log(`Report: ${reportPath}`);
process.exitCode = report.failures.length ? 1 : 0;
