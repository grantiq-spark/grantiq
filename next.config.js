/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ['pdf-parse'],
  env: {
    NEXT_PUBLIC_COMPANY_NAME: process.env.COMPANY_NAME || "㎌움틀",
  },
};

module.exports = nextConfig;
