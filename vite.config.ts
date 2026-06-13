import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron'
import { fileURLToPath } from 'url'
import path from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [
    react(),
    electron({
      entry: 'electron/main.ts',
      onstart(options) {
        options.startup()
      },
      vite: {
        build: {
          outDir: 'dist-electron',
          rollupOptions: {
            output: {
              format: 'cjs',
              entryFileNames: '[name].js',
            }
          }
        }
      }
    }),
    electron({
      entry: 'electron/preload.ts',
      onstart(options) {
        options.reload()
      },
      vite: {
        build: {
          outDir: 'dist-electron',
          ssr: true,
          rollupOptions: {
            output: {
              format: 'cjs',
              entryFileNames: '[name].js',
            }
          }
        }
      }
    })
  ],
  build: {
    outDir: 'dist-renderer',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    }
  }
})
