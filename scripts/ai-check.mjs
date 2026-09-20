/**
 * Reports whether the AI features can run, and what to do if not.
 * Never prints the key. Usage: npm run ai:check
 */
import { existsSync, readFileSync } from "node:fs";

const env = {};
if (existsSync(".env.local")) {
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*["']?([^"'\n]*)["']?\s*$/);
    if (match) env[match[1]] = match[2].trim();
  }
}
const say = (mark, text) => console.log(`  ${mark}  ${text}`);
console.log("\nMozaic AI check\n");

if (env.ANTHROPIC_API_KEY && !env.LLM_API_KEY) {
  say("ok", "Anthropic key found. AI features are on after a restart.");
  process.exit(0);
}
if (!env.LLM_API_KEY) { say("--", "No key in .env.local. The app runs without AI and says so on screen."); process.exit(0); }
say("ok", "Key found in .env.local (not shown).");
if (!env.LLM_BASE_URL) { say("!!", "LLM_BASE_URL is empty, so the key is never sent anywhere. Set it to your provider's endpoint."); process.exit(1); }
say("ok", `Endpoint: ${env.LLM_BASE_URL}`);

const headers = { authorization: `Bearer ${env.LLM_API_KEY}`, "content-type": "application/json" };
let models = [];
try {
  const response = await fetch(`${env.LLM_BASE_URL}/models`, { headers, signal: AbortSignal.timeout(15000) });
  if (response.status === 401) { say("!!", "The provider rejected the key (401). Check it was copied exactly, including any | characters."); process.exit(1); }
  models = ((await response.json()).data ?? []).map((m) => m.id).filter(Boolean);
  say("ok", "The provider accepts the key.");
} catch (error) { say("!!", `Could not reach the endpoint: ${error.message}`); process.exit(1); }

if (models.length === 0) {
  say("!!", "This key's application has NO models enabled. That is set on the provider's side, not here.");
  console.log("\n      Fix: open the Meta Llama developer dashboard (llama.developer.meta.com), select the app");
  console.log("      this key belongs to, and enable a model. Then run this again.\n");
} else {
  say("ok", `Models you can use: ${models.join(", ")}`);
}

const model = env.LLM_MODEL || models[0];
if (!model) process.exit(1);
if (!env.LLM_MODEL) say("!!", `LLM_MODEL is empty. Add this line to .env.local:  LLM_MODEL=${model}`);

const reply = await fetch(`${env.LLM_BASE_URL}/chat/completions`, {
  method: "POST", headers, signal: AbortSignal.timeout(30000),
  body: JSON.stringify({ model, max_tokens: 8, messages: [{ role: "user", content: "Reply with one word: ready" }] }),
});
if (reply.ok) {
  say("ok", `"${model}" answered. ${env.LLM_MODEL ? "AI features are on. Restart npm run dev if it was already running." : "Set LLM_MODEL as above, then restart npm run dev."}`);
} else {
  say("!!", `"${model}" was refused (${reply.status}). It is not enabled for this application.`);
  process.exit(1);
}
console.log("");
