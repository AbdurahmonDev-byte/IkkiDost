/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    '@ikki-dost/shared-types',
    '@ikki-dost/validation',
    '@ikki-dost/api-client',
    '@ikki-dost/utils',
    '@ikki-dost/design-system',
  ],
  webpack: (config) => {
    config.resolve.extensionAlias = { '.js': ['.ts', '.tsx', '.js', '.jsx'] };
    return config;
  },
};

module.exports = nextConfig;
