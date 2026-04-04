import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  resolve: {
    alias: {
      '@arbitrum/core': path.resolve(__dirname, 'packages/core/src/index.ts'),
      '@arbitrum/ethers5': path.resolve(__dirname, 'packages/ethers5/src/index.ts'),
    },
  },
  test: {
    environment: 'node',
    globals: true,
    include: ['**/tests/unit/**/*.test.ts', '**/tests/*.test.ts', '**/tests/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**'],
    testTimeout: 30_000,
  },
})
