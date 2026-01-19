import { build } from 'esbuild'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const isProduction = process.env.NODE_ENV === 'production'

build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  outfile: 'dist/index.js',
  platform: 'node',
  target: 'node20',
  format: 'esm',
  sourcemap: !isProduction,
  minify: isProduction,
  external: [
    // Don't bundle these - they're runtime dependencies
    'express',
    'cors',
    'helmet',
    'compression',
    'express-rate-limit',
    'dotenv',
    'winston',
    'openai',
    '@supabase/supabase-js',
    'livekit-server-sdk',
    'livekit-client',
    'ws',
    'zod',
    'mongoose',
    'ioredis',
  ],
  resolveExtensions: ['.ts', '.js', '.json'],
  alias: {
    '@syntera/shared': join(__dirname, '../../shared/src'),
  },
  banner: {
    js: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);",
  },
  logLevel: 'info',
}).catch(() => process.exit(1))

