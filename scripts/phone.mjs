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

// `npm run dev:https` serves https with a local certificate; plain `npm run dev` serves http.
// The certificate is self-signed, so this one probe does not verify it.
const answers = async (scheme) => {
  try {
    if (scheme === "https") process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
    const response = await fetch(`${scheme}://localhost:${port}/welcome`, { signal: AbortSignal.timeout(4000), redirect: "manual" });
    return response.status;
  } catch { return null; } finally { delete process.env.NODE_TLS_REJECT_UNAUTHORIZED; }
};
const scheme = (await answers("http")) ? "http" : (await answers("https")) ? "https" : null;
const url = `${scheme ?? "http"}://${addresses[0]}:${port}`;
console.log(scheme ? `\n  The app is answering over ${scheme}.` : "\n  The app is NOT answering. Start it with: npm run dev");
if (scheme === "http") console.log("  Live camera scanning needs https on a phone: stop the server and run  npm run dev:https\n  (over http, the Scan screen offers \"Take a photo of the code\" instead, which works).");
if (scheme === "https") console.log("  The certificate is local, so Safari will warn once: Show Details, then visit this website.");

console.log(`\n  Open on your phone:  ${url}`);
if (hostname().endsWith(".local")) console.log(`  Or, stable across address changes:  ${scheme ?? "http"}://${hostname()}:${port}`);
console.log("\n" + (await QRCode.toString(url, { type: "terminal", small: true })));
console.log("  Phone and computer must be on the same Wi-Fi.");
console.log("  If the page will not load, the network may block device-to-device");
console.log("  traffic. Use the phone's Personal Hotspot and run this again.\n");
await QRCode.toFile("/tmp/open-on-phone.png", url, { width: 420, margin: 2, color: { dark: "#0e0d63" } });
