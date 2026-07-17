/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The Go backend rejects cross-origin WS upgrades but allows requests with
// no Origin header, so the proxy strips Origin on upgrade requests.
const backendProxy = {
  '/auth': { target: 'http://localhost:8080', changeOrigin: true },
  '/games': {
    target: 'http://localhost:8080',
    changeOrigin: true,
    ws: true,
    configure(proxy: { on(ev: string, cb: (proxyReq: { removeHeader(n: string): void }) => void): void }) {
      proxy.on('proxyReqWs', proxyReq => proxyReq.removeHeader('origin'))
    },
  },
}

export default defineConfig({
  plugins: [react()],
  server: { port: 5199, proxy: backendProxy },
  preview: { port: 5199, proxy: backendProxy },
  test: {
    environment: 'jsdom',
    setupFiles: './src/test-setup.ts',
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
