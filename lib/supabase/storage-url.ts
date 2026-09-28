const PUBLIC_STORAGE_PREFIX = "/storage/v1/object/public/";

/** Route public Supabase Storage images through the site's CDN cache. */
export function getCachedStorageUrl(
  source: string,
  supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
): string {
  if (!supabaseUrl) return source;

  try {
    const sourceUrl = new URL(source);
    const projectUrl = new URL(supabaseUrl);

    if (
      sourceUrl.origin !== projectUrl.origin ||
      !sourceUrl.pathname.startsWith(PUBLIC_STORAGE_PREFIX) ||
      sourceUrl.search
    ) {
      return source;
    }

    const objectPath = sourceUrl.pathname.slice(PUBLIC_STORAGE_PREFIX.length);
    return objectPath ? `/media/${objectPath}` : source;
  } catch {
    return source;
  }
}
