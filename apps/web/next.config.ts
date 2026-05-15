import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@ballast/shared", "@ballast/ui"],
};

export default nextConfig;
