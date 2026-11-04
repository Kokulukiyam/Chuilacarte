import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir: process.env.NEXT_DIST_DIR || '.next',
  serverExternalPackages: ['@duckdb/node-api', '@duckdb/node-bindings', 'better-sqlite3', 'sharp', '@resvg/resvg-js', 'geotiff'],
  devIndicators: false,
  reactStrictMode: false,
  // Le projet n'utilise pas ESLint (vérification par `tsc --noEmit`) : ne pas
  // ramasser une configuration ESLint d'un dossier parent pendant le build.
  eslint: { ignoreDuringBuilds: true },
  // Racine fixée au projet (évite l'inférence sur un package-lock.json parent).
  outputFileTracingRoot: root,
};
export default nextConfig;
