const CACHE_ONE_YEAR = "public, max-age=31536000, immutable";

export async function GET(
  _request: Request,
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
  if (!/^image\/(avif|gif|jpeg|png|webp)(?:;|$)/i.test(contentType)) {
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
  headers.set("Content-Type", contentType);

  return new Response(upstream.body, { status: 200, headers });
}
