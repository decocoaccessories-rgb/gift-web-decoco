// Bootstrap: đăng ký loader hook resolve "@/..." trước khi chạy test.
import { register } from "node:module";
import { pathToFileURL } from "node:url";

register("./_alias-hook.mjs", pathToFileURL("./scripts/"));
