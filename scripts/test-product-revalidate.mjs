/**
 * Test tái hiện + xác minh bug "sửa sản phẩm trong Admin nhưng website không
 * cập nhật ngay" (BUG_REPORT.md).
 *
 * Gốc rễ: các route handler CRUD sản phẩm (PATCH / POST / DELETE) không gọi
 * revalidatePath, trong khi `createPublicClient()` cache fetch 300 giây. Admin
 * lưu xong thì DB đã đổi nhưng ngoài web vẫn phục vụ bản cache cũ tới 5 phút.
 *
 * Chạy với server PRODUCTION đang listen ở BASE (mặc định http://localhost:3100):
 *   npm run build && npx next start -p 3100
 *   node --experimental-strip-types --import ./scripts/alias-hook.mjs \
 *     scripts/test-product-revalidate.mjs
 *
 * Cách chứng minh (quan trọng): mỗi case đều MỒI CACHE trước — fetch trang cho
 * tới khi thấy giá trị cũ nằm trong HTML — rồi mới gọi API và fetch lại ngay.
 * Nếu thiếu revalidatePath, bản cache vừa mồi còn sống 300 giây nên lần fetch
 * ngay sau đó chắc chắn vẫn trả giá trị cũ => test FAIL. Test chỉ PASS khi web
 * đổi trong vài giây, tức là nhờ on-demand revalidation chứ không phải hết TTL.
 *
 * Các case:
 *  1. Authz: PATCH / POST / DELETE khi chưa đăng nhập -> 401, DB không đổi.
 *  2. PATCH đổi tên sản phẩm + tên phân loại -> /san-pham/[slug], /san-pham, /
 *     hiển thị giá trị mới ngay, và KHÔNG còn giá trị cũ.
 *  3. PATCH đổi slug -> đường dẫn mới 200, đường dẫn cũ hết cache (404),
 *     /san-pham trỏ sang slug mới. Sau đó trả slug về như cũ.
 *  4. POST tạo sản phẩm mới -> xuất hiện ngay ngoài /san-pham.
 *  5. PATCH tắt hiển thị -> biến mất ngay khỏi /san-pham, trang chi tiết 404.
 *  6. DELETE -> biến mất ngay, trang chi tiết 404.
 *  7. Khôi phục nguyên trạng sản phẩm đã mượn để test.
 */
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

const BASE = process.env.BASE ?? "http://localhost:3100";

for (const line of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2].trim();
}
const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** TTL cache của createPublicClient (lib/supabase/server.ts). */
const CACHE_TTL_SECONDS = 300;
/** Ngưỡng coi là "cập nhật ngay": phải nhỏ hơn TTL rất nhiều. */
const FRESH_LIMIT_MS = 15_000;

let pass = 0, fail = 0;
function check(name, cond, detail = "") {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}${detail ? "\n        " + detail : ""}`); }
}

const admin = createClient(URL_, SERVICE, { auth: { persistSession: false } });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getHtml(path) {
  const res = await fetch(`${BASE}${path}`, { cache: "no-store" });
  return { status: res.status, html: await res.text() };
}

/**
 * Mồi cache: fetch tới khi HTML chứa `needle` (giá trị đang có trong DB).
 * Mồi xong nghĩa là Next đã giữ một bản render với giá trị cũ, TTL 300s.
 */
async function primeUntil(path, needle, label) {
  for (let i = 0; i < 12; i++) {
    const { html } = await getHtml(path);
    if (html.includes(needle)) return true;
    await sleep(500);
  }
  check(`mồi được cache ${label} với giá trị hiện tại`, false,
    `${path} không bao giờ chứa "${needle}"`);
  return false;
}

/**
 * Sau khi gọi API: fetch lại và kỳ vọng HTML đã đổi. Thử lại vài nhịp ngắn
 * (vẫn thấp hơn TTL 300s rất nhiều) rồi báo cáo tổng thời gian đã tốn.
 */
async function expectFresh(path, { contains = [], notContains = [] }, startedAt) {
  let last = { status: 0, html: "" };
  for (let i = 0; i < 8; i++) {
    last = await getHtml(path);
    const ok =
      contains.every((s) => last.html.includes(s)) &&
      notContains.every((s) => !last.html.includes(s));
    if (ok) return { ok: true, elapsed: Date.now() - startedAt, status: last.status };
    await sleep(500);
  }
  return {
    ok: false,
    elapsed: Date.now() - startedAt,
    status: last.status,
    missing: contains.filter((s) => !last.html.includes(s)),
    leftover: notContains.filter((s) => last.html.includes(s)),
  };
}

function reportFresh(name, r) {
  check(
    `${name} (sau ${(r.elapsed / 1000).toFixed(1)}s << TTL ${CACHE_TTL_SECONDS}s)`,
    r.ok && r.elapsed < FRESH_LIMIT_MS,
    r.ok
      ? `mất ${(r.elapsed / 1000).toFixed(1)}s, vượt ngưỡng ${FRESH_LIMIT_MS / 1000}s`
      : `còn thiếu: ${JSON.stringify(r.missing ?? [])} | còn sót bản cũ: ${JSON.stringify(r.leftover ?? [])}`
  );
}

/** Tạo cookie session admin đúng format @supabase/ssr mà route handler đọc được. */
async function adminCookies() {
  const email = process.env.ADMIN_EMAIL;
  const { data: link, error: linkErr } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (linkErr) throw new Error(`generateLink: ${linkErr.message}`);

  const anonClient = createClient(URL_, ANON, { auth: { persistSession: false } });
  const { data: verified, error: vErr } = await anonClient.auth.verifyOtp({
    type: "magiclink",
    token_hash: link.properties.hashed_token,
  });
  if (vErr) throw new Error(`verifyOtp: ${vErr.message}`);

  const jar = new Map();
  const ssr = createServerClient(URL_, ANON, {
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: (list) => list.forEach(({ name, value }) => jar.set(name, value)),
    },
  });
  const { error: sErr } = await ssr.auth.setSession({
    access_token: verified.session.access_token,
    refresh_token: verified.session.refresh_token,
  });
  if (sErr) throw new Error(`setSession: ${sErr.message}`);

  return [...jar].map(([n, v]) => `${n}=${v}`).join("; ");
}

function api(path, method, body, cookie) {
  return fetch(`${BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(cookie ? { Cookie: cookie } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

async function dbProduct(id) {
  const { data, error } = await admin
    .from("products")
    .select("id, name, slug, variants, is_visible, sort_order")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function main() {
  console.log(`BASE = ${BASE}\n`);

  const { data: all, error } = await admin
    .from("products")
    .select("id, name, slug, variants, is_visible, sort_order")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw error;

  // Chọn sản phẩm ĐANG HIỆN đứng đầu -> chắc chắn có mặt cả ở trang chủ (top 4)
  // lẫn /san-pham, nên kiểm được revalidate của cả ba trang.
  const target = all.find((p) => p.is_visible);
  if (!target) throw new Error("Không có sản phẩm nào đang hiển thị để test");
  const origin = JSON.parse(JSON.stringify(target));
  console.log(`Sản phẩm dùng để test: "${origin.name}" (/san-pham/${origin.slug})`);

  const variants = Array.isArray(origin.variants) ? origin.variants : [];
  const canTestVariants =
    variants.length > 0 &&
    variants.every((v) => v?.id && v?.name && /^https?:\/\//.test(v?.image_url ?? ""));
  console.log(
    canTestVariants
      ? `  có ${variants.length} phân loại -> kiểm cả đổi tên phân loại`
      : `  không có phân loại hợp lệ -> chỉ kiểm đổi tên sản phẩm`
  );
  console.log();

  console.log("Đăng nhập admin bằng session Supabase thật...");
  const cookie = await adminCookies();
  console.log(`  cookie: ${cookie.slice(0, 40)}... (${cookie.length} ký tự)\n`);

  // ---------- Case 1: authz ----------
  console.log("Case 1 — authz: gọi API khi chưa đăng nhập");
  const anonPatch = await api(`/api/admin/products/${origin.id}`, "PATCH", { name: "HACK" });
  check("PATCH ẩn danh -> 401", anonPatch.status === 401, `nhận ${anonPatch.status}`);
  const anonPost = await api(`/api/admin/products`, "POST", {
    name: "HACK", slug: "hack", price: 1000, stock: 1,
  });
  check("POST ẩn danh -> 401", anonPost.status === 401, `nhận ${anonPost.status}`);
  const anonDel = await api(`/api/admin/products/${origin.id}`, "DELETE");
  check("DELETE ẩn danh -> 401", anonDel.status === 401, `nhận ${anonDel.status}`);
  const afterAnon = await dbProduct(origin.id);
  check("DB không bị request ẩn danh thay đổi",
    afterAnon && afterAnon.name === origin.name && afterAnon.slug === origin.slug);

  // ---------- Case 2: PATCH tên sản phẩm + tên phân loại ----------
  // Patch lần 1 đặt mốc A, mồi cache cho tới khi web hiện A. Patch lần 2 đặt mốc
  // B. Nếu thiếu revalidatePath, bản cache chứa A còn sống 300s -> fetch ngay
  // sau patch 2 vẫn thấy A và không thấy B -> FAIL.
  console.log("\nCase 2 — PATCH tên sản phẩm + tên phân loại, web phải đổi NGAY");
  const markA = `KTA${Date.now().toString(36)}`;
  const markB = `KTB${Date.now().toString(36)}`;

  const bodyWith = (mark) => {
    const b = { name: `${origin.name} ${mark}` };
    if (canTestVariants) {
      b.variants = variants.map((v) => ({
        id: v.id,
        name: `${v.name} ${mark}`,
        image_url: v.image_url,
        ...(typeof v.stock === "number" ? { stock: v.stock } : {}),
      }));
    }
    return b;
  };

  const p1 = await api(`/api/admin/products/${origin.id}`, "PATCH", bodyWith(markA), cookie);
  check("PATCH lần 1 (đặt mốc A) -> 200", p1.status === 200, `nhận ${p1.status}`);

  const detailPath = `/san-pham/${origin.slug}`;
  await primeUntil(detailPath, markA, "trang chi tiết");
  await primeUntil("/san-pham", markA, "trang danh sách");
  await primeUntil("/", markA, "trang chủ");
  console.log(`  đã mồi cache 3 trang với mốc A=${markA} (TTL ${CACHE_TTL_SECONDS}s)`);

  const t2 = Date.now();
  const p2 = await api(`/api/admin/products/${origin.id}`, "PATCH", bodyWith(markB), cookie);
  check("PATCH lần 2 (đổi sang mốc B) -> 200", p2.status === 200, `nhận ${p2.status}`);

  reportFresh("/san-pham/[slug] hiện mốc B, sạch mốc A",
    await expectFresh(detailPath, { contains: [markB], notContains: [markA] }, t2));
  reportFresh("/san-pham hiện mốc B, sạch mốc A",
    await expectFresh("/san-pham", { contains: [markB], notContains: [markA] }, t2));
  reportFresh("/ (trang chủ) hiện mốc B, sạch mốc A",
    await expectFresh("/", { contains: [markB], notContains: [markA] }, t2));

  if (canTestVariants) {
    const dbNow = await dbProduct(origin.id);
    check("DB lưu đúng tên phân loại mới",
      dbNow.variants.every((v) => v.name.endsWith(markB)),
      JSON.stringify(dbNow.variants.map((v) => v.name)));
  }

  // ---------- Case 3: đổi slug ----------
  console.log("\nCase 3 — PATCH đổi slug: đường dẫn mới sống, đường dẫn cũ hết cache");
  const newSlug = `${origin.slug}-kt${Date.now().toString(36)}`.slice(0, 100);
  const t3 = Date.now();
  const p3 = await api(`/api/admin/products/${origin.id}`, "PATCH", { slug: newSlug }, cookie);
  check("PATCH đổi slug -> 200", p3.status === 200, `nhận ${p3.status}`);

  reportFresh(`/san-pham/${newSlug} render được ngay`,
    await expectFresh(`/san-pham/${newSlug}`, { contains: [markB] }, t3));

  const oldPath = await getHtml(detailPath);
  check("đường dẫn CŨ đã bị xoá cache (404, không còn phục vụ bản cũ)",
    oldPath.status === 404, `nhận ${oldPath.status} — vẫn đang trả bản cache cũ`);

  reportFresh("/san-pham đã trỏ sang slug mới",
    await expectFresh("/san-pham", { contains: [`/san-pham/${newSlug}`] }, t3));

  const t3b = Date.now();
  const p3b = await api(`/api/admin/products/${origin.id}`, "PATCH", { slug: origin.slug }, cookie);
  check("PATCH trả slug về như cũ -> 200", p3b.status === 200, `nhận ${p3b.status}`);
  reportFresh("đường dẫn cũ sống lại ngay sau khi trả slug",
    await expectFresh(detailPath, { contains: [markB] }, t3b));

  // ---------- Case 4: POST tạo mới ----------
  console.log("\nCase 4 — POST tạo sản phẩm mới, phải hiện ngay ngoài /san-pham");
  const tmpSlug = `kiem-thu-revalidate-${Date.now().toString(36)}`;
  const tmpName = `KIEM THU REVALIDATE ${Date.now().toString(36)}`;
  const t4 = Date.now();
  const createRes = await api(`/api/admin/products`, "POST", {
    name: tmpName,
    slug: tmpSlug,
    description: "San pham tam de kiem thu revalidatePath, se bi xoa ngay sau test.",
    price: 10000,
    stock: 1,
    is_visible: true,
    images: [],
    // xếp cuối danh sách để không chen vào 4 sản phẩm nổi bật ngoài trang chủ
    sort_order: 9999,
  }, cookie);
  const created = await createRes.json().catch(() => ({}));
  check("POST -> 201", createRes.status === 201, `nhận ${createRes.status} ${JSON.stringify(created)}`);

  reportFresh("/san-pham có sản phẩm mới ngay",
    await expectFresh("/san-pham", { contains: [`/san-pham/${tmpSlug}`] }, t4));
  const tmpDetail = await getHtml(`/san-pham/${tmpSlug}`);
  check("trang chi tiết sản phẩm mới trả 200", tmpDetail.status === 200, `nhận ${tmpDetail.status}`);

  // ---------- Case 5: tắt hiển thị ----------
  console.log("\nCase 5 — PATCH tắt hiển thị, phải biến mất ngay");
  await primeUntil("/san-pham", `/san-pham/${tmpSlug}`, "danh sách (trước khi ẩn)");
  const t5 = Date.now();
  const hideRes = await api(`/api/admin/products/${created.id}`, "PATCH", { is_visible: false }, cookie);
  check("PATCH is_visible=false -> 200", hideRes.status === 200, `nhận ${hideRes.status}`);
  reportFresh("/san-pham không còn sản phẩm vừa ẩn",
    await expectFresh("/san-pham", { notContains: [`/san-pham/${tmpSlug}`] }, t5));
  const hiddenDetail = await getHtml(`/san-pham/${tmpSlug}`);
  check("trang chi tiết sản phẩm đã ẩn trả 404", hiddenDetail.status === 404, `nhận ${hiddenDetail.status}`);

  // ---------- Case 6: DELETE ----------
  console.log("\nCase 6 — DELETE, trang chi tiết phải hết cache ngay");
  await api(`/api/admin/products/${created.id}`, "PATCH", { is_visible: true }, cookie);
  await primeUntil(`/san-pham/${tmpSlug}`, tmpName, "chi tiết (trước khi xoá)");
  await primeUntil("/san-pham", `/san-pham/${tmpSlug}`, "danh sách (trước khi xoá)");

  const t6 = Date.now();
  const delRes = await api(`/api/admin/products/${created.id}`, "DELETE", undefined, cookie);
  check("DELETE -> 200", delRes.status === 200, `nhận ${delRes.status}`);

  let deletedStatus = 0;
  for (let i = 0; i < 8; i++) {
    deletedStatus = (await getHtml(`/san-pham/${tmpSlug}`)).status;
    if (deletedStatus === 404) break;
    await sleep(500);
  }
  check(`trang chi tiết sản phẩm đã xoá trả 404 (sau ${((Date.now() - t6) / 1000).toFixed(1)}s)`,
    deletedStatus === 404, `nhận ${deletedStatus} — vẫn phục vụ bản cache cũ`);
  reportFresh("/san-pham không còn sản phẩm đã xoá",
    await expectFresh("/san-pham", { notContains: [`/san-pham/${tmpSlug}`] }, t6));

  check("sản phẩm tạm đã bị xoá khỏi DB", (await dbProduct(created.id)) === null);

  // ---------- Case 7: khôi phục ----------
  console.log("\nCase 7 — khôi phục nguyên trạng sản phẩm đã mượn để test");
  const restoreBody = { name: origin.name, slug: origin.slug };
  if (canTestVariants) restoreBody.variants = variants;
  const restoreRes = await api(`/api/admin/products/${origin.id}`, "PATCH", restoreBody, cookie);
  check("PATCH khôi phục -> 200", restoreRes.status === 200, `nhận ${restoreRes.status}`);

  const final = await dbProduct(origin.id);
  check("DB đã về đúng tên + slug ban đầu",
    final.name === origin.name && final.slug === origin.slug,
    `name="${final.name}" slug="${final.slug}"`);
  if (canTestVariants) {
    check("DB đã về đúng phân loại ban đầu",
      JSON.stringify(final.variants) === JSON.stringify(origin.variants),
      JSON.stringify(final.variants));
  }
  reportFresh("website sạch hết dấu vết kiểm thử",
    await expectFresh(detailPath, { notContains: [markA, markB] }, Date.now()));

  console.log(`\n==================== KẾT QUẢ ====================`);
  console.log(`PASS: ${pass}   FAIL: ${fail}`);
  console.log(fail === 0 ? "=> THÀNH CÔNG" : "=> THẤT BẠI");
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => { console.error("\nLỖI KHI CHẠY TEST:", e); process.exit(1); });
