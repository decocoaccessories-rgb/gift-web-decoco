/**
 * Test hiển thị "Hết hàng" cho sản phẩm hết tồn.
 *
 * Bug gốc: thẻ sản phẩm trên trang chủ và /san-pham chỉ nhìn `product.stock`.
 * Với sản phẩm quản lý tồn theo phân loại (PRD F1), `product.stock` bị bỏ qua ở
 * runtime — nên sản phẩm có MỌI variant = 0 nhưng product.stock = 10 vẫn hiện
 * như còn hàng, không có nhãn nào.
 *
 * Chạy với server đang listen ở BASE (mặc định http://localhost:3100).
 *
 * Phần A — unit test cho lib/stock.ts (không cần server/DB).
 * Phần B — kiểm tra HTML thật của /, /san-pham và trang chi tiết so với dữ liệu DB.
 */
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";
import {
  getAvailableStock,
  isOutOfStock,
  isVariantManaged,
  isVariantOutOfStock,
} from "../lib/stock.ts";

const BASE = process.env.BASE ?? "http://localhost:3100";

for (const line of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2].trim();
}

let pass = 0, fail = 0;
function check(name, cond, detail = "") {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}${detail ? "\n        " + detail : ""}`); }
}

// ---------------------------------------------------------------- Phần A
console.log("PHẦN A — unit test lib/stock.ts\n");

const noVariants = { stock: 7, variants: [] };
check("không variant: dùng product.stock", getAvailableStock(noVariants) === 7);
check("không variant, stock > 0: còn hàng", isOutOfStock(noVariants) === false);
check("không variant, stock = 0: hết hàng", isOutOfStock({ stock: 0, variants: [] }) === true);
check("không variant: không phải variant-managed", isVariantManaged(noVariants) === false);

// Variant KHÔNG có field stock -> vẫn là flow cũ, đọc product.stock.
const legacyVariants = {
  stock: 5,
  variants: [{ id: "a", name: "Vàng", image_url: "u" }],
};
check("variant thiếu stock: không phải variant-managed", isVariantManaged(legacyVariants) === false);
check("variant thiếu stock: dùng product.stock", getAvailableStock(legacyVariants) === 5);

// Đây chính là hình dạng dữ liệu gây ra bug.
const allZero = {
  stock: 10,
  variants: [
    { id: "a", name: "Thiệp bánh", image_url: "u", stock: 0 },
    { id: "b", name: "Thiệp tim", image_url: "u", stock: 0 },
  ],
};
check("variant-managed: nhận ra đúng", isVariantManaged(allZero) === true);
check("mọi variant = 0 -> tổng kho 0 (BỎ QUA product.stock = 10)", getAvailableStock(allZero) === 0);
check("mọi variant = 0 -> HẾT HÀNG (đây là bug gốc)", isOutOfStock(allZero) === true);

const partial = {
  stock: 10,
  variants: [
    { id: "a", name: "Thiệp trái tim", image_url: "u", stock: 10 },
    { id: "b", name: "Thiệp HPBD", image_url: "u", stock: 0 },
  ],
};
check("còn 1 variant -> vẫn còn hàng", isOutOfStock(partial) === false);
check("tổng kho = tổng các variant", getAvailableStock(partial) === 10);
check("variant còn hàng: không bị đánh dấu hết", isVariantOutOfStock(partial, partial.variants[0]) === false);
check("variant hết: bị đánh dấu hết", isVariantOutOfStock(partial, partial.variants[1]) === true);
check("variant thiếu stock trong sp variant-managed -> coi là hết (an toàn)",
  isVariantOutOfStock(
    { stock: 10, variants: [{ id: "a", name: "x", image_url: "u", stock: 1 }, { id: "b", name: "y", image_url: "u" }] },
    { id: "b", name: "y", image_url: "u" }
  ) === true);

// ---------------------------------------------------------------- Phần B
console.log("\nPHẦN B — HTML thật so với dữ liệu DB\n");

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const { data: rows, error } = await admin
  .from("products")
  .select("name, slug, stock, variants, is_visible")
  .eq("is_visible", true)
  .order("sort_order", { ascending: true })
  .order("created_at", { ascending: true });
if (error) throw error;

const sold = rows.filter((p) => isOutOfStock(p));
const avail = rows.filter((p) => !isOutOfStock(p));
console.log(`DB: ${rows.length} sản phẩm đang hiển thị — ${sold.length} hết hàng, ${avail.length} còn hàng`);
sold.forEach((p) => console.log(`  [HẾT]  ${p.name} (product.stock=${p.stock}, tổng variant=0)`));
console.log();

check("có ít nhất 1 sp hết hàng và 1 sp còn hàng để test cho có nghĩa",
  sold.length > 0 && avail.length > 0,
  `hết=${sold.length} còn=${avail.length} — test sẽ không chứng minh được gì`);

/** Cắt đoạn HTML của đúng thẻ sản phẩm theo slug, để không nhầm với thẻ khác. */
function cardHtml(html, slug) {
  const anchor = `/san-pham/${slug}"`;
  const at = html.indexOf(anchor);
  if (at === -1) return null;
  // Thẻ sản phẩm là một <a>; lấy từ đầu <a> tới </a> gần nhất sau đó.
  const start = html.lastIndexOf("<a", at);
  const end = html.indexOf("</a>", at);
  return start === -1 || end === -1 ? null : html.slice(start, end);
}

for (const [label, path] of [["/san-pham", "/san-pham"], ["trang chủ", "/"]]) {
  const html = await (await fetch(`${BASE}${path}`, { cache: "no-store" })).text();
  console.log(`-- ${label} --`);

  for (const p of sold) {
    const card = cardHtml(html, p.slug);
    if (!card) { console.log(`  skip  ${p.name} (không xuất hiện trên ${label})`); continue; }
    check(`[${label}] "${p.name}" có nhãn Hết hàng`, card.includes("Hết hàng"),
      "không tìm thấy chữ 'Hết hàng' trong thẻ sản phẩm");
    check(`[${label}] "${p.name}" ảnh bị làm mờ (grayscale)`, /grayscale/.test(card),
      "không tìm thấy class grayscale");
  }
  for (const p of avail) {
    const card = cardHtml(html, p.slug);
    if (!card) { console.log(`  skip  ${p.name} (không xuất hiện trên ${label})`); continue; }
    check(`[${label}] "${p.name}" (còn hàng) KHÔNG bị gắn nhãn/làm mờ`,
      !card.includes("Hết hàng") && !/grayscale/.test(card),
      "sản phẩm còn hàng lại bị gắn nhãn hết hàng — false positive");
  }
}

// Trang chi tiết của một sp hết hàng: phải báo ngay, không mời thiết kế.
if (sold.length) {
  const p = sold[0];
  console.log(`\n-- trang chi tiết /san-pham/${p.slug} (hết hàng) --`);
  const html = await (await fetch(`${BASE}/san-pham/${p.slug}`, { cache: "no-store" })).text();
  check("báo 'Hết hàng' ngay khi mở trang", html.includes("Hết hàng"));
  check("KHÔNG còn hỏi 'Chọn phân loại để xem tồn kho'",
    !html.includes("Chọn phân loại để xem tồn kho"),
    "vẫn bắt khách bấm thử từng phân loại mới biết là hết");
  check("ẩn nút 'Bắt đầu thiết kế ngay'", !html.includes("Bắt đầu thiết kế ngay"));
  check("ẩn công cụ thiết kế", !html.includes('id="design-tool"'));
  check("có đường đi tiếp (link sang danh sách sản phẩm)",
    html.includes("Xem các sản phẩm khác"));
}

// Trang chi tiết sp còn hàng nhưng có phân loại hết: phải đánh dấu từng phân loại.
const partialProduct = avail.find(
  (p) => isVariantManaged(p) && p.variants.some((v) => isVariantOutOfStock(p, v))
);
if (partialProduct) {
  console.log(`\n-- trang chi tiết /san-pham/${partialProduct.slug} (còn hàng, có phân loại hết) --`);
  const html = await (await fetch(`${BASE}/san-pham/${partialProduct.slug}`, { cache: "no-store" })).text();
  const outNames = partialProduct.variants.filter((v) => isVariantOutOfStock(partialProduct, v)).map((v) => v.name);
  check("vẫn bán được (còn nút thiết kế)", html.includes("Bắt đầu thiết kế ngay"));
  check("phân loại hết hàng được đánh dấu line-through", /line-through/.test(html));
  check(`phân loại hết hàng vẫn hiện, không bị ẩn (${outNames.join(", ")})`,
    outNames.every((n) => html.includes(n)));
} else {
  console.log("\n-- bỏ qua test phân loại lẻ: không có sp còn hàng nào có variant hết --");
}

console.log(`\n==================== KẾT QUẢ ====================`);
console.log(`PASS: ${pass}   FAIL: ${fail}`);
console.log(fail === 0 ? "=> THÀNH CÔNG" : "=> THẤT BẠI");
process.exit(fail === 0 ? 0 : 1);
