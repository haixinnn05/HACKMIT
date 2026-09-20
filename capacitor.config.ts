import type { CapacitorConfig } from "@capacitor/cli";

/**
 * The native iOS shell.
 *
 * Mozaic renders on a server: its database, search and eligibility rules all
 * run there, so the app cannot be exported to static files and bundled. The
 * shell therefore loads the running server by URL, and every screen, test and
 * line of logic stays exactly as it is on the web.
 *
 * The URL is baked into the iOS project when `npm run ios:sync` runs. That
 * script fills MOZAIC_SERVER_URL with this computer's current network address,
 * or with a deployed address if you pass one.
 */
const serverUrl = process.env.MOZAIC_SERVER_URL ?? "http://localhost:3000";

const config: CapacitorConfig = {
  appId: "app.mozaic.demo",
  appName: "Mozaic",
  webDir: "native-shell",
  backgroundColor: "#fafbfe",
  server: {
    url: serverUrl,
    // Plain http is needed to reach a laptop on the local network. A deployed
    // https address does not use it.
    cleartext: serverUrl.startsWith("http://"),
    // Shown when the server cannot be reached, instead of a blank screen.
    errorPath: "offline.html",
  },
  ios: {
    // The web app already handles the notch and home indicator with safe-area
    // insets, so the shell must not add its own.
    contentInset: "never",
    backgroundColor: "#fafbfe",
  },
};

export default config;
