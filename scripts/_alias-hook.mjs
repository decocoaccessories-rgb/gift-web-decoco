// Loader hook: resolve "@/..." như tsconfig paths để chạy test .mjs bằng node trần.
import { pathToFileURL } from "node:url";
import { resolve as resolvePath } from "node:path";
import { existsSync } from "node:fs";

const ROOT = process.cwd();

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    let abs = resolvePath(ROOT, specifier.slice(2));
    if (!/\.[a-z]+$/i.test(abs)) {
      if (existsSync(abs + ".ts")) abs += ".ts";
      else if (existsSync(abs + ".tsx")) abs += ".tsx";
      else if (existsSync(resolvePath(abs, "index.ts"))) abs = resolvePath(abs, "index.ts");
    }
    return nextResolve(pathToFileURL(abs).href, context);
  }
  return nextResolve(specifier, context);
}
