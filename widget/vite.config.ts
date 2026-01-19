import { defineConfig } from 'vite'
import { resolve } from 'path'
import dts from 'vite-plugin-dts'

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'SynteraWidget',
      fileName: (format) => 'widget.js', // Output as widget.js (not widget.iife.js)
      formats: ['iife'], // Immediately Invoked Function Expression for script tag
    },
    rollupOptions: {
      output: {
        // Ensure single file output
        inlineDynamicImports: true,
        // Customize CSS file name
        assetFileNames: (assetInfo) => {
          if (assetInfo.name === 'style.css') {
            return 'widget.css'
          }
          return assetInfo.name || 'asset'
        },
      },
    },
    minify: 'terser',
    sourcemap: true,
  },
  plugins: [
    dts({
      insertTypesEntry: true,
    }),
  ],
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'production'),
  },
})

