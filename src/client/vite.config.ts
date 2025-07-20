import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  esbuild: {
    jsx: 'automatic',
  },
  server: {
    host: true,
    port: 5041,
    proxy: {
      '/api': {
        target: 'http://localhost:5042',
        changeOrigin: true,
      },
      '/f': {
        target: 'http://localhost:5042',
        changeOrigin: true,
      }
    }
  }
}) 