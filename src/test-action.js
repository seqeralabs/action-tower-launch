#!/usr/bin/env node

/**
 * Simple test script for the JavaScript action
 * This simulates the GitHub Actions environment for local testing
 */

import { run } from './index.js';
import * as core from '@actions/core';

// Mock GitHub Actions environment variables
process.env.INPUT_ACCESS_TOKEN = process.env.TEST_ACCESS_TOKEN || 'test-token';
process.env.INPUT_PIPELINE = 'https://github.com/nf-core/hello';
process.env.INPUT_DEBUG = 'true';
process.env.INPUT_WAIT = 'false';
process.env.INPUT_API_ENDPOINT = 'https://api.cloud.seqera.io';

// Mock GitHub repository
process.env.GITHUB_REPOSITORY = 'test-user/test-repo';

// Override core functions for testing
const originalSetOutput = core.setOutput;
const originalSetFailed = core.setFailed;
const originalInfo = core.info;

core.setOutput = (name, value) => {
  console.log(`[OUTPUT] ${name}=${value}`);
};

core.setFailed = (message) => {
  console.log(`[FAILED] ${message}`);
  process.exit(1);
};

core.info = (message) => {
  console.log(`[INFO] ${message}`);
};

async function test() {
  console.log('🧪 Testing JavaScript Action');
  console.log('================================');
  
  if (!process.env.TEST_ACCESS_TOKEN) {
    console.log('⚠️  No TEST_ACCESS_TOKEN provided - will test with dummy token (expect auth failure)');
    console.log('   Set TEST_ACCESS_TOKEN environment variable for real testing');
  }
  
  try {
    await run();
  } catch (error) {
    console.log('❌ Test failed (expected if using dummy token)');
    console.log(`Error: ${error.message}`);
  }
  
  console.log('🏁 Test completed');
}

// Run the test
test().catch(console.error);