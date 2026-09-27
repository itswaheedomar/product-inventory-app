import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    allowedHosts: true,
    hmr: { overlay: false },
    watch: { usePolling: true, interval: 100 },
    optimizeDeps: { force: true },
    build: { outDir: 'dist', sourcemap: false, chunkSizeWarningLimit: 1500 },
  },
})
