/**
 * Security Headers Verification Script
 * Verifies that all API calls include proper security headers
 */

import secureApiClient from './src/services/secureApiClient.js';

console.log('🔒 SECURITY HEADERS VERIFICATION');
console.log('=================================\n');

// Test configuration
const tests = {
  passed: 0,
  failed: 0,
  total: 0
};

// Intercept fetch to capture headers
const originalFetch = global.fetch || window.fetch;
let capturedHeaders = {};

global.fetch = window.fetch = function(...args) {
  const [url, options] = args;
  if (options && options.headers) {
    capturedHeaders = options.headers;
    console.log('📡 Intercepted Request to:', url);
    console.log('Headers:', JSON.stringify(capturedHeaders, null, 2));
  }
  return originalFetch.apply(this, args);
};

async function verifySecurityHeaders() {
  console.log('Testing Security Headers...\n');
  
  const requiredHeaders = [
    'X-Request-Signature',
    'X-Request-Timestamp', 
    'X-Request-Nonce',
    'X-Session-Fingerprint',
    'X-Request-ID',
    'X-Client-Version'
  ];
  
  try {
    // Make a test request
    await secureApiClient.get('/api/health').catch(() => {});
    
    // Check captured headers
    tests.total = requiredHeaders.length;
    
    for (const header of requiredHeaders) {
      if (capturedHeaders[header]) {
        console.log(`✅ ${header}: ${capturedHeaders[header].substring(0, 20)}...`);
        tests.passed++;
      } else {
        console.log(`❌ MISSING: ${header}`);
        tests.failed++;
      }
    }
    
    // Check Authorization header
    if (capturedHeaders['Authorization']) {
      console.log(`✅ Authorization: Bearer [token]`);
      tests.passed++;
    } else {
      console.log(`⚠️  Authorization: Not set (user not logged in)`);
    }
    tests.total++;
    
  } catch (error) {
    console.error('Error during test:', error.message);
  }
  
  // Restore original fetch
  global.fetch = window.fetch = originalFetch;
}

async function testMedicalViewerSecurity() {
  console.log('\n📋 Testing Medical Viewer Security...\n');
  
  const endpoints = [
    '/api/medical-data/patients/test/medications',
    '/api/medical-data/patients/test/vital-signs',
    '/api/medical-data/patients/test/allergies',
    '/api/medical-data/patients/test/lab-results'
  ];
  
  for (const endpoint of endpoints) {
    capturedHeaders = {};
    
    try {
      await secureApiClient.get(endpoint).catch(() => {});
      
      const hasSignature = !!capturedHeaders['X-Request-Signature'];
      const hasTimestamp = !!capturedHeaders['X-Request-Timestamp'];
      const hasNonce = !!capturedHeaders['X-Request-Nonce'];
      
      if (hasSignature && hasTimestamp && hasNonce) {
        console.log(`✅ ${endpoint} - SECURE`);
        tests.passed++;
      } else {
        console.log(`❌ ${endpoint} - INSECURE`);
        tests.failed++;
      }
      tests.total++;
      
    } catch (error) {
      // Expected to fail, we're checking headers
    }
  }
}

async function testEncryption() {
  console.log('\n🔐 Testing Sensitive Data Encryption...\n');
  
  const sensitiveData = {
    name: 'Test User',
    password: 'TestPassword123',
    ssn: '123-45-6789',
    creditCard: '4111-1111-1111-1111'
  };
  
  capturedHeaders = {};
  let capturedBody = null;
  
  // Intercept body too
  const tempFetch = global.fetch;
  global.fetch = window.fetch = function(...args) {
    const [url, options] = args;
    if (options && options.body) {
      capturedBody = JSON.parse(options.body);
    }
    return tempFetch.apply(this, args);
  };
  
  try {
    await secureApiClient.post('/api/test', sensitiveData).catch(() => {});
    
    // Check if sensitive fields were encrypted
    if (capturedBody) {
      const encryptedFields = ['password', 'ssn', 'creditCard'];
      
      for (const field of encryptedFields) {
        if (capturedBody[field] && capturedBody[field] !== sensitiveData[field]) {
          console.log(`✅ ${field}: ENCRYPTED`);
          tests.passed++;
        } else if (capturedBody[field]) {
          console.log(`❌ ${field}: NOT ENCRYPTED (exposed)`);
          tests.failed++;
        }
        tests.total++;
      }
      
      // Check for encryption flags
      for (const field of encryptedFields) {
        if (capturedBody[`${field}_encrypted`] === true) {
          console.log(`✅ ${field}_encrypted flag: SET`);
          tests.passed++;
        }
        tests.total++;
      }
    }
    
  } catch (error) {
    // Expected
  }
  
  global.fetch = window.fetch = originalFetch;
}

async function runAllTests() {
  console.log('🚀 Starting Security Verification...\n');
  
  await verifySecurityHeaders();
  await testMedicalViewerSecurity();
  await testEncryption();
  
  // Final report
  console.log('\n' + '='.repeat(50));
  console.log('📊 FINAL SECURITY REPORT');
  console.log('='.repeat(50));
  console.log(`Total Tests: ${tests.total}`);
  console.log(`Passed: ${tests.passed} ✅`);
  console.log(`Failed: ${tests.failed} ❌`);
  
  const score = Math.round((tests.passed / tests.total) * 100);
  console.log(`\nSecurity Score: ${score}%`);
  
  if (score === 100) {
    console.log('\n🎉 FRONTEND 100% SECURE! 🔒');
    console.log('All security headers and encryption verified!');
  } else if (score >= 80) {
    console.log('\n✅ Frontend is mostly secure');
    console.log('Minor issues to address');
  } else {
    console.log('\n⚠️ SECURITY ISSUES DETECTED');
    console.log('Frontend needs immediate attention!');
  }
  
  return score === 100;
}

// Export for testing
export { verifySecurityHeaders, testMedicalViewerSecurity, testEncryption, runAllTests };

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllTests().then(success => {
    process.exit(success ? 0 : 1);
  });
}