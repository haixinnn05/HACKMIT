/**
 * Refuses a commit that contains a secret.
 *
 * Pattern matching only catches key formats someone thought of in advance. This
 * reads the real values out of .env.local and looks for those exact strings in
 * whatever is staged, so it catches any key in any format. It prints file names
 * only, never the secret. Run by the pre-commit hook and by `npm run check:secrets`.
 */
import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const secrets = [];
for (const file of [".env.local", ".env"]) {
  if (!existsSync(file)) continue;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*["']?([^"'#\s]+)/);
    // Short values are settings such as model names, not credentials.
    if (match && match[2].length >= 16 && /KEY|TOKEN|SECRET|PASSWORD/.test(match[1])) secrets.push({ name: match[1], value: match[2] });
  }
}

const staged = execSync("git diff --cached --name-only --diff-filter=ACM", { encoding: "utf8" }).split("\n").filter(Boolean);
const all = process.argv.includes("--all")
  ? execSync("git ls-files -co --exclude-standard", { encoding: "utf8" }).split("\n").filter(Boolean)
  : staged;

const leaks = [];
for (const file of all) {
  if (/^\.env/.test(file) && !/\.example$/.test(file)) { leaks.push(`${file} is an env file and must not be committed`); continue; }
  let text;
  try { text = readFileSync(file, "utf8"); } catch { continue; }
  for (const secret of secrets) if (text.includes(secret.value)) leaks.push(`${file} contains the value of ${secret.name}`);
  if (/\b(sk-[A-Za-z0-9_-]{20,}|sk-ant-[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}|LLM[|_]\d{8,}[|_][A-Za-z0-9_-]{16,})\b/.test(text)) leaks.push(`${file} contains something shaped like an API key`);
}

if (leaks.length) {
  console.error("\n  Commit blocked: a secret would be committed.\n");
  for (const leak of [...new Set(leaks)]) console.error(`    ${leak}`);
  console.error("\n  Move it to .env.local, which git ignores.\n");
  process.exit(1);
}
console.log(`secrets check: ${all.length} files, ${secrets.length} known secret value(s), nothing leaked`);
