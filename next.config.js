/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // pdf-parse uses require() patterns incompatible with SWC bundler — keep as external
  serverExternalPackages: ["pdf-parse"],
  env: {
    NEXT_PUBLIC_COMPANY_NAME: process.env.COMPANY_NAME || "GRANTIQ",
  },
};

module.exports = nextConfig;
