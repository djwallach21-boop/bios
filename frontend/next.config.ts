import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root to this app. A stray parent lockfile would
  // otherwise make Turbopack infer the wrong root and warn on every build.
  turbopack: { root: __dirname },
};

export default nextConfig;
