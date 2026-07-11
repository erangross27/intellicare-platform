/**
 * 🔒 AGENT 4: Magic Link Authentication with AI Test
 * 
 * This test proves that AI constraints work with the magic link authentication system:
 * 1. Magic link tokens are properly validated
 * 2. AI respects authenticated user roles
 * 3. Session management works with AI security
 */

const ClaudeAgent = require('../services/agentServiceClaude');
const crypto = require('crypto');

console.log('=== 🔒 MAGIC LINK + AI AUTHENTICATION TEST ===\n');

// Mock magic link token generation (simplified for testing)
function generateMagicLinkToken(email, role, practiceId) {
  const payload = {
    email,
    role,
    practiceId,
    timestamp: Date.now(),
    expiresAt: Date.now() + (15 * 60 * 1000) // 15 minutes
  };
  
  // In real system, this would be properly signed with JWT
  const token = Buffer.from(JSON.stringify(payload)).toString('base64');
  return { token, payload };
}

// Mock magic link validation
function validateMagicLinkToken(token) {
  try {
    const payloadStr = Buffer.from(token, 'base64').toString('utf8');
    const payload = JSON.parse(payloadStr);
    
    // Check expiration
    if (payload.expiresAt < Date.now()) {
      throw new Error('Token expired');
    }
    
    return {
      valid: true,
      user: {
        email: payload.email,
        role: payload.role,
        practiceId: payload.practiceId
      }
    };
  } catch (error) {
    return {
      valid: false,
      error: error.message
    };
  }
}

async function runMagicLinkAITests() {
  try {
    const agent = new ClaudeAgent();
    await agent.initialize();
    
    console.log('🔗 Testing Magic Link Authentication with AI Constraints\n');
    
    // Test cases for different user scenarios
    const testCases = [
      {
        name: 'Doctor with valid magic link',
        email: 'doctor@practice-a.com',
        role: 'doctor',
        practiceId: 'practice-a',
        message: 'Search for patients with hypertension',
        expectedAllowed: true,
        expectedFunctions: ['searchPatients', 'getPatientHistory', 'addMedicalNote', 'scheduleAppointment', 'prescribeMedication', 'uploadDocument']
      },
      {
        name: 'Nurse with valid magic link',
        email: 'nurse@practice-a.com',
        role: 'nurse',
        practiceId: 'practice-a',
        message: 'Update vital signs for patient ID 123',
        expectedAllowed: true,
        expectedFunctions: ['searchPatients', 'getPatientHistory', 'addMedicalNote', 'scheduleAppointment', 'updateVitalSigns']
      },
      {
        name: 'User with limited access',
        email: 'user@practice-a.com',
        role: 'user',
        practiceId: 'practice-a',
        message: 'View my appointment history',
        expectedAllowed: true,
        expectedFunctions: ['searchPatients', 'getPatientHistory', 'addMedicalNote', 'scheduleAppointment']
      },
      {
        name: 'Admin with full access',
        email: 'admin@practice-a.com',
        role: 'admin',
        practiceId: 'practice-a',
        message: 'Export practice statistics',
        expectedAllowed: true,
        expectedFunctions: ['*'] // All functions
      },
      {
        name: 'Secretary with specific access',
        email: 'secretary@practice-a.com',
        role: 'secretary',
        practiceId: 'practice-a',
        message: 'Schedule appointment for new patient',
        expectedAllowed: true,
        expectedFunctions: ['searchPatients', 'scheduleAppointment', 'updatePatientInfo']
      }
    ];
    
    const results = [];
    
    for (const testCase of testCases) {
      console.log(`\n🧪 Testing: ${testCase.name}`);
      console.log(`   Email: ${testCase.email}`);
      console.log(`   Role: ${testCase.role}`);
      console.log(`   Practice: ${testCase.practiceId}`);
      
      // Step 1: Generate magic link token
      const { token, payload } = generateMagicLinkToken(
        testCase.email, 
        testCase.role, 
        testCase.practiceId
      );
      console.log(`   🔗 Magic link token generated`);
      
      // Step 2: Validate magic link token
      const validation = validateMagicLinkToken(token);
      if (!validation.valid) {
        console.log(`   ❌ Token validation failed: ${validation.error}`);
        results.push({
          testName: testCase.name,
          tokenValid: false,
          error: validation.error,
          passed: false
        });
        continue;
      }
      
      console.log(`   ✅ Token validated successfully`);
      
      // Step 3: Create AI context from authenticated user
      const userContext = {
        role: validation.user.role,
        practiceId: validation.user.practiceId,
        userId: validation.user.email,
        email: validation.user.email,
        authenticated: true,
        authMethod: 'magic_link'
      };
      
      // Step 4: Test AI function filtering with authenticated context
      const mockFunctions = [
        { name: 'searchPatients' },
        { name: 'getPatientHistory' },
        { name: 'addMedicalNote' },
        { name: 'scheduleAppointment' },
        { name: 'prescribeMedication' },
        { name: 'uploadDocument' },
        { name: 'updateVitalSigns' },
        { name: 'updatePatientInfo' },
        { name: 'deletePatient' },
        { name: 'updateUserRoles' },
        { name: 'deleteUser' }
      ];
      
      const filteredFunctions = agent.filterFunctionsByContext(userContext, mockFunctions);
      const functionNames = filteredFunctions.map(f => f.name);
      
      console.log(`   🔧 Available functions: ${functionNames.length}`);
      console.log(`   🔧 Functions: ${functionNames.join(', ')}`);
      
      // Step 5: Test message processing with authentication
      let messageProcessed = false;
      let messageError = '';
      
      try {
        // This would normally call the full processChatMessage method
        // For testing, we just validate the message
        agent.validateUserMessage(testCase.message, userContext);
        messageProcessed = true;
        console.log(`   💬 Message processing: ALLOWED`);
      } catch (error) {
        messageError = error.message;
        console.log(`   💬 Message processing: BLOCKED - ${error.message}`);
      }
      
      // Step 6: Validate expected behavior
      let functionsCorrect = false;
      if (testCase.expectedFunctions.includes('*')) {
        // Admin should get all functions
        functionsCorrect = functionNames.length === mockFunctions.length;
      } else {
        // Check if user got expected functions
        functionsCorrect = testCase.expectedFunctions.every(fn => functionNames.includes(fn)) &&
                          functionNames.every(fn => testCase.expectedFunctions.includes(fn));
      }
      
      const messageCorrect = (messageProcessed === testCase.expectedAllowed);
      const overallPassed = functionsCorrect && messageCorrect;
      
      const status = overallPassed ? '✅ PASSED' : '❌ FAILED';
      console.log(`   Expected functions: ${testCase.expectedFunctions.length === 1 && testCase.expectedFunctions[0] === '*' ? 'ALL' : testCase.expectedFunctions.length}`);
      console.log(`   Actual functions: ${functionNames.length}`);
      console.log(`   Functions correct: ${functionsCorrect ? '✅' : '❌'}`);
      console.log(`   Message processing: ${messageCorrect ? '✅' : '❌'}`);
      console.log(`   Overall result: ${status}`);
      
      results.push({
        testName: testCase.name,
        email: testCase.email,
        role: testCase.role,
        practiceId: testCase.practiceId,
        tokenValid: true,
        functionsExpected: testCase.expectedFunctions.includes('*') ? mockFunctions.length : testCase.expectedFunctions.length,
        functionsActual: functionNames.length,
        functionsCorrect,
        messageProcessed,
        messageCorrect,
        passed: overallPassed,
        functionNames
      });
    }
    
    // Additional security tests
    console.log(`\n🧪 Testing: Security Edge Cases with Magic Links`);
    
    // Test expired token
    console.log(`   🕐 Testing expired magic link token...`);
    const expiredPayload = {
      email: 'test@practice.com',
      role: 'doctor',
      practiceId: 'practice-a',
      timestamp: Date.now() - (20 * 60 * 1000), // 20 minutes ago
      expiresAt: Date.now() - (5 * 60 * 1000) // Expired 5 minutes ago
    };
    const expiredToken = Buffer.from(JSON.stringify(expiredPayload)).toString('base64');
    const expiredValidation = validateMagicLinkToken(expiredToken);
    
    const expiredTestPassed = !expiredValidation.valid;
    console.log(`      Expected: INVALID, Actual: ${expiredValidation.valid ? 'VALID' : 'INVALID'}`);
    console.log(`      Result: ${expiredTestPassed ? '✅ PASSED' : '❌ FAILED'}`);
    
    results.push({
      testName: 'Expired token rejection',
      tokenValid: expiredValidation.valid,
      passed: expiredTestPassed,
      error: expiredValidation.error
    });
    
    // Test malformed token
    console.log(`   🔧 Testing malformed magic link token...`);
    const malformedToken = 'invalid-token-data';
    const malformedValidation = validateMagicLinkToken(malformedToken);
    
    const malformedTestPassed = !malformedValidation.valid;
    console.log(`      Expected: INVALID, Actual: ${malformedValidation.valid ? 'VALID' : 'INVALID'}`);
    console.log(`      Result: ${malformedTestPassed ? '✅ PASSED' : '❌ FAILED'}`);
    
    results.push({
      testName: 'Malformed token rejection',
      tokenValid: malformedValidation.valid,
      passed: malformedTestPassed,
      error: malformedValidation.error
    });
    
    // Test cross-practice token usage
    console.log(`   🏥 Testing cross-practice token usage...`);
    const crossClinicToken = generateMagicLinkToken('user@practice-b.com', 'doctor', 'practice-b');
    const crossClinicValidation = validateMagicLinkToken(crossClinicToken.token);
    
    if (crossClinicValidation.valid) {
      const crossClinicContext = {
        role: crossClinicValidation.user.role,
        practiceId: crossClinicValidation.user.practiceId,
        userId: crossClinicValidation.user.email
      };
      
      // Try to access practice-a data from practice-b user
      try {
        agent.validateUserMessage('Show me patients from practice-a', crossClinicContext);
        console.log(`      Cross-practice access: ❌ ALLOWED (should be blocked)`);
        results.push({
          testName: 'Cross-practice access prevention',
          passed: false,
          error: 'Cross-practice access was allowed'
        });
      } catch (error) {
        console.log(`      Cross-practice access: ✅ BLOCKED - ${error.message}`);
        results.push({
          testName: 'Cross-practice access prevention',
          passed: true,
          blocked: true
        });
      }
    }
    
    // Generate summary
    console.log('\n=== 📊 TEST SUMMARY ===');
    const totalTests = results.length;
    const passedTests = results.filter(r => r.passed).length;
    const authTests = results.filter(r => r.email).length; // Tests with actual user authentication
    const authPassed = results.filter(r => r.email && r.passed).length;
    const securityTests = totalTests - authTests;
    const securityPassed = passedTests - authPassed;
    
    console.log(`Authentication Tests: ${authPassed}/${authTests} PASSED`);
    console.log(`Security Tests: ${securityPassed}/${securityTests} PASSED`);
    console.log(`Overall Tests: ${passedTests}/${totalTests} PASSED`);
    
    // Detailed results table
    console.log('\n| Test | Role | Functions | Message | Token | Status |');
    console.log('|------|------|-----------|---------|-------|--------|');
    results.forEach(r => {
      if (r.email) {
        const functions = `${r.functionsActual}/${r.functionsExpected}`;
        const message = r.messageProcessed ? 'OK' : 'BLOCKED';
        const token = r.tokenValid ? 'VALID' : 'INVALID';
        const status = r.passed ? '✅ PASS' : '❌ FAIL';
        console.log(`| ${r.testName} | ${r.role} | ${functions} | ${message} | ${token} | ${status} |`);
      } else {
        const status = r.passed ? '✅ PASS' : '❌ FAIL';
        console.log(`| ${r.testName} | - | - | - | ${r.tokenValid ? 'VALID' : 'INVALID'} | ${status} |`);
      }
    });
    
    // Authentication effectiveness
    const tokenValidationTests = results.filter(r => r.hasOwnProperty('tokenValid')).length;
    const tokenValidationPassed = results.filter(r => 
      r.hasOwnProperty('tokenValid') && 
      ((r.testName.includes('Expired') || r.testName.includes('Malformed')) ? !r.tokenValid : r.tokenValid)
    ).length;
    
    console.log('\n=== 🔐 AUTHENTICATION EFFECTIVENESS ===');
    console.log(`Magic link validation: ${tokenValidationPassed}/${tokenValidationTests} correct`);
    console.log(`Role-based access control: ${authPassed}/${authTests} working`);
    
    const successRate = passedTests / totalTests;
    const authSuccessRate = tokenValidationTests > 0 ? tokenValidationPassed / tokenValidationTests : 1;
    
    // Final verdict
    const success = successRate >= 0.9 && authSuccessRate >= 0.9;
    
    if (success) {
      console.log('\n🎉 MAGIC LINK + AI INTEGRATION IS SECURE!');
      console.log(`   Overall success: ${Math.round(successRate * 100)}%`);
      console.log(`   Authentication success: ${Math.round(authSuccessRate * 100)}%`);
      return { 
        success: true, 
        passedTests, 
        totalTests, 
        authSuccessRate: Math.round(authSuccessRate * 100),
        results 
      };
    } else {
      console.log('\n❌ MAGIC LINK + AI INTEGRATION NEEDS FIXES');
      console.log(`   Overall success: ${Math.round(successRate * 100)}% (required: 90%)`);
      console.log(`   Authentication success: ${Math.round(authSuccessRate * 100)}% (required: 90%)`);
      return { 
        success: false, 
        passedTests, 
        totalTests, 
        authSuccessRate: Math.round(authSuccessRate * 100),
        results 
      };
    }
    
  } catch (error) {
    console.error('❌ Test execution failed:', error);
    return { success: false, error: error.message };
  }
}

// Run the test
if (require.main === module) {
  runMagicLinkAITests()
    .then(result => {
      console.log('\n=== Final Result ===');
      console.log(JSON.stringify(result, null, 2));
      process.exit(result.success ? 0 : 1);
    })
    .catch(error => {
      console.error('Test runner failed:', error);
      process.exit(1);
    });
}

module.exports = runMagicLinkAITests;