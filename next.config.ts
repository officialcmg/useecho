import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'raw.githubusercontent.com',
      },
      {
        protocol: 'https',
        hostname: 'haven.accioly.social',
      },
      {
        protocol: 'https',
        hostname: 'docs.ipfs.tech',
      },
    ],
  },
};

export default nextConfig;
