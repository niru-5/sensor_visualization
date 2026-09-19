import { defineConfig } from 'vitest/config'

// Real-browser tests live outside `npm test` (they need Chrome and start a full
// dev server). Run them with `npm run test:e2e`.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['e2e/**/*.e2e.test.ts'],
    testTimeout: 30_000,
    hookTimeout: 120_000,
    fileParallelism: false,
  },
})
