/**
 * Prints the address to open on a phone, as a link and a scannable code.
 *
 * A laptop's network address changes whenever Wi-Fi renews its lease or you
 * switch networks, which silently breaks a saved home-screen icon. Run this to
 * get the current address. Usage: npm run phone
 */
import { networkInterfaces, hostname } from "node:os";
import QRCode from "qrcode";

const port = process.env.PORT ?? "3000";
const addresses = Object.values(networkInterfaces()).flat()
  .filter((entry) => entry && entry.family === "IPv4" && !entry.internal)
  .map((entry) => entry.address);

if (addresses.length === 0) {
  console.error("No network address found. Is this computer on Wi-Fi?");
  process.exit(1);
}

const url = `http://${addresses[0]}:${port}`;
try {
  const response = await fetch(url, { signal: AbortSignal.timeout(4000) });
  console.log(`\n  The app is answering (${response.status}).`);
} catch {
  console.log("\n  The app is NOT answering. Start it with: npm run dev");
}

console.log(`\n  Open on your phone:  ${url}`);
if (hostname().endsWith(".local")) console.log(`  Or, stable across address changes:  http://${hostname()}:${port}`);
console.log("\n" + (await QRCode.toString(url, { type: "terminal", small: true })));
console.log("  Phone and computer must be on the same Wi-Fi.");
console.log("  If the page will not load, the network may block device-to-device");
console.log("  traffic. Use the phone's Personal Hotspot and run this again.\n");
await QRCode.toFile("/tmp/open-on-phone.png", url, { width: 420, margin: 2, color: { dark: "#0e0d63" } });
