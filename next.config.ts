import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  distDir: process.env.NEXT_BUILD_DIR || ".next",
  allowedDevOrigins: ["127.0.0.1"],
  /* config options here */
  reactCompiler: false,
};

export default nextConfig;
