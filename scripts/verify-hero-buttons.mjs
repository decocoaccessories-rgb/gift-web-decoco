import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const heroPath = resolve(__dirname, "..", "components", "sections", "HeroSection.tsx");
const src = readFileSync(heroPath, "utf8");

const checks = [
  {
    name: 'Button "Khám phá quà tặng" có hover:bg-white/90! (override [a]:hover:bg-primary/80)',
    pass: /hover:bg-white\/90!/.test(src),
  },
  {
    name: 'Button "Tìm hiểu thêm" có bg-transparent (override bg-background của variant outline)',
    pass: /rounded-full px-8 bg-transparent border-white text-white/.test(src),
  },
  {
    name: 'Không còn class hover:bg-white/90 không có ! (đảm bảo đã thay thế)',
    pass: !/hover:bg-white\/90(?!!)/.test(src),
  },
];

let failed = 0;
for (const c of checks) {
  console.log(`${c.pass ? "PASS" : "FAIL"} - ${c.name}`);
  if (!c.pass) failed++;
}

if (failed > 0) {
  console.error(`\n${failed} kiểm tra thất bại.`);
  process.exit(1);
}
console.log("\nTất cả kiểm tra đều qua.");
