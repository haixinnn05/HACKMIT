import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // better-sqlite3 is a native module; it must not be bundled.
  serverExternalPackages: ["better-sqlite3"],
  // The dev badge sits on top of the bottom navigation during demos.
  devIndicators: false,
  // The staff screens moved into the research-team face. Old links keep working.
  async redirects() {
    return [
      { source: "/coordinator", destination: "/clinic/inbox", permanent: false },
      { source: "/coordinator/:id", destination: "/clinic/inbox/:id", permanent: false },
    ];
  },
  // Lets a phone on the same network use the dev server. Next blocks its dev
  // scripts for any host but localhost, which leaves the page visible but
  // unresponsive. These cover private address ranges and Bonjour names only.
  allowedDevOrigins: ["*.local", "10.*.*.*", "192.168.*.*", "172.*.*.*"],
  // Pin the workspace root so a stray lockfile in a parent directory is ignored.
  turbopack: { root: path.resolve(import.meta.dirname) },
};

export default nextConfig;
