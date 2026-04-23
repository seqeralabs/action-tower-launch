/**
 * Vitest test setup file
 * Runs before each test to configure the environment
 */

import { vi, afterEach } from 'vitest';

// Set NODE_ENV to test
process.env.NODE_ENV = 'test';

// Set environment variable to avoid YAML validation error in @actions/core
process.env.INPUT_DEBUG = 'false';

// Mock GitHub Actions environment
process.env.GITHUB_ACTIONS = 'true';
process.env.GITHUB_REPOSITORY = 'test-user/test-repo';
process.env.GITHUB_SHA = 'abc123def456';
process.env.GITHUB_REF = 'refs/heads/main';
process.env.GITHUB_ACTOR = 'test-user';
process.env.GITHUB_WORKFLOW = 'Test Workflow';
process.env.GITHUB_RUN_ID = '12345';
process.env.GITHUB_RUN_NUMBER = '1';

// Suppress console output during tests (unless debugging)
const originalConsole = global.console;
global.console = {
  ...originalConsole,
  // Suppress info and debug logs during tests
  info: process.env.DEBUG_TESTS ? originalConsole.info : vi.fn(),
  debug: process.env.DEBUG_TESTS ? originalConsole.debug : vi.fn(),
  // Keep error and warn for debugging
  error: originalConsole.error,
  warn: originalConsole.warn,
  log: originalConsole.log
};

// Clean up environment variables after each test
afterEach(() => {
  // Remove any INPUT_* environment variables set by tests
  Object.keys(process.env).forEach(key => {
    if (key.startsWith('INPUT_')) {
      delete process.env[key];
    }
  });
});