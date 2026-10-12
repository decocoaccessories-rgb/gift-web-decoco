// Cho phép chạy test script bằng Node thuần trên mã nguồn dùng alias `@/...`
// của tsconfig. Dùng kèm: node --experimental-strip-types --import ./scripts/alias-hook.mjs <file>
import { registerHooks } from "node:module";

const projectRoot = new URL("../", import.meta.url);

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith("@/")) {
      const base = new URL(specifier.slice(2), projectRoot).href;
      // TypeScript cho phép import không đuôi; Node thì không.
      for (const candidate of [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`]) {
        try {
          return nextResolve(candidate, context);
        } catch {
          // thử đuôi tiếp theo
        }
      }
    }
    return nextResolve(specifier, context);
  },
});
