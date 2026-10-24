import type { NextConfig } from "next";

/**
 * A static site: prices and filings are fetched by `npm run refresh` and baked in at build time.
 * The build date is fixed here so the server-rendered page and the browser use the same "today".
 * On GitHub Pages the site lives under /<repo>, which the deploy workflow passes in as PAGES_BASE_PATH.
 */
const basePath = process.env.PAGES_BASE_PATH || "";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: "export",
  basePath,
  // Every page becomes a folder with an index.html, which static hosts serve under a subpath without help.
  trailingSlash: true,
  env: {
    NEXT_PUBLIC_TODAY: new Date().toISOString().slice(0, 10),
  },
};

export default nextConfig;
