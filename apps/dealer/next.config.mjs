import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  productionBrowserSourceMaps: true,
  transpilePackages: ["zod"],
  webpack: (config) => {
    // Resolve zod from monorepo root node_modules for deterministic workspace builds
    config.resolve.alias = {
      ...config.resolve.alias,
      zod: path.join(__dirname, "..", "..", "node_modules", "zod"),
    };
    return config;
  },
};

export default nextConfig;


