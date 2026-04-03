/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    instrumentationHook: true,
  },
  webpack: (config) => {
    config.externals = [...(config.externals || []), {
      'ws': 'commonjs ws',
    }];
    return config;
  },
};

export default nextConfig;
