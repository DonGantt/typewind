/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    swcPlugins: [['typewind-v4/swc', {}]],
  },
};

module.exports = nextConfig;
