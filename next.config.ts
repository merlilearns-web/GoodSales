import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pg and xlsx are only used in route handlers; keep them out of the bundler.
  serverExternalPackages: ["pg", "xlsx"],
};

export default nextConfig;
