import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const root = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    environment: 'node',
    include: ['**/*.test.ts'],
  },
  resolve: {
    alias: {
      // Next.js build-time-only markers — stub so server modules unit-test cleanly.
      'server-only': resolve(root, 'test/stubs/empty.ts'),
      'client-only': resolve(root, 'test/stubs/empty.ts'),
      // Mirror the tsconfig "@/*" path alias for tests.
      '@': root,
    },
  },
});
