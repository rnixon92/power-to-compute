import type { NextConfig } from "next";

/**
 * A static site: prices and filings are fetched by `npm run refresh` and baked in at build time.
 * The build date is fixed here so the server-rendered page and the browser use the same "today".
 */
const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: "export",
  env: {
    NEXT_PUBLIC_TODAY: new Date().toISOString().slice(0, 10),
  },
};

export default nextConfig;
