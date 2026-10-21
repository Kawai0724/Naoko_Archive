import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['music-metadata'],
  poweredByHeader: false,
  devIndicators: false,
  outputFileTracingExcludes: {
    '/*': ['./data/**/*', './.test-build/**/*', './tests/**/*'],
  },
};

export default nextConfig;
