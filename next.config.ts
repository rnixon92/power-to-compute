import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async redirects() {
    return [{ source: "/market", destination: "/demand", permanent: true }];
  },
};

export default nextConfig;
