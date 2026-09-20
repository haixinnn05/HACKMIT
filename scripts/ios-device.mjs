/**
 * Builds, signs and installs the iOS shell on a connected iPhone.
 *
 *   npm run ios:device
 *
 * The phone must be plugged in, unlocked, and in Developer Mode. The signing
 * team comes from MOZAIC_IOS_TEAM, or from the team Xcode is already signed in
 * with, so no team ID is written into the repository.
 */
import { execSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const sh = (cmd) => execSync(cmd, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
const fail = (message) => { console.error(`\n  ${message}\n`); process.exit(1); };

let team = process.env.MOZAIC_IOS_TEAM;
if (!team) {
  try { team = sh("defaults read com.apple.dt.Xcode IDEProvisioningTeamByIdentifier").match(/teamID = ([A-Z0-9]{10});/)?.[1]; } catch { /* none */ }
}
if (!team) fail("No signing team found. Sign in to Xcode (Settings, Accounts) or set MOZAIC_IOS_TEAM.");

const listing = path.join(mkdtempSync(path.join(tmpdir(), "mozaic-")), "devices.json");
sh(`xcrun devicectl list devices --json-output ${listing}`);
const device = JSON.parse(readFileSync(listing, "utf8")).result.devices
  .find((d) => d.hardwareProperties?.platform === "iOS" && d.connectionProperties?.pairingState === "paired");
if (!device) fail("No paired iPhone found. Plug it in, unlock it, and tap Trust.");
console.log(`\n  Phone: ${device.deviceProperties.name} (${device.hardwareProperties.marketingName})`);

console.log("  Pointing the app at this computer...");
execSync("node scripts/ios-sync.mjs", { stdio: "inherit" });

console.log("  Building and signing (a minute or two the first time)...");
const derived = "/tmp/mozaic-dd-device";
const build = spawnSync("xcodebuild", [
  "-project", "ios/App/App.xcodeproj", "-scheme", "App", "-configuration", "Debug",
  "-destination", "generic/platform=iOS", "-derivedDataPath", derived, "-allowProvisioningUpdates",
  `DEVELOPMENT_TEAM=${team}`, "CODE_SIGN_STYLE=Automatic", "build",
], { encoding: "utf8", maxBuffer: 1 << 28 });
if (!/BUILD SUCCEEDED/.test(build.stdout)) {
  console.error((build.stdout + build.stderr).split("\n").filter((l) => /error:/.test(l)).slice(0, 8).join("\n"));
  fail("The build failed. Open it in Xcode with `npm run ios:open` to see the full error.");
}

console.log("  Installing...");
const app = `${derived}/Build/Products/Debug-iphoneos/App.app`;
const install = spawnSync("xcrun", ["devicectl", "device", "install", "app", "--device", device.identifier, app], { encoding: "utf8" });
const output = install.stdout + install.stderr;
if (/device is locked|DeviceLocked/i.test(output)) fail("The phone is locked. Unlock it, keep the screen on, and run this again.");
if (install.status !== 0) { console.error(output.split("\n").slice(-8).join("\n")); fail("The install failed."); }

spawnSync("xcrun", ["devicectl", "device", "process", "launch", "--device", device.identifier, "app.mozaic.demo"], { encoding: "utf8" });
console.log(`
  Installed. Mozaic is on the phone's home screen.

  First launch only:
    1. If iOS says "Untrusted Developer": Settings, General, VPN & Device
       Management, tap your Apple ID, Trust.
    2. Allow the "find devices on your local network" prompt. The app loads
       from this computer, so it needs that permission.

  A free Apple ID signs apps for 7 days. Run this again to renew.
`);
