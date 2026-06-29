import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  images: {
    remotePatterns: [new URL('https://i.scdn.co/**')],
  },
};

export default nextConfig;
