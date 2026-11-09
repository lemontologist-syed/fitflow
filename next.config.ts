import type { NextConfig } from "next";

// GitHub Pages serves this repository at https://<user>.github.io/<repo>/,
// so every URL needs the repository name as a prefix. Override with
// FITFLOW_BASE_PATH="" for a custom domain or root deployment.
const basePath = process.env.FITFLOW_BASE_PATH ?? "/fitflow";

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  basePath: basePath || undefined,
  images: { unoptimized: true },
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
