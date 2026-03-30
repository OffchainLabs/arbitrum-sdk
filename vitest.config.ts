import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['packages/*/tests/unit/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**'],
  },
})
