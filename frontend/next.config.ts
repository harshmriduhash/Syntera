import type { NextConfig } from "next";
import path from "path";

// Bundle analyzer (conditional import for TypeScript)
let withBundleAnalyzer: (config: NextConfig) => NextConfig = (config) => config;
if (process.env.ANALYZE === 'true') {
  try {
    const bundleAnalyzer = require('@next/bundle-analyzer');
    withBundleAnalyzer = bundleAnalyzer({
      enabled: true,
    });
  } catch (error) {
    console.warn('Bundle analyzer not available. Install @next/bundle-analyzer to use it.');
  }
}

// Get absolute path to frontend directory
// This is where next/package.json is located (in node_modules/next/package.json)
const frontendRoot = path.resolve(__dirname);

const nextConfig: NextConfig = {
  // CRITICAL: Fix Turbopack root for pnpm monorepo
  // Problem: Turbopack finds pnpm-lock.yaml at monorepo root (../pnpm-lock.yaml)
  // and incorrectly infers the monorepo root as the project root
  // Solution: Explicitly set root to frontend/ where Next.js package actually is
  // 
  // Even with --webpack flag, Next.js 16.0.3 still validates Turbopack config
  // So we must set this correctly even when using webpack
  turbopack: {
    // Set root to frontend directory (absolute path)
    // From this root, Turbopack can find: node_modules/next/package.json
    // Without this, it looks from monorepo root and can't find Next.js
    root: frontendRoot,
  },
  // Skip type checking during build for faster builds
  // Run 'pnpm type-check' separately when needed
  typescript: {
    ignoreBuildErrors: true,
  },
  // CSS optimization and compilation
  // Ensure CSS is properly compiled with Tailwind v4
  experimental: {
    optimizeCss: true,
    // Enable instrumentation hook for Sentry
    instrumentationHook: true,
  },
  // Transpile shared package for Next.js
  transpilePackages: ['@syntera/shared'],
  // Image optimization configuration
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
      {
        protocol: 'https',
        hostname: '**.supabase.in',
        pathname: '/storage/v1/object/public/**',
      },
    ],
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },
  // Exclude server-only packages from client bundle
  // These packages use Node.js built-ins (dns, fs, etc.) that aren't available in browser
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Mark server-only packages as external for client-side builds
      config.resolve.fallback = {
        ...config.resolve.fallback,
        dns: false,
        net: false,
        tls: false,
        fs: false,
        child_process: false,
      }
      
      // Exclude server-only packages from client bundle
      config.externals = config.externals || []
      config.externals.push({
        'ioredis': 'commonjs ioredis',
        'mongoose': 'commonjs mongoose',
      })

      // CRITICAL: Aggressive bundle splitting for better code splitting
      if (config.optimization) {
        config.optimization.splitChunks = {
          chunks: 'all',
          minSize: 20000,
          maxSize: 244000, // ~240KB max chunk size
          cacheGroups: {
            // Framework chunk (React, React DOM, Next.js core)
            framework: {
              test: /[\\/]node_modules[\\/](react|react-dom|scheduler|next)[\\/]/,
              name: 'framework',
              priority: 40,
              enforce: true,
            },
            // React Query (used heavily but can be lazy loaded)
            reactQuery: {
              test: /[\\/]node_modules[\\/]@tanstack[\\/]react-query/,
              name: 'react-query',
              priority: 30,
              reuseExistingChunk: true,
            },
            // Radix UI components (large but used across app)
            radixUI: {
              test: /[\\/]node_modules[\\/]@radix-ui[\\/]/,
              name: 'radix-ui',
              priority: 25,
              reuseExistingChunk: true,
            },
            // Framer Motion (large, should be lazy loaded)
            framerMotion: {
              test: /[\\/]node_modules[\\/]framer-motion[\\/]/,
              name: 'framer-motion',
              priority: 20,
              reuseExistingChunk: true,
            },
            // React Flow (already lazy loaded, but ensure it's separate)
            reactFlow: {
              test: /[\\/]node_modules[\\/](reactflow|@reactflow)[\\/]/,
              name: 'reactflow',
              priority: 20,
              reuseExistingChunk: true,
            },
            // LiveKit (heavy, only used in voice call widget)
            livekit: {
              test: /[\\/]node_modules[\\/]livekit-client[\\/]/,
              name: 'livekit',
              priority: 20,
              reuseExistingChunk: true,
            },
            // Socket.io (used in chat)
            socketio: {
              test: /[\\/]node_modules[\\/]socket\.io-client[\\/]/,
              name: 'socketio',
              priority: 20,
              reuseExistingChunk: true,
            },
            // Supabase (used across app)
            supabase: {
              test: /[\\/]node_modules[\\/]@supabase[\\/]/,
              name: 'supabase',
              priority: 20,
              reuseExistingChunk: true,
            },
            // Large utility libraries (split individually)
            dateFns: {
              test: /[\\/]node_modules[\\/]date-fns[\\/]/,
              name: 'date-fns',
              priority: 15,
              reuseExistingChunk: true,
            },
            zod: {
              test: /[\\/]node_modules[\\/]zod[\\/]/,
              name: 'zod',
              priority: 15,
              reuseExistingChunk: true,
            },
            lucide: {
              test: /[\\/]node_modules[\\/]lucide-react[\\/]/,
              name: 'lucide-react',
              priority: 15,
              reuseExistingChunk: true,
            },
            // Other vendor libraries (smaller chunks)
            vendor: {
              test: /[\\/]node_modules[\\/]/,
              name(module: any) {
                // Extract package name from path
                const packageName = module.context.match(/[\\/]node_modules[\\/](.*?)([\\/]|$)/)?.[1]
                if (!packageName) return 'vendor'
                // Create smaller chunks for individual packages
                const sanitized = packageName.replace('@', '').replace('/', '-')
                return `vendor-${sanitized}`
              },
              priority: 10,
              minChunks: 1, // Changed from 2 to split more aggressively
              reuseExistingChunk: true,
            },
            // Default chunk for shared code
            default: {
              minChunks: 2,
              priority: -20,
              reuseExistingChunk: true,
            },
          },
        }
      }
    }
    return config
  },
};

export default withBundleAnalyzer(nextConfig);
