import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { getCachedStorageUrl } from "../lib/supabase/storage-url.ts";
import { GET } from "../app/media/[...path]/route.ts";

const projectUrl = "https://project-ref.supabase.co";
const publicImage = `${projectUrl}/storage/v1/object/public/products/example.webp`;

assert.equal(
  getCachedStorageUrl(publicImage, projectUrl),
  "/media/products/example.webp",
  "public Supabase Storage URLs must use the site CDN route"
);
assert.equal(
  getCachedStorageUrl("https://images.example.com/example.webp", projectUrl),
  "https://images.example.com/example.webp",
  "third-party URLs must not be proxied"
);
assert.equal(
  getCachedStorageUrl(`${projectUrl}/auth/v1/user`, projectUrl),
  `${projectUrl}/auth/v1/user`,
  "non-storage Supabase URLs must not be proxied"
);
assert.equal(
  getCachedStorageUrl(`${publicImage}?download=1`, projectUrl),
  `${publicImage}?download=1`,
  "URLs with query parameters must retain their existing behavior"
);

const previousUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const previousFetch = globalThis.fetch;
process.env.NEXT_PUBLIC_SUPABASE_URL = projectUrl;
let upstreamCalls = 0;
globalThis.fetch = async (url, options) => {
  upstreamCalls++;
  assert.equal(url, publicImage);
  assert.equal(options.cache, "no-store");
  return new Response("image-bytes", {
    status: 200,
    headers: { "Content-Type": "image/webp" },
  });
};

try {
  const context = { params: Promise.resolve({ path: ["products", "example.webp"] }) };
  const imageResponse = await GET(new Request("https://trangsucdecoco.vn/media/products/example.webp"), context);
  assert.equal(imageResponse.status, 200);
  assert.equal(await imageResponse.text(), "image-bytes");
  assert.match(imageResponse.headers.get("Vercel-CDN-Cache-Control"), /max-age=31536000/);
  assert.match(imageResponse.headers.get("Cache-Control"), /max-age=31536000/);
  assert.equal(upstreamCalls, 1);

  globalThis.fetch = async () => new Response("quota exceeded", { status: 402 });
  const errorResponse = await GET(new Request("https://trangsucdecoco.vn/media/products/example.webp"), context);
  assert.equal(errorResponse.status, 402);
  assert.equal(errorResponse.headers.get("Cache-Control"), "no-store");

  globalThis.fetch = async () => new Response("<script>alert(1)</script>", {
    status: 200,
    headers: { "Content-Type": "text/html" },
  });
  const unsafeResponse = await GET(new Request("https://trangsucdecoco.vn/media/products/example.webp"), context);
  assert.equal(unsafeResponse.status, 502);
  assert.equal(unsafeResponse.headers.get("Cache-Control"), "no-store");
} finally {
  globalThis.fetch = previousFetch;
  if (previousUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  else process.env.NEXT_PUBLIC_SUPABASE_URL = previousUrl;
}

const routeSource = await readFile(
  new URL("../app/media/[...path]/route.ts", import.meta.url),
  "utf8"
);
assert.match(routeSource, /Vercel-CDN-Cache-Control/);
assert.match(routeSource, /max-age=31536000/);
assert.match(routeSource, /cache: "no-store"/);

const uploadSource = await readFile(
  new URL("../app/api/admin/upload/route.ts", import.meta.url),
  "utf8"
);
assert.match(uploadSource, /cacheControl: "31536000"/);

console.log("PASS: Supabase images are routed through the site CDN cache.");
console.log("PASS: CDN/browser cache TTL is one year for immutable image paths.");
console.log("PASS: New Supabase uploads use a one-year browser cache TTL.");
console.log("PASS: Upstream errors and non-image responses are not cached.");
