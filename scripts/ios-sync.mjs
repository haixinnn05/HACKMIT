/**
 * Points the iOS shell at a server and syncs the Xcode project.
 *
 *   npm run ios:sync                          this computer's current Wi-Fi address
 *   npm run ios:sync -- https://mozaic.app    a deployed server
 *
 * The address is baked into the app at sync time. A laptop's address changes
 * when Wi-Fi renews its lease, so re-run this and rebuild if the app shows its
 * "can't reach its server" screen. A deployed address never needs that.
 */
import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { networkInterfaces } from "node:os";

const port = process.env.PORT ?? "3000";
let url = process.argv[2];

if (!url) {
  const address = Object.values(networkInterfaces()).flat()
    .find((entry) => entry && entry.family === "IPv4" && !entry.internal)?.address;
  if (!address) {
    console.error("No network address found. Join Wi-Fi, or pass a server URL.");
    process.exit(1);
  }
  url = `http://${address}:${port}`;
}

try {
  const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
  console.log(`\n  ${url} is answering (${response.status}).`);
} catch {
  console.log(`\n  Warning: ${url} is not answering. Start it with \`npm run dev\` before launching the app.`);
}

// The offline page needs the address too, so its retry button can return to it.
writeFileSync("native-shell/server-url.js", `window.MOZAIC_SERVER_URL = ${JSON.stringify(url)};\n`);

execSync("npx cap sync ios", { stdio: "inherit", env: { ...process.env, MOZAIC_SERVER_URL: url } });
console.log(`\n  The iOS app now loads ${url}`);
console.log("  Next: npm run ios:open, pick your iPhone, press Run.\n");
