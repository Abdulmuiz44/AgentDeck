import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron'
import renderer from 'vite-plugin-electron-renderer'
import path from 'path'

function nodeModulesPlugin() {
  return {
    name: 'node-modules-plugin',
    configResolved(config) {
      const externals = config.build.rollupOptions.external || []
      if (!Array.isArray(externals)) return
      if (!externals.includes('node-pty')) {
        config.build.rollupOptions.external = [...externals, 'node-pty']
      }
    }
  }
}

export default defineConfig({
  plugins: [
    nodeModulesPlugin(),
    react(),
    electron([
      {
        entry: 'src/main.ts',
        vite: {
          build: {
            outDir: 'dist',
            rollupOptions: {
              external: ['node-pty', 'electron'],
            },
          },
        },
      },
      {
        entry: 'src/preload.ts',
        vite: {
          build: {
            outDir: 'dist',
          },
        },
      },
    ]),
    renderer(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src/renderer'),
    },
  },
  server: {
    port: 5173,
  },
  build: {
    target: 'es2020',
    outDir: 'dist',
    emptyOutDir: true,
  },
})