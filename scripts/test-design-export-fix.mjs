// Regression test for BUG_REPORT.md: "Đơn hàng không có ảnh thiết kế"
// Verifies that the silent-failure fix is in place across API + Frontend.
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

// --- Static guards: ensure the bad pattern cannot return ----------------------
const apiSource = await readFile("app/api/design/export/route.ts", "utf8");
const uploadErrorBlock =
  apiSource.match(/if \(uploadError\) \{[\s\S]*?\n  \}/)?.[0] ?? "";

console.log("\n[API] app/api/design/export/route.ts");
check("returns status 500 in upload-error branch", () =>
  assert.match(uploadErrorBlock, /status:\s*500/),
);
check("does NOT silently return 200 on upload error", () =>
  assert.doesNotMatch(uploadErrorBlock, /status:\s*200/),
);
check("does NOT return null url payload (silent failure)", () =>
  assert.doesNotMatch(uploadErrorBlock, /url:\s*null/),
);

// --- Frontend guards ----------------------------------------------------------
const fe = await readFile(
  "components/DesignTool/DesignToolCanvas.tsx",
  "utf8",
);
const handleExport =
  fe.match(/const handleExport = useCallback\(async[\s\S]*?\}, \[[^\]]*\]\);/)?.[0] ?? "";

console.log("\n[FE] components/DesignTool/DesignToolCanvas.tsx :: handleExport");
check("guards on missing designImageUrl", () =>
  assert.match(handleExport, /!designImageUrl/),
);
check("guards on non-OK response", () =>
  assert.match(handleExport, /!res\.ok/),
);
check("early-returns before redirecting", () => {
  const guardIdx = handleExport.search(/if \(!res\.ok \|\| !designImageUrl\)/);
  const redirectIdx = handleExport.indexOf("router.push");
  assert.ok(guardIdx > -1, "missing guard");
  assert.ok(redirectIdx > -1, "missing redirect");
  assert.ok(
    guardIdx < redirectIdx,
    "guard must precede redirect to block silent failure",
  );
});

// --- Behavioral simulation: replays route.ts logic with mock supabase ---------
async function simulatedRoute(supabase, dataUrl) {
  const match = dataUrl?.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return { status: 400, body: { error: "Missing dataUrl" } };
  const mimeType = match[1];
  if (!["image/png", "image/jpeg"].includes(mimeType))
    return { status: 400, body: { error: "Invalid image data" } };
  const buffer = Buffer.from(match[2], "base64");
  if (buffer.length > 20 * 1024 * 1024)
    return { status: 413, body: { error: "Image too large" } };

  const path = `orders/test.png`;
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

const fakePng = `data:image/png;base64,${Buffer.from("fake").toString("base64")}`;

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
  fakePng,
);
check("upload error -> status 500", () =>
  assert.equal(failResult.status, 500),
);
check("upload error -> no url in response body", () =>
  assert.equal(failResult.body.url, undefined),
);

const okResult = await simulatedRoute(
  {
    storage: {
      from: () => ({
        upload: async () => ({ error: null }),
        getPublicUrl: () => ({
          data: { publicUrl: "https://example.com/ok.png" },
        }),
      }),
    },
  },
  fakePng,
);
check("upload success -> status 200", () => assert.equal(okResult.status, 200));
check("upload success -> url returned", () =>
  assert.equal(okResult.body.url, "https://example.com/ok.png"),
);

// --- Summary -------------------------------------------------------------------
console.log("");
if (failures.length) {
  console.log(`FAILED (${failures.length})`);
  process.exit(1);
} else {
  console.log("All tests passed.");
}
