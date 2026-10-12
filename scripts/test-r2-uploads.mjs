import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { S3Client } from "@aws-sdk/client-s3";
import sharp from "sharp";

globalThis.storageTestState = { authenticated: true, legacyWrites: 0 };
const serverStub = `
export async function createClient() { return { auth: { getUser: async () => ({ data: { user: globalThis.storageTestState.authenticated ? { id: 'admin' } : null } }) } }; }
export function createAdminClient() { return { storage: { from: bucket => ({ upload: async () => { globalThis.storageTestState.legacyWrites++; return { error: null }; }, getPublicUrl: path => ({ data: { publicUrl: 'https://example.supabase.co/storage/v1/object/public/' + bucket + '/' + path } }) }) } }; }
`;
registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier === "@/lib/supabase/server") return { url: `data:text/javascript,${encodeURIComponent(serverStub)}`, shortCircuit: true };
  if (specifier === "next/server") return nextResolve("next/server.js", context);
  return nextResolve(specifier, context);
} });
const { POST: upload } = await import("../app/api/admin/upload/route.ts");
const { POST: exportDesign } = await import("../app/api/design/export/route.ts");
const previousEnv = { ...process.env };
const previousSend = S3Client.prototype.send;
const writes = [];
try {
  Object.assign(process.env, {
    R2_ACCOUNT_ID: "account", R2_ACCESS_KEY_ID: "access", R2_SECRET_ACCESS_KEY: "secret",
    R2_BUCKET: "decoco", R2_PUBLIC_BASE_URL: "https://cdn.trangsucdecoco.vn",
    NEXT_PUBLIC_SITE_URL: "https://trangsucdecoco.vn",
  });
  S3Client.prototype.send = async function(command) { writes.push(command.input); return {}; };
  const source = await sharp({ create: { width: 800, height: 600, channels: 3, background: "#7a1f3a" } }).png().toBuffer();
  const formData = new FormData();
  formData.set("file", new File([source], "frame.png", { type: "image/png" }));
  formData.set("bucket", "frames");
  const response = await upload(new Request("https://trangsucdecoco.vn/api/admin/upload", { method: "POST", body: formData }));
  assert.equal(response.status, 200);
  const uploaded = await response.json();
  assert.match(uploaded.url, /^https:\/\/trangsucdecoco\.vn\/media\/frames\/\d+\.png$/);
  assert.match(uploaded.thumbnailUrl, /-thumb\.webp$/);
  assert.equal(writes.length, 2);
  assert.equal(writes[0].Bucket, "decoco");
  assert.equal(writes[0].ContentType, "image/png");
  assert.equal(writes[1].ContentType, "image/webp");
  assert.equal((await sharp(writes[1].Body).metadata()).width, 400);
  assert.equal(globalThis.storageTestState.legacyWrites, 0);

  const design = new FormData();
  design.set("file", new File([source], "design.png", { type: "image/png" }));
  const exported = await exportDesign(new Request("https://trangsucdecoco.vn/api/design/export", { method: "POST", body: design }));
  assert.equal(exported.status, 200);
  assert.match((await exported.json()).url, /\/media\/designs\/orders\//);
  assert.match(writes[2].Key, /^designs\/orders\//);

  globalThis.storageTestState.authenticated = false;
  assert.equal((await upload(new Request("https://trangsucdecoco.vn/api/admin/upload", { method: "POST", body: new FormData() }))).status, 401);
  assert.equal(writes.length, 3);

  S3Client.prototype.send = async function() { throw new Error("test R2 unavailable"); };
  const failing = await exportDesign(new Request("https://trangsucdecoco.vn/api/design/export", { method: "POST", body: design }));
  assert.equal(failing.status, 500);
  assert.deepEqual(await failing.json(), { error: "Upload failed" });
  assert.equal(globalThis.storageTestState.legacyWrites, 0);

  for (const key of ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET", "R2_PUBLIC_BASE_URL"]) delete process.env[key];
  process.env.R2_SUPABASE_FALLBACK = "true";
  const legacy = await exportDesign(new Request("https://trangsucdecoco.vn/api/design/export", { method: "POST", body: design }));
  assert.equal(legacy.status, 200);
  assert.equal(globalThis.storageTestState.legacyWrites, 1);
  process.env.R2_SUPABASE_FALLBACK = "false";
  assert.equal((await exportDesign(new Request("https://trangsucdecoco.vn/api/design/export", { method: "POST", body: design }))).status, 500);
  assert.equal(globalThis.storageTestState.legacyWrites, 1);
} finally {
  S3Client.prototype.send = previousSend;
  delete globalThis.storageTestState;
  for (const key of Object.keys(process.env)) if (!(key in previousEnv)) delete process.env[key];
  Object.assign(process.env, previousEnv);
}
console.log("PASS: Actual upload/export handlers write originals and thumbnails to R2, preserve auth and fail without falling back on write errors.");
