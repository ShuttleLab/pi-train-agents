/**
 * Install script: copies the built extension to ~/.pi/agent/extensions/.
 * Usage: node scripts/install.mjs [--build]
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const EXT_DIR = join(homedir(), ".pi", "agent", "extensions");
const SRC = join(ROOT, "dist", "train-agents.ts");
const DST = join(EXT_DIR, "train-agents.ts");

if (!existsSync(SRC)) {
  console.error("dist/train-agents.ts not found. Run `npm run build` first.");
  process.exit(1);
}

mkdirSync(EXT_DIR, { recursive: true });
writeFileSync(DST, readFileSync(SRC, "utf8"));
console.log("Installed to %s", DST);