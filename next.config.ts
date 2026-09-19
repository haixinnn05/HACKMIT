import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // better-sqlite3 is a native module; it must not be bundled.
  serverExternalPackages: ["better-sqlite3"],
  // Pin the workspace root so a stray lockfile in a parent directory is ignored.
  turbopack: { root: path.resolve(import.meta.dirname) },
};

export default nextConfig;
