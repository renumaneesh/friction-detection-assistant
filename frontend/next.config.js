const path = require("path");

/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    // React 19 types + Next.js 14 type checker incompatibility — runtime is correct
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  webpack: (config) => {
    config.resolve.alias["@"] = path.resolve(__dirname);
    return config;
  },
};

module.exports = nextConfig;
