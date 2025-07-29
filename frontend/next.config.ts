import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Disable linting and type checking during builds
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  // Optimize for development performance
  reactStrictMode: true,

  // Configure module transpilation
  transpilePackages: [
    '@solana/wallet-adapter-react',
    '@solana/wallet-adapter-react-ui',
    '@solana/wallet-adapter-base',
    '@solana/wallet-adapter-wallets',
  ],

  // Turbopack configuration (now stable in Next.js 15.3+)
  turbopack: {
    rules: {
      '*.svg': {
        loaders: ['@svgr/webpack'],
        as: '*.js',
      },
    },
  },

  // Optimize package imports
  experimental: {
    optimizePackageImports: [
      '@solana/web3.js',
      '@coral-xyz/anchor',
      'lucide-react',
      '@radix-ui/react-dialog',
      '@radix-ui/react-dropdown-menu',
      '@tanstack/react-query',
      '@web3icons/react',
    ],
  },
};

export default nextConfig;
