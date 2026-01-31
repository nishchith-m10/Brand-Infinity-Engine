import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
      'utils': path.resolve(__dirname, './utils'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts', 'lib/**/*.test.ts'],
    testTimeout: 30000, // 30 second timeout for integration tests
    hookTimeout: 10000, // 10 second timeout for setup/teardown hooks
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'tests/',
        '**/*.d.ts',
        '**/*.config.*',
        'coverage/',
        'dist/',
        '.next/',
        'tmp_secret_scan_output/',
        'scripts/',
        'docs/'
      ],
      thresholds: {
        global: {
          branches: 70,
          functions: 70,
          lines: 70,
          statements: 70
        }
      }
    },
    setupFiles: ['tests/utils/test-setup.ts'],
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false,
        maxThreads: 4,
        minThreads: 1
      }
    },
    isolate: true,
    passWithNoTests: false,
    // bail: false, // Commented out due to type conflict
    retry: 1,
    sequence: {
      hooks: 'parallel',
      concurrent: false
    }
  },
});
