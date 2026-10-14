/**
 * Test tái hiện + xác minh bug "không sắp xếp được thứ tự sản phẩm".
 *
 * Chạy với server production đang listen ở BASE (mặc định http://localhost:3100).
 *
 * Các case:
 *  1. Authz: PUT /api/admin/products/reorder khi chưa đăng nhập -> 401.
 *  2. Validation: payload sai -> 422 (sau khi đã đăng nhập).
 *  3. Reorder thật: đăng nhập admin bằng session thật (cookie @supabase/ssr),
 *     kéo sản phẩm cuối lên đầu -> API 200, DB lưu sort_order 0..n-1 không trùng.
 *  4. Website: HTML trang / và /san-pham hiển thị đúng thứ tự mới (và ngay lập
 *     tức, nhờ revalidatePath — không phải chờ 30/60s ISR).
 *  5. Khôi phục lại thứ tự ban đầu.
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

let pass = 0, fail = 0;
function check(name, cond, detail = "") {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}${detail ? "\n        " + detail : ""}`); }
}

const admin = createClient(URL_, SERVICE, { auth: { persistSession: false } });

async function dbProducts() {
  const { data, error } = await admin
    .from("products")
    .select("id, name, slug, sort_order, is_visible, created_at")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data;
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

  // Dùng chính @supabase/ssr để sinh cookie -> đảm bảo đúng tên + chunking.
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

function reorderPut(body, cookie) {
  return fetch(`${BASE}/api/admin/products/reorder`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: JSON.stringify(body),
  });
}

/** Trích thứ tự slug sản phẩm xuất hiện trong HTML (theo link /san-pham/<slug>). */
function slugsFromHtml(html) {
  const out = [];
  for (const m of html.matchAll(/\/san-pham\/([a-z0-9-]+)/g)) {
    if (!out.includes(m[1])) out.push(m[1]);
  }
  return out;
}

async function main() {
  console.log(`BASE = ${BASE}\n`);

  const original = await dbProducts();
  console.log(`DB: ${original.length} sản phẩm, thứ tự ban đầu:`);
  original.forEach((p) => console.log(`  ${p.sort_order}  ${p.name}`));
  console.log();

  // --- Case 0: dữ liệu sort_order đã chuẩn hoá, không còn trùng ---
  console.log("Case 0 — sort_order đã chuẩn hoá (migration 013)");
  const orders = original.map((p) => p.sort_order);
  check("sort_order không trùng lặp", new Set(orders).size === orders.length,
    `có ${orders.length - new Set(orders).size} giá trị trùng: ${orders.join(",")}`);
  check("sort_order liên tục 0..n-1",
    orders.every((v, i) => v === i), `thực tế: ${orders.join(",")}`);

  // --- Case 1: chưa đăng nhập -> 401 ---
  console.log("\nCase 1 — authz: gọi reorder khi chưa đăng nhập");
  const anonRes = await reorderPut({ items: [{ id: original[0].id, sort_order: 0 }] });
  check("trả về 401 Unauthorized", anonRes.status === 401, `nhận ${anonRes.status}`);

  const beforeAuthz = await dbProducts();
  check("DB không bị thay đổi bởi request ẩn danh",
    JSON.stringify(beforeAuthz.map((p) => [p.id, p.sort_order])) ===
    JSON.stringify(original.map((p) => [p.id, p.sort_order])));

  // --- Đăng nhập admin ---
  console.log("\nĐăng nhập admin bằng session Supabase thật...");
  const cookie = await adminCookies();
  console.log(`  cookie: ${cookie.slice(0, 40)}... (${cookie.length} ký tự)`);

  // --- Case 2: payload sai -> 422 ---
  console.log("\nCase 2 — validation payload");
  const badRes = await reorderPut({ items: [] }, cookie);
  check("items rỗng -> 422", badRes.status === 422, `nhận ${badRes.status}`);
  const badRes2 = await reorderPut({ items: [{ id: "khong-phai-uuid", sort_order: 0 }] }, cookie);
  check("id không phải uuid -> 422", badRes2.status === 422, `nhận ${badRes2.status}`);

  // --- Case 3: reorder thật ---
  // Cố ý chọn sản phẩm ĐANG HIỂN THỊ xếp cuối cùng rồi đưa lên đầu, để thay đổi
  // này chắc chắn nhìn thấy được ngoài website. Nếu chọn một sản phẩm đang ẩn
  // thì Case 4 sẽ pass giả — thứ tự công khai không hề đổi.
  console.log("\nCase 3 — reorder: đưa sản phẩm ĐANG HIỆN xếp cuối lên vị trí ĐẦU");
  const visibleBefore = original.filter((p) => p.is_visible).map((p) => p.slug);
  console.log(`  thứ tự công khai TRƯỚC: ${visibleBefore.join(" > ")}`);
  const lastVisible = [...original].reverse().find((p) => p.is_visible);
  if (!lastVisible) throw new Error("Không có sản phẩm nào đang hiển thị để test");
  const moved = [lastVisible, ...original.filter((p) => p.id !== lastVisible.id)];
  const payload = moved.map((p, i) => ({ id: p.id, sort_order: i }));
  console.log(`  đưa "${moved[0].name}" lên đầu`);

  const okRes = await reorderPut({ items: payload }, cookie);
  const okJson = await okRes.json().catch(() => ({}));
  check("API trả 200", okRes.status === 200, `nhận ${okRes.status} ${JSON.stringify(okJson)}`);
  check("body { success: true }", okJson.success === true, JSON.stringify(okJson));

  const afterDb = await dbProducts();
  check("DB lưu đúng thứ tự mới",
    JSON.stringify(afterDb.map((p) => p.id)) === JSON.stringify(moved.map((p) => p.id)),
    `DB: ${afterDb.map((p) => p.name).join(" | ")}`);
  const afterOrders = afterDb.map((p) => p.sort_order);
  check("sort_order vẫn liên tục 0..n-1, không trùng",
    afterOrders.every((v, i) => v === i), afterOrders.join(","));

  // --- Case 4: website hiển thị thứ tự mới ngay (revalidatePath) ---
  console.log("\nCase 4 — website cập nhật ngay (revalidatePath, không chờ ISR 30/60s)");
  const visible = afterDb.filter((p) => p.is_visible).map((p) => p.slug);
  console.log(`  thứ tự mong đợi (chỉ sản phẩm đang hiện): ${visible.join(" > ")}`);
  check("thứ tự công khai thực sự đã đổi (bảo đảm test không pass giả)",
    JSON.stringify(visible) !== JSON.stringify(visibleBefore),
    `trước và sau giống hệt nhau: ${visible.join(" > ")}`);

  const listHtml = await (await fetch(`${BASE}/san-pham`, { cache: "no-store" })).text();
  const listSlugs = slugsFromHtml(listHtml).filter((s) => visible.includes(s));
  check("/san-pham hiển thị đúng thứ tự",
    JSON.stringify(listSlugs) === JSON.stringify(visible),
    `thực tế: ${listSlugs.join(" > ")}`);

  const homeHtml = await (await fetch(`${BASE}/`, { cache: "no-store" })).text();
  const homeSlugs = slugsFromHtml(homeHtml).filter((s) => visible.includes(s));
  check("/ (4 sản phẩm nổi bật) đúng thứ tự",
    JSON.stringify(homeSlugs) === JSON.stringify(visible.slice(0, 4)),
    `thực tế: ${homeSlugs.join(" > ")} | mong đợi: ${visible.slice(0, 4).join(" > ")}`);

  // --- Case 5: khôi phục thứ tự ban đầu ---
  console.log("\nCase 5 — khôi phục thứ tự ban đầu");
  const restore = original.map((p, i) => ({ id: p.id, sort_order: i }));
  const resRes = await reorderPut({ items: restore }, cookie);
  check("API khôi phục trả 200", resRes.status === 200, `nhận ${resRes.status}`);
  const restored = await dbProducts();
  check("DB đã về đúng thứ tự ban đầu",
    JSON.stringify(restored.map((p) => p.id)) === JSON.stringify(original.map((p) => p.id)));

  console.log(`\n==================== KẾT QUẢ ====================`);
  console.log(`PASS: ${pass}   FAIL: ${fail}`);
  console.log(fail === 0 ? "=> THÀNH CÔNG" : "=> THẤT BẠI");
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => { console.error("\nLỖI KHI CHẠY TEST:", e); process.exit(1); });
