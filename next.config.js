/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    instrumentationHook: true,
  },
  webpack: (config) => {
    config.externals = [...(config.externals || []), {
      'ws': 'commonjs ws',
      'playwright': 'commonjs playwright',
      'chokidar': 'commonjs chokidar',
      'canvas': 'commonjs canvas',
    }];
    return config;
  },
};

module.exports = nextConfig;
