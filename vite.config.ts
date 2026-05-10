import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron'
import renderer from 'vite-plugin-electron-renderer'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    electron([
      {
        // Main process
        entry: 'src/main.ts',
        vite: {
          build: {
            outDir: 'dist',
          },
        },
      },
      {
        // --- Ủýêðæéòóòþýõïôùæþéòôùþðàûú
        entry: 'src/preload.ts',
        onstart (options) {
          // Automatically recompile the main process when the preloads change
          options.watch(['src/preload.ts'])
        },
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
    port: 5173, // Default Vite dev server port
  },
  build: {
    // In Electron, you can set target to 'nodeN' or 'esN' to match your Electron build target
    // Example: target: 'node18', // for Electron 18
    // Electron's Node.js version varies, check your Electron version's Node.js compatibility.
    target: 'es2020', // Use a more modern target compatible with recent Electron versions
    outDir: 'dist',
    emptyOutDir: true,
  },
})
