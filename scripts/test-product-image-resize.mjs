// Ảnh sản phẩm phải được phục vụ ở kích thước hiển thị, không phải kích thước gốc
// (BUG_REPORT.md — phần 3).
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import sharp from "sharp";
import {
  MEDIA_WIDTHS,
  getCachedStorageUrl,
  getResizedStorageUrl,
  isMediaWidth,
} from "../lib/supabase/storage-url.ts";
import { GET } from "../app/media/[...path]/route.ts";

const projectUrl = "https://project-ref.supabase.co";
const publicImage = `${projectUrl}/storage/v1/object/public/products/example.png`;

// 1. Dựng URL
assert.equal(
  getResizedStorageUrl(publicImage, 640, projectUrl),
  "/media/products/example.png?w=640",
  "product images must request a display-sized render"
);
assert.equal(
  getCachedStorageUrl(publicImage, projectUrl),
  "/media/products/example.png",
  "the unresized helper must keep its original behaviour"
);
assert.equal(
  getResizedStorageUrl("https://images.example.com/a.png", 640, projectUrl),
  "https://images.example.com/a.png",
  "third-party URLs cannot be resized and must be left untouched"
);
assert.ok(isMediaWidth(640) && !isMediaWidth(641), "only whitelisted widths are accepted");

// 2. Route thực sự thu nhỏ ảnh
const original = await sharp({
  create: { width: 2000, height: 2000, channels: 3, background: "#b3123c" },
})
  .png()
  .toBuffer();

const previousUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const previousFetch = globalThis.fetch;
process.env.NEXT_PUBLIC_SUPABASE_URL = projectUrl;

const context = { params: Promise.resolve({ path: ["products", "example.png"] }) };
const call = (search = "") =>
  GET(new Request(`https://trangsucdecoco.vn/media/products/example.png${search}`), context);

let upstreamCalls = 0;
try {
  globalThis.fetch = async () => {
    upstreamCalls++;
    return new Response(new Uint8Array(original), {
      status: 200,
      headers: { "Content-Type": "image/png" },
    });
  };

  const resized = await call("?w=640");
  assert.equal(resized.status, 200);
  assert.equal(resized.headers.get("Content-Type"), "image/webp");
  assert.match(resized.headers.get("Vercel-CDN-Cache-Control"), /max-age=31536000/);
  const resizedBody = Buffer.from(await resized.arrayBuffer());
  const meta = await sharp(resizedBody).metadata();
  assert.equal(meta.width, 640, "the route must honour the requested width");
  assert.ok(
    resizedBody.length < original.length / 5,
    `resized bytes must be far below the original (${resizedBody.length} vs ${original.length})`
  );

  // Không có ?w= -> hành vi cũ, phục vụ nguyên bản.
  const untouched = await call();
  assert.equal(untouched.headers.get("Content-Type"), "image/png");
  assert.equal((await untouched.arrayBuffer()).byteLength, original.length);

  // Ảnh nhỏ hơn mức yêu cầu không bị phóng to.
  const small = await sharp({
    create: { width: 100, height: 100, channels: 3, background: "#ffffff" },
  })
    .png()
    .toBuffer();
  globalThis.fetch = async () =>
    new Response(new Uint8Array(small), { status: 200, headers: { "Content-Type": "image/png" } });
  const smallMeta = await sharp(Buffer.from(await (await call("?w=1024")).arrayBuffer())).metadata();
  assert.equal(smallMeta.width, 100, "small images must not be enlarged");

  // GIF động giữ nguyên bản để không mất animation.
  globalThis.fetch = async () =>
    new Response("gif-bytes", { status: 200, headers: { "Content-Type": "image/gif" } });
  const gif = await call("?w=640");
  assert.equal(gif.status, 200);
  assert.equal(gif.headers.get("Content-Type"), "image/gif");
  assert.equal(await gif.text(), "gif-bytes");

  // Chiều rộng lạ bị từ chối TRƯỚC khi gọi upstream -> không khuếch đại egress,
  // không sinh cache key mới.
  const callsBeforeAbuse = upstreamCalls;
  for (const bad of ["641", "0", "-200", "99999", "abc", "640.5"]) {
    const rejected = await call(`?w=${bad}`);
    assert.equal(rejected.status, 400, `w=${bad} must be rejected`);
    assert.equal(rejected.headers.get("Cache-Control"), "no-store");
  }
  assert.equal(upstreamCalls, callsBeforeAbuse, "a rejected width must not hit Supabase at all");
} finally {
  globalThis.fetch = previousFetch;
  if (previousUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  else process.env.NEXT_PUBLIC_SUPABASE_URL = previousUrl;
}

// 3. Các điểm hiển thị ảnh sản phẩm phải khai báo chiều rộng.
const sized = [
  ["components/ui/ProductCard.tsx", /cdnWidth=\{640\}/],
  ["components/ui/ImageSlider.tsx", /cdnWidth=\{1024\}/],
  ["components/ui/ImageSlider.tsx", /cdnWidth=\{160\}/],
  ["app/(site)/san-pham/[slug]/ProductInteractive.tsx", /cdnWidth=\{160\}/],
  ["app/admin/san-pham/page.tsx", /getResizedStorageUrl\(img, 160\)/],
  ["app/admin/san-pham/ProductEditDialog.tsx", /cdnWidth=\{320\}/],
  ["components/admin/ImageUploadField.tsx", /cdnWidth=\{640\}/],
  // Hero là ảnh LCP: bản mobile nhỏ hơn bản desktop để tiết kiệm data.
  ["components/sections/HeroSection.tsx", /getResizedStorageUrl\(mobileSrc, 1024\)/],
  ["components/sections/HeroSection.tsx", /getResizedStorageUrl\(desktopSrc, 1600\)/],
  ["components/sections/StorySection.tsx", /getResizedStorageUrl\(storyImage, 1024\)/],
  ["components/ui/FeedbackCarousel.tsx", /getResizedStorageUrl\(item\.image_url, 640\)/],
  ["app/(site)/dat-hang/page.tsx", /getResizedStorageUrl\(designInfo\.designImageUrl, 640\)/],
  ["app/admin/don-hang/OrderDetailDialog.tsx", /getResizedStorageUrl\(order\.design_image_url, 640\)/],
  ["app/admin/noi-dung/page.tsx", /getResizedStorageUrl\(draft\.image_url, 320\)/],
];
for (const [file, pattern] of sized) {
  const source = await readFile(new URL(`../${file}`, import.meta.url), "utf8");
  assert.match(source, pattern, `${file} must request a display-sized image`);
}

// 4. Canvas thiết kế PHẢI nạp ảnh nền gốc — bản thu nhỏ sẽ làm hỏng chất lượng in.
const canvasSource = await readFile(
  new URL("../components/DesignTool/DesignToolCanvas.tsx", import.meta.url),
  "utf8"
);
assert.match(
  canvasSource,
  /FabricImage\.fromURL\(getCachedStorageUrl\(config\.backgroundImage\)/,
  "the design canvas must keep loading the full-resolution background"
);
assert.doesNotMatch(
  canvasSource,
  /getResizedStorageUrl/,
  "the design canvas must never request a downscaled background"
);

console.log(`PASS: /media?w= resizes to WebP; widths whitelisted to ${MEDIA_WIDTHS.join(", ")}.`);
console.log("PASS: no ?w= keeps the original passthrough; GIFs are never re-encoded.");
console.log("PASS: small images are not enlarged.");
console.log("PASS: an unknown width is rejected before any Supabase request.");
console.log("PASS: every display render site asks for a display-sized image.");
console.log("PASS: the design canvas still loads the full-resolution background.");
