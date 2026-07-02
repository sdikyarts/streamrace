import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  allowedDevOrigins: ['192.168.18.163'],
  images: {
    remotePatterns: [new URL('https://i.scdn.co/**')],
    qualities: [75, 100],
  },
};

export default nextConfig;
