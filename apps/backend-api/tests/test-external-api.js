/**
 * External API Integration Test Runner
 * Simplified test runner for external API integration testing
 * with environment setup and configuration options.
 */

const { spawn } = require('child_process');
const path = require('path');

// Test configuration
const TEST_OPTIONS = {
  // Skip real API calls by default in CI/automated testing
  skipRealAPI: process.env.CI === 'true' || process.env.NODE_ENV === 'test',
  
  // Enable webhook testing (requires test webhook secrets)
  testWebhooks: process.env.NODE_ENV === 'development',
  
  // Run performance tests (only in specific environments)
  performanceTests: process.env.NODE_ENV === 'development',
  
  // Test timeout
  timeout: 60000 // 1 minute
};

console.log('🧪 External API Integration Test Configuration:');
console.log(`   Skip Real APIs: ${TEST_OPTIONS.skipRealAPI}`);
console.log(`   Test Webhooks: ${TEST_OPTIONS.testWebhooks}`);
console.log(`   Performance Tests: ${TEST_OPTIONS.performanceTests}`);
console.log(`   Timeout: ${TEST_OPTIONS.timeout / 1000}s`);
console.log('');

// Set environment variables for tests
process.env.SKIP_REAL_API_TESTS = TEST_OPTIONS.skipRealAPI.toString();
process.env.TEST_WEBHOOKS = TEST_OPTIONS.testWebhooks.toString();
process.env.RUN_PERFORMANCE_TESTS = TEST_OPTIONS.performanceTests.toString();
process.env.NODE_ENV = 'test';

// Database configuration for testing
process.env.MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/intellicare_test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';

// API configuration for testing (use test keys if available)
if (process.env.NODE_ENV === 'development') {
  console.log('ℹ️  Using development API keys for testing');
} else {
  console.log('ℹ️  Using mock responses (no real API calls)');
}

// Webhook test configuration
if (TEST_OPTIONS.testWebhooks) {
  process.env.WEBHOOK_SECRET_FDA = 'test-fda-webhook-secret';
  process.env.WEBHOOK_SECRET_CMS = 'test-cms-webhook-secret';
  process.env.WEBHOOK_SECRET_NIH = 'test-nih-webhook-secret';
}

// Run Jest with specific configuration
const jestArgs = [
  '--testMatch=**/tests/integration/external-api.test.js',
  '--verbose',
  '--detectOpenHandles',
  '--forceExit',
  `--testTimeout=${TEST_OPTIONS.timeout}`
];

// Add coverage if requested
if (process.argv.includes('--coverage')) {
  jestArgs.push('--coverage');
  jestArgs.push('--collectCoverageFrom=services/drugInformationService.js');
  jestArgs.push('--collectCoverageFrom=services/providerDirectoryService.js');
  jestArgs.push('--collectCoverageFrom=services/clinicalResearchService.js');
  jestArgs.push('--collectCoverageFrom=services/regulatoryComplianceService.js');
  jestArgs.push('--collectCoverageFrom=services/webhookManagementService.js');
  jestArgs.push('--collectCoverageFrom=services/externalApiGatewayService.js');
  jestArgs.push('--collectCoverageFrom=routes/external.js');
  jestArgs.push('--collectCoverageFrom=routes/webhooks.js');
}

// Run specific test suites if requested
const suiteArg = process.argv.find(arg => arg.startsWith('--suite='));
if (suiteArg) {
  const suite = suiteArg.split('=')[1];
  jestArgs.push(`--testNamePattern="${suite}"`);
  console.log(`🎯 Running specific test suite: ${suite}`);
}

console.log('🚀 Starting External API Integration Tests...\n');

const jest = spawn('npx', ['jest', ...jestArgs], {
  stdio: 'inherit',
  env: process.env
});

jest.on('close', (code) => {
  console.log(`\n✅ Tests completed with exit code: ${code}`);
  
  if (code === 0) {
    console.log('🎉 All external API integration tests passed!');
    
    // Print summary
    console.log('\n📊 Test Summary:');
    console.log(`   Drug Information Service: Tested`);
    console.log(`   Provider Directory Service: Tested`);
    console.log(`   Clinical Research Service: Tested`);
    console.log(`   Regulatory Compliance Service: Tested`);
    console.log(`   Webhook Management: ${TEST_OPTIONS.testWebhooks ? 'Tested' : 'Skipped'}`);
    console.log(`   External API Gateway: Tested`);
    console.log(`   Real API Calls: ${!TEST_OPTIONS.skipRealAPI ? 'Tested' : 'Skipped'}`);
    console.log(`   Performance Tests: ${TEST_OPTIONS.performanceTests ? 'Tested' : 'Skipped'}`);
    
  } else {
    console.log('❌ Some tests failed. Check the output above for details.');
    
    // Provide troubleshooting tips
    console.log('\n🔧 Troubleshooting Tips:');
    console.log('   1. Ensure MongoDB is running');
    console.log('   2. Check API keys are configured (for real API tests)');
    console.log('   3. Verify webhook secrets are set (for webhook tests)');
    console.log('   4. Check network connectivity for external API calls');
    console.log('   5. Run with --verbose for more detailed output');
  }
  
  process.exit(code);
});

jest.on('error', (error) => {
  console.error('❌ Failed to start tests:', error);
  process.exit(1);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n⏹️  Test execution interrupted');
  jest.kill('SIGINT');
});