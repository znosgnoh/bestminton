import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "splitwise.s3.amazonaws.com",
        pathname: "/uploads/**",
      },
      {
        protocol: "https",
        hostname: "s3.amazonaws.com",
        pathname: "/splitwise/uploads/**",
      },
      {
        protocol: "https",
        hostname: "secure.splitwise.com",
        pathname: "/uploads/user/**",
      },
      {
        protocol: "https",
        hostname: "*.public.blob.vercel-storage.com",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
