import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Test environment
    environment: 'node',
    
    // Test file patterns
    include: ['src/**/*.{test,spec}.js'],
    exclude: ['node_modules/**', 'dist/**'],
    
    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      include: ['src/**/*.js'],
      exclude: ['src/**/__tests__/**', 'src/**/*.test.js', 'dist/**'],
      thresholds: {
        branches: 70,
        functions: 70,
        lines: 70,
        statements: 70
      }
    },
    
    // Clear mocks between tests
    clearMocks: true,
    
    // Test timeout
    testTimeout: 10000,
    
    // Setup files
    setupFiles: ['./src/__tests__/setup.js']
  }
});