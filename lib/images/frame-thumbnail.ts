/** Chiều rộng ảnh thumbnail khung — đủ nét cho lưới chọn khung ~100-200px @2x. */
export const FRAME_THUMBNAIL_WIDTH = 400;
export const FRAME_THUMBNAIL_CONTENT_TYPE = "image/webp";

/**
 * Sinh thumbnail WebP nhỏ từ ảnh nền khung kích thước gốc.
 *
 * Ảnh nền khung là PNG gốc (canvas 1772x1535, cỡ MB). Lưới chọn khung chỉ hiển
 * thị ở ~100px nhưng `images.unoptimized: true` khiến trình duyệt tải nguyên file
 * gốc — nguồn cached egress lớn nhất của project (xem BUG_REPORT.md).
 */
export async function createFrameThumbnail(input: Buffer): Promise<Buffer> {
  // Import lazy: module này còn export hằng số dùng ở route upload, nạp sharp ở
  // đầu file sẽ làm cả route 500 nếu runtime không nạp được native binary.
  const { default: sharp } = await import("sharp");
  return sharp(input)
    .rotate()
    .resize({
      width: FRAME_THUMBNAIL_WIDTH,
      withoutEnlargement: true,
      fit: "inside",
    })
    .webp({ quality: 72 })
    .toBuffer();
}

/** `frames/1788000000000.png` -> `frames/1788000000000-thumb.webp` */
export function toThumbnailPath(objectPath: string): string {
  const dot = objectPath.lastIndexOf(".");
  const slash = objectPath.lastIndexOf("/");
  const base = dot > slash ? objectPath.slice(0, dot) : objectPath;
  return `${base}-thumb.webp`;
}
