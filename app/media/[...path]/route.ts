import sharp from "sharp";
import { isMediaWidth } from "@/lib/supabase/storage-url";

const CACHE_ONE_YEAR = "public, max-age=31536000, immutable";

/** GIF động sẽ mất animation nếu đi qua sharp -> phục vụ nguyên bản. */
const RESIZABLE_TYPES = /^image\/(avif|jpeg|png|webp)(?:;|$)/i;
const SERVABLE_TYPES = /^image\/(avif|gif|jpeg|png|webp)(?:;|$)/i;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) {
    return new Response("Storage is not configured", { status: 503 });
  }

  const { path } = await params;
  if (!path.length || path.some((segment) => !segment || segment === "." || segment === "..")) {
    return new Response("Invalid storage path", { status: 400 });
  }

  // Chốt chặn chiều rộng TRƯỚC khi gọi upstream: một `w` lạ không được phép tạo
  // thêm một lượt tải ảnh gốc từ Supabase, cũng không được tạo cache key mới.
  const requestedWidth = new URL(request.url).searchParams.get("w");
  let width: number | null = null;
  if (requestedWidth !== null) {
    const parsed = Number(requestedWidth);
    if (!Number.isInteger(parsed) || !isMediaWidth(parsed)) {
      return new Response("Unsupported width", {
        status: 400,
        headers: { "Cache-Control": "no-store" },
      });
    }
    width = parsed;
  }

  const objectPath = path.map(encodeURIComponent).join("/");
  const upstream = await fetch(
    `${supabaseUrl}/storage/v1/object/public/${objectPath}`,
    { cache: "no-store" }
  );

  if (!upstream.ok || !upstream.body) {
    return new Response("Image unavailable", {
      status: upstream.status,
      headers: { "Cache-Control": "no-store" },
    });
  }

  const contentType = upstream.headers.get("content-type") ?? "";
  if (!SERVABLE_TYPES.test(contentType)) {
    await upstream.body.cancel();
    return new Response("Unsupported image type", {
      status: 502,
      headers: { "Cache-Control": "no-store" },
    });
  }

  const headers = new Headers({
    "Cache-Control": CACHE_ONE_YEAR,
    "CDN-Cache-Control": CACHE_ONE_YEAR,
    "Vercel-CDN-Cache-Control": CACHE_ONE_YEAR,
    "X-Content-Type-Options": "nosniff",
  });

  if (width && RESIZABLE_TYPES.test(contentType)) {
    try {
      const original = Buffer.from(await upstream.arrayBuffer());
      const resized = await sharp(original)
        .rotate()
        .resize({ width, withoutEnlargement: true, fit: "inside" })
        .webp({ quality: 75 })
        .toBuffer();
      headers.set("Content-Type", "image/webp");
      return new Response(new Uint8Array(resized), { status: 200, headers });
    } catch (error) {
      // Fail-soft: ảnh hỏng/định dạng lạ thì vẫn phục vụ được bản gốc.
      console.warn("Media resize failed, serving the original:", error);
      const fallback = await fetch(
        `${supabaseUrl}/storage/v1/object/public/${objectPath}`,
        { cache: "no-store" }
      );
      if (!fallback.ok || !fallback.body) {
        return new Response("Image unavailable", {
          status: fallback.status,
          headers: { "Cache-Control": "no-store" },
        });
      }
      headers.set("Content-Type", contentType);
      return new Response(fallback.body, { status: 200, headers });
    }
  }

  headers.set("Content-Type", contentType);
  return new Response(upstream.body, { status: 200, headers });
}
