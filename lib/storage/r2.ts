import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

const R2_ENV_KEYS = ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET", "R2_PUBLIC_BASE_URL"] as const;
export const STORAGE_BUCKETS = ["site", "products", "frames", "designs"] as const;

let client: S3Client | undefined;

export function isR2Configured(): boolean {
  const configured = R2_ENV_KEYS.filter((key) => process.env[key]?.trim());
  if (!configured.length) return false;
  if (configured.length !== R2_ENV_KEYS.length) {
    throw new Error(`Missing R2 configuration: ${R2_ENV_KEYS.filter((key) => !process.env[key]?.trim()).join(", ")}`);
  }
  return true;
}

export function getR2Client(): S3Client {
  if (!isR2Configured()) throw new Error("R2 is not configured");
  client ??= new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
  return client;
}

export function getStorageKey(bucket: string, path: string): string {
  if (!(STORAGE_BUCKETS as readonly string[]).includes(bucket) ||
      path.split("/").some((segment) => !segment || segment === "." || segment === ".." || /[\\\x00-\x1f]/.test(segment))) {
    throw new Error("Invalid storage path");
  }
  return `${bucket}/${path}`;
}

export async function uploadR2Image(bucket: string, path: string, body: Uint8Array, contentType: string): Promise<string> {
  const key = getStorageKey(bucket, path);
  await getR2Client().send(new PutObjectCommand({
    Bucket: process.env.R2_BUCKET!,
    Key: key,
    Body: body,
    ContentType: contentType,
    CacheControl: "public, max-age=31536000, immutable",
  }));
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || "https://trangsucdecoco.vn";
  return new URL(`/media/${key.split("/").map(encodeURIComponent).join("/")}`, siteUrl).href;
}
