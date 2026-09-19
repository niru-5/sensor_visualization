import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // Agent-harness state (task logs, delegate output) is rewritten constantly
    // and is never part of the app; don't let the watcher see it.
    watch: { ignored: ['**/.pi/**'] },
    proxy: {
      '/api': 'http://localhost:8787',
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'api/**/*.test.ts', 'scripts/**/*.test.ts'],
  },
})
