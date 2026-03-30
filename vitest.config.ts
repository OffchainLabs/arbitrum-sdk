import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['**/tests/unit/**/*.test.ts', '**/tests/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**'],
  },
})
