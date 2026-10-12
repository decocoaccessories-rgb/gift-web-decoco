import { isMediaWidth } from "@/lib/supabase/storage-url";

const CACHE_ONE_YEAR = "public, max-age=31536000, immutable";
/** Dùng khi chưa resize được: đủ ngắn để tự phục hồi, đủ dài để không nã Supabase. */
const CACHE_FIVE_MINUTES = "public, max-age=300";

/** GIF động sẽ mất animation nếu đi qua sharp -> phục vụ nguyên bản. */
const RESIZABLE_TYPES = /^image\/(avif|jpeg|png|webp)(?:;|$)/i;
const SERVABLE_TYPES = /^image\/(avif|gif|jpeg|png|webp)(?:;|$)/i;

type SharpFactory = typeof import("sharp").default;
let sharpFactory: SharpFactory | null | undefined;

/**
 * Nạp sharp theo kiểu lazy. Import ở đầu file khiến cả route 500 nếu runtime
 * không nạp được native binary — tức là mất luôn đường phục vụ ảnh, kể cả
 * request không cần resize.
 */
async function loadSharp(): Promise<SharpFactory | null> {
  if (sharpFactory !== undefined) return sharpFactory;
  try {
    sharpFactory = (await import("sharp")).default;
  } catch (error) {
    console.error("sharp is unavailable, serving originals:", error);
    sharpFactory = null;
  }
  return sharpFactory;
}

function setCacheHeaders(headers: Headers, value: string) {
  headers.set("Cache-Control", value);
  headers.set("CDN-Cache-Control", value);
  headers.set("Vercel-CDN-Cache-Control", value);
}

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

  const headers = new Headers({ "X-Content-Type-Options": "nosniff" });
  setCacheHeaders(headers, CACHE_ONE_YEAR);

  if (width && RESIZABLE_TYPES.test(contentType)) {
    const original = Buffer.from(await upstream.arrayBuffer());
    const sharp = await loadSharp();

    if (sharp) {
      try {
        const resized = await sharp(original)
          .rotate()
          .resize({ width, withoutEnlargement: true, fit: "inside" })
          .webp({ quality: 75 })
          .toBuffer();
        headers.set("Content-Type", "image/webp");
        return new Response(new Uint8Array(resized), { status: 200, headers });
      } catch (error) {
        // Ảnh này không xử lý được -> phục vụ bản gốc, vẫn cache dài vì lần sau
        // cũng sẽ hỏng y hệt.
        console.warn("Media resize failed, serving the original:", error);
      }
    } else {
      // sharp hỏng là sự cố tạm thời của cả runtime -> cache ngắn để khi sửa
      // xong CDN không giữ bản gốc suốt một năm dưới cache key `?w=`.
      setCacheHeaders(headers, CACHE_FIVE_MINUTES);
    }

    headers.set("Content-Type", contentType);
    return new Response(new Uint8Array(original), { status: 200, headers });
  }

  headers.set("Content-Type", contentType);
  return new Response(upstream.body, { status: 200, headers });
}
