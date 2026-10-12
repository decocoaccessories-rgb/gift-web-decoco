const PUBLIC_STORAGE_PREFIX = "/storage/v1/object/public/";

/**
 * Các chiều rộng `/media?w=` được phép. Danh sách đóng để một người lạ không thể
 * sinh vô số cache key khác nhau, mỗi key kéo một lần ảnh gốc từ Supabase.
 */
export const MEDIA_WIDTHS = [160, 320, 640, 1024, 1600] as const;
export type MediaWidth = (typeof MEDIA_WIDTHS)[number];

export function isMediaWidth(value: number): value is MediaWidth {
  return (MEDIA_WIDTHS as readonly number[]).includes(value);
}

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

/**
 * Như `getCachedStorageUrl` nhưng xin thêm bản thu nhỏ `width` px.
 *
 * `images.unoptimized: true` (quota Vercel Image Optimization đã hết) khiến
 * `next/image` bỏ qua `sizes` và tải nguyên ảnh gốc vài MB kể cả khi chỉ hiển
 * thị ở 300px. `/media` tự resize rồi cache bản nhỏ trên CDN của site.
 *
 * URL ngoài project Supabase không đổi — ta không proxy được chúng.
 */
export function getResizedStorageUrl(
  source: string,
  width: MediaWidth,
  supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
): string {
  const cached = getCachedStorageUrl(source, supabaseUrl);
  if (!cached.startsWith("/media/")) return cached;
  return `${cached}?w=${width}`;
}
