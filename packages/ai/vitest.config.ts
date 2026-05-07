import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    env: {
      MINIMAX_TIMEOUT_MS: '50',
    },
  },
})
