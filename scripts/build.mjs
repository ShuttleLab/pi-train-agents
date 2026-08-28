/**
 * Build script: bundles src/core.ts + src/train-agents.ts into a single
 * self-contained dist/train-agents.ts for Pi extension loading.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const core = readFileSync(join(ROOT, "src", "core.ts"), "utf8");
const main = readFileSync(join(ROOT, "src", "train-agents.ts"), "utf8");

// Strip `export ` from core (so functions become plain top-level declarations)
let coreBody = core.replace(/^export\s+(default\s+)?/gm, "");
// Remove core's node:fs import (train-agents.ts already imports every symbol core uses from node:fs → avoids duplicate declarations in the bundle)
coreBody = coreBody.replace(/^import\s*\{[^}]*\}\s*from\s*["']node:fs["'];?\s*\n/gm, "");

// Remove ONLY the `import { ... } from "./core.ts"` statement from the main file.
// Use string scanning so the regex cannot swallow sibling imports.
let mainBody = main;
const marker = 'from "./core.ts"';
const idx = mainBody.indexOf(marker);
if (idx !== -1) {
  const start = mainBody.lastIndexOf("import", idx);
  const end = mainBody.indexOf(";", idx) + 1;
  mainBody = mainBody.slice(0, start) + mainBody.slice(end);
}

const bundled = `/**
 * train-agents — Pi extension for gradient-descent maintenance of AGENTS.md.
 * AUTO-GENERATED: do not edit directly. Source at src/.
 */
${coreBody}
${mainBody}
`;

mkdirSync(join(ROOT, "dist"), { recursive: true });
writeFileSync(join(ROOT, "dist", "train-agents.ts"), bundled, "utf8");
console.log("Built dist/train-agents.ts (%d bytes)", Buffer.byteLength(bundled, "utf8"));

// P2#8：构建产物语法校验，防静默产出坏文件
import { spawnSync } from "node:child_process";
const check = spawnSync(process.execPath, ["--experimental-strip-types", "--check", join(ROOT, "dist", "train-agents.ts")], { encoding: "utf8" });
if (check.status !== 0) {
  console.error("❌ dist syntax check FAILED:");
  console.error(check.stderr || check.stdout);
  process.exit(1);
}
console.log("✅ dist syntax check passed");