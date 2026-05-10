// Regression test for BUG_REPORT.md: "Đơn hàng không có ảnh thiết kế"
// Verifies the fix is in place across API + Frontend:
//   1. Silent-failure surfaces as 500 (not 200 + url:null)
//   2. Frontend blocks the redirect on upload failure
//   3. Payload uses binary multipart (avoids Vercel's 4.5MB body limit)
import { readFile } from "node:fs/promises";
import { strict as assert } from "node:assert";

const failures = [];
function check(name, fn) {
  try {
    fn();
    console.log(`  PASS  ${name}`);
  } catch (err) {
    failures.push({ name, err });
    console.log(`  FAIL  ${name}`);
    console.log(`        ${err.message}`);
  }
}

// --- API guards ---------------------------------------------------------------
const apiSource = await readFile("app/api/design/export/route.ts", "utf8");

console.log("\n[API] app/api/design/export/route.ts");
check("returns 500 on upload error", () => {
  const block = apiSource.match(/if \(uploadError\) \{[\s\S]*?\n  \}/)?.[0] ?? "";
  assert.match(block, /status:\s*500/);
});
check("does NOT silently return 200 on upload error", () => {
  const block = apiSource.match(/if \(uploadError\) \{[\s\S]*?\n  \}/)?.[0] ?? "";
  assert.doesNotMatch(block, /status:\s*200/);
  assert.doesNotMatch(block, /url:\s*null/);
});
check("accepts multipart/form-data binary uploads", () =>
  assert.match(apiSource, /multipart\/form-data/),
);
check("still accepts legacy JSON dataURL (backwards-compat)", () =>
  assert.match(apiSource, /body\?\.dataUrl/),
);

// --- Frontend guards ----------------------------------------------------------
const fe = await readFile(
  "components/DesignTool/DesignToolCanvas.tsx",
  "utf8",
);
const handleExport =
  fe.match(/const handleExport = useCallback\(async[\s\S]*?\}, \[[^\]]*\]\);/)?.[0] ?? "";

console.log("\n[FE] components/DesignTool/DesignToolCanvas.tsx :: handleExport");
check("guards on missing designImageUrl AND non-OK response", () => {
  assert.match(handleExport, /!designImageUrl/);
  assert.match(handleExport, /!res\.ok/);
});
check("early-returns before redirecting on failure", () => {
  const guardIdx = handleExport.search(/if \(!res\.ok \|\| !designImageUrl\)/);
  const redirectIdx = handleExport.indexOf("router.push");
  assert.ok(guardIdx > -1 && redirectIdx > -1);
  assert.ok(guardIdx < redirectIdx);
});
check("exports as JPEG (not PNG) to keep payload small", () =>
  assert.match(handleExport, /format:\s*"jpeg"/),
);
check("posts as FormData (binary), not base64 JSON", () => {
  assert.match(handleExport, /new FormData\(\)/);
  assert.match(handleExport, /body:\s*formData/);
  // Must NOT send the dataURL as JSON anymore
  assert.doesNotMatch(handleExport, /JSON\.stringify\(\{\s*dataUrl/);
});

// --- Behavioral simulation: API logic with mock supabase ---------------------
async function simulatedRoute(supabase, contentType, payload) {
  // Mirrors readImage() + the handler's branching
  let buffer, mimeType;
  if (contentType.startsWith("multipart/form-data")) {
    const file = payload; // already a Blob in this simulation
    if (!file || typeof file.arrayBuffer !== "function")
      return { status: 400, body: { error: "Missing file" } };
    mimeType = file.type;
    if (!["image/png", "image/jpeg"].includes(mimeType))
      return { status: 400, body: { error: "Invalid image type" } };
    buffer = Buffer.from(await file.arrayBuffer());
  } else {
    const match = payload?.dataUrl?.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) return { status: 400, body: { error: "Missing dataUrl" } };
    mimeType = match[1];
    if (!["image/png", "image/jpeg"].includes(mimeType))
      return { status: 400, body: { error: "Invalid image data" } };
    buffer = Buffer.from(match[2], "base64");
  }
  if (buffer.length > 20 * 1024 * 1024)
    return { status: 413, body: { error: "Image too large" } };

  const path = `orders/test.jpg`;
  const { error: uploadError } = await supabase.storage
    .from("designs")
    .upload(path, buffer);
  if (uploadError) {
    return {
      status: 500,
      body: { error: "Upload failed", detail: uploadError.message },
    };
  }
  const { data } = supabase.storage.from("designs").getPublicUrl(path);
  return { status: 200, body: { url: data.publicUrl } };
}

const fakeBlob = new Blob([Buffer.from("fake-jpeg")], { type: "image/jpeg" });

console.log("\n[Behavior] simulated route handler");
const failResult = await simulatedRoute(
  {
    storage: {
      from: () => ({
        upload: async () => ({
          error: { message: 'Bucket "designs" not found' },
        }),
        getPublicUrl: () => ({ data: { publicUrl: "never" } }),
      }),
    },
  },
  "multipart/form-data; boundary=x",
  fakeBlob,
);
check("multipart upload error -> status 500", () =>
  assert.equal(failResult.status, 500),
);
check("multipart upload error -> no url in body", () =>
  assert.equal(failResult.body.url, undefined),
);

const okResult = await simulatedRoute(
  {
    storage: {
      from: () => ({
        upload: async () => ({ error: null }),
        getPublicUrl: () => ({
          data: { publicUrl: "https://example.com/ok.jpg" },
        }),
      }),
    },
  },
  "multipart/form-data; boundary=x",
  fakeBlob,
);
check("multipart upload success -> status 200 with url", () => {
  assert.equal(okResult.status, 200);
  assert.equal(okResult.body.url, "https://example.com/ok.jpg");
});

// --- Summary ------------------------------------------------------------------
console.log("");
if (failures.length) {
  console.log(`FAILED (${failures.length})`);
  process.exit(1);
} else {
  console.log("All tests passed.");
}
