import { createAdminClient } from "@/lib/supabase/server";
import { getStorageKey, isR2Configured, uploadR2Image } from "@/lib/storage/r2";

export async function uploadStorageImage(
  bucket: string,
  path: string,
  body: Uint8Array,
  contentType: string,
  upsert = false,
): Promise<string> {
  getStorageKey(bucket, path);
  if (isR2Configured()) return uploadR2Image(bucket, path, body, contentType);
  if (process.env.R2_SUPABASE_FALLBACK === "false") throw new Error("R2 is not configured");

  const supabase = createAdminClient();
  const { error } = await supabase.storage.from(bucket).upload(path, body, {
    contentType,
    cacheControl: "31536000",
    upsert,
  });
  if (error) throw error;
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}
