import assert from "node:assert/strict";
import { GET } from "../app/media/[...path]/route.ts";
import { getCachedStorageUrl, getResizedStorageUrl } from "../lib/supabase/storage-url.ts";
import { getStorageKey, isR2Configured } from "../lib/storage/r2.ts";
import { listStorageObjects, matchesSource } from "./lib/storage-migration.mjs";

const previousEnv = { ...process.env };
const previousFetch = globalThis.fetch;
const context = { params: Promise.resolve({ path: ["products", "photo.webp"] }) };
const call = () => GET(new Request("https://trangsucdecoco.vn/media/products/photo.webp"), context);
try {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.NEXT_PUBLIC_SITE_URL = "https://trangsucdecoco.vn";
  process.env.R2_PUBLIC_BASE_URL = "https://cdn.trangsucdecoco.vn";
  process.env.R2_SUPABASE_FALLBACK = "true";
  let calls = [];
  globalThis.fetch = async (url) => {
    calls.push(url);
    return new Response("r2-image", { headers: { "content-type": "image/webp" } });
  };
  const r2 = await call();
  assert.equal(await r2.text(), "r2-image");
  assert.equal(r2.headers.get("X-Media-Source"), "r2");
  assert.deepEqual(calls, ["https://cdn.trangsucdecoco.vn/products/photo.webp"]);

  calls = [];
  globalThis.fetch = async (url) => {
    calls.push(url);
    return url.startsWith(process.env.R2_PUBLIC_BASE_URL)
      ? new Response("missing", { status: 404 })
      : new Response("legacy-image", { headers: { "content-type": "image/webp" } });
  };
  const legacy = await call();
  assert.equal(await legacy.text(), "legacy-image");
  assert.equal(legacy.headers.get("X-Media-Source"), "supabase");
  assert.equal(calls.length, 2);

  process.env.R2_SUPABASE_FALLBACK = "false";
  calls = [];
  assert.equal((await call()).status, 404);
  assert.equal(calls.length, 1);
  delete process.env.R2_PUBLIC_BASE_URL;
  calls = [];
  assert.equal((await call()).status, 503);
  assert.equal(calls.length, 0);

  process.env.R2_PUBLIC_BASE_URL = "https://cdn.trangsucdecoco.vn";
  process.env.R2_SUPABASE_FALLBACK = "true";
  calls = [];
  globalThis.fetch = async (url) => { calls.push(url); return new Response("broken", { status: 503 }); };
  const broken = await call();
  assert.equal(broken.status, 503);
  assert.equal(broken.headers.get("Cache-Control"), "no-store");
  assert.equal(calls.length, 1);

  for (const path of [["unknown", "photo.webp"], ["products", ".."], ["products", "a/b"]]) {
    const response = await GET(new Request("https://trangsucdecoco.vn/media/test"), { params: Promise.resolve({ path }) });
    assert.equal(response.status, 400);
  }
  assert.equal(getCachedStorageUrl("https://trangsucdecoco.vn/media/designs/orders/photo.jpg"), "/media/designs/orders/photo.jpg");
  assert.equal(getResizedStorageUrl("https://trangsucdecoco.vn/media/designs/orders/photo.jpg", 640), "/media/designs/orders/photo.jpg?w=640");
  assert.equal(getResizedStorageUrl("/media/products/photo.webp?w=320", 640), "/media/products/photo.webp?w=640");
  assert.equal(getStorageKey("designs", "orders/photo.jpg"), "designs/orders/photo.jpg");
  assert.throws(() => getStorageKey("designs", "../photo.jpg"));
  assert.throws(() => getStorageKey("other", "photo.jpg"));
  for (const key of ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET", "R2_PUBLIC_BASE_URL"]) delete process.env[key];
  assert.equal(isR2Configured(), false);
  process.env.R2_BUCKET = "decoco";
  assert.throws(isR2Configured, /Missing R2 configuration/);
} finally {
  globalThis.fetch = previousFetch;
  for (const key of Object.keys(process.env)) if (!(key in previousEnv)) delete process.env[key];
  Object.assign(process.env, previousEnv);
}

const object = { id: "id-1", name: "photo.webp", updated_at: "2026-10-12", metadata: { size: 123, mimetype: "image/webp" } };
const listCalls = [];
const storage = { from: () => ({ list: async (prefix, { offset }) => {
  listCalls.push([prefix, offset]);
  const entries = prefix === "" ? [{ name: "nested", id: null, metadata: null }, object] : [object];
  return { data: entries.slice(offset, offset + 1), error: null };
} }) };
const inventory = await listStorageObjects(storage, "products", "", 1);
assert.deepEqual(inventory.map((entry) => entry.path), ["nested/photo.webp", "photo.webp"]);
assert.deepEqual(listCalls, [["", 0], ["nested", 0], ["nested", 1], ["", 1], ["", 2]]);
const destination = { ContentLength: 123, Metadata: { "supabase-id": "id-1", "supabase-updated-at": "2026-10-12", sha256: "a".repeat(64) } };
assert.ok(matchesSource(inventory[0], destination));
assert.ok(!matchesSource(inventory[0], { ...destination, ContentLength: 124 }));
assert.ok(!matchesSource(inventory[0], { ...destination, Metadata: {} }));
await assert.rejects(listStorageObjects({ from: () => ({ list: async () => ({ error: { message: "denied" } }) }) }, "products"), /denied/);
console.log("PASS: R2 reads, fallback, cutover, safe paths, media URLs, recursive inventory and resumable verification.");
