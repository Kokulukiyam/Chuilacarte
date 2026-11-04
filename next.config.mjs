/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['@duckdb/node-api', '@duckdb/node-bindings', 'better-sqlite3', 'sharp', '@resvg/resvg-js', 'geotiff'],
  devIndicators: false,
  reactStrictMode: false,
};
export default nextConfig;
