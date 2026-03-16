/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_COMPANY_NAME: process.env.COMPANY_NAME || "㈜움틀",
  },
};

module.exports = nextConfig;
