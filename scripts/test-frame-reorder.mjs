/**
 * Test reorder khung (/admin/khung) — bản sao của test sản phẩm, cho bảng frames.
 *
 * Bug gốc (giống hệt route sản phẩm): client không serialize + server ghi bằng
 * N câu UPDATE rời rạc qua Promise.all, nên hai lần kéo thả liên tiếp trộn hai
 * snapshot vào nhau, sinh sort_order trùng và có lỗ.
 *
 * Chạy với server đang listen ở BASE (mặc định http://localhost:3100).
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

async function dbFrames() {
  const { data, error } = await admin
    .from("frames")
    .select("id, name, sort_order, created_at")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data;
}

async function adminCookies() {
  const { data: link, error: e1 } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: process.env.ADMIN_EMAIL,
  });
  if (e1) throw new Error(`generateLink: ${e1.message}`);
  const anonClient = createClient(URL_, ANON, { auth: { persistSession: false } });
  const { data: v, error: e2 } = await anonClient.auth.verifyOtp({
    type: "magiclink",
    token_hash: link.properties.hashed_token,
  });
  if (e2) throw new Error(`verifyOtp: ${e2.message}`);
  const jar = new Map();
  const ssr = createServerClient(URL_, ANON, {
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: (l) => l.forEach(({ name, value }) => jar.set(name, value)),
    },
  });
  const { error: e3 } = await ssr.auth.setSession({
    access_token: v.session.access_token,
    refresh_token: v.session.refresh_token,
  });
  if (e3) throw new Error(`setSession: ${e3.message}`);
  return [...jar].map(([n, x]) => `${n}=${x}`).join("; ");
}

const reorderPut = (body, cookie) =>
  fetch(`${BASE}/api/admin/frames/reorder`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) },
    body: JSON.stringify(body),
  });

const toItems = (list) => list.map((f, i) => ({ id: f.id, sort_order: i }));

async function main() {
  console.log(`BASE = ${BASE}\n`);

  const original = await dbFrames();
  console.log(`DB: ${original.length} khung`);
  original.forEach((f) => console.log(`  ${f.sort_order}  ${f.name}`));
  console.log();

  console.log("Case 0 — sort_order khung đã chuẩn hoá (migration 015)");
  const orders = original.map((f) => f.sort_order);
  check("không trùng lặp", new Set(orders).size === orders.length, orders.join(","));
  check("liên tục 0..n-1", orders.every((v, i) => v === i), orders.join(","));

  console.log("\nCase 1 — authz: gọi reorder khi chưa đăng nhập");
  const anonRes = await reorderPut({ items: toItems(original) });
  check("trả về 401", anonRes.status === 401, `nhận ${anonRes.status}`);
  check("DB không đổi", JSON.stringify((await dbFrames()).map((f) => [f.id, f.sort_order])) ===
    JSON.stringify(original.map((f) => [f.id, f.sort_order])));

  console.log("\nĐăng nhập admin bằng session Supabase thật...");
  const cookie = await adminCookies();

  console.log("\nCase 2 — validation payload");
  check("items rỗng -> 422", (await reorderPut({ items: [] }, cookie)).status === 422);
  check("id không phải uuid -> 422",
    (await reorderPut({ items: [{ id: "abc", sort_order: 0 }] }, cookie)).status === 422);

  console.log("\nCase 3 — reorder: đảo ngược thứ tự khung");
  const reversed = [...original].reverse();
  const res3 = await reorderPut({ items: toItems(reversed) }, cookie);
  check("API trả 200", res3.status === 200, `nhận ${res3.status}`);
  const after3 = await dbFrames();
  check("DB lưu đúng thứ tự đảo ngược",
    JSON.stringify(after3.map((f) => f.id)) === JSON.stringify(reversed.map((f) => f.id)),
    after3.map((f) => f.name).join(" | "));

  console.log("\nCase 4 — bắn 2 reorder CHỒNG NHAU, kết quả không được là hỗn hợp");
  const A = [...after3];
  const B = [...after3].reverse();
  const [rA, rB] = await Promise.all([
    reorderPut({ items: toItems(A) }, cookie),
    reorderPut({ items: toItems(B) }, cookie),
  ]);
  check("cả 2 request đều trả 200", rA.status === 200 && rB.status === 200,
    `A=${rA.status} B=${rB.status}`);

  const raced = await dbFrames();
  const racedOrders = raced.map((f) => f.sort_order);
  check("không có sort_order trùng lặp",
    new Set(racedOrders).size === racedOrders.length, racedOrders.join(","));
  check("sort_order vẫn liên tục 0..n-1 (không có lỗ)",
    racedOrders.every((v, i) => v === i), racedOrders.join(","));
  const idsNow = JSON.stringify(raced.map((f) => f.id));
  check("thứ tự cuối khớp ĐÚNG MỘT trong hai snapshot, không trộn lẫn",
    idsNow === JSON.stringify(A.map((f) => f.id)) || idsNow === JSON.stringify(B.map((f) => f.id)),
    "kết quả là hỗn hợp -> ghi vẫn chưa nguyên tử");

  console.log("\nCase 5 — khôi phục thứ tự ban đầu");
  check("API khôi phục trả 200",
    (await reorderPut({ items: toItems(original) }, cookie)).status === 200);
  check("DB đã về đúng thứ tự ban đầu",
    JSON.stringify((await dbFrames()).map((f) => f.id)) === JSON.stringify(original.map((f) => f.id)));

  console.log(`\n==================== KẾT QUẢ ====================`);
  console.log(`PASS: ${pass}   FAIL: ${fail}`);
  console.log(fail === 0 ? "=> THÀNH CÔNG" : "=> THẤT BẠI");
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => { console.error("\nLỖI KHI CHẠY TEST:", e); process.exit(1); });
