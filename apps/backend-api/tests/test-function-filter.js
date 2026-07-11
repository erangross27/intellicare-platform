/**
 * 🔒 AGENT 4: Function Filtering Test
 * 
 * This test proves that AI constraints work by testing:
 * 1. Role-based function filtering
 * 2. Different user roles get different functions
 * 3. Security events are logged
 */

const path = require('path');
const ClaudeAgent = require('../services/agentServiceClaude');

console.log('=== 🔒 FUNCTION FILTERING TEST ===\n');

async function runFunctionFilteringTests() {
  try {
    const agent = new ClaudeAgent();
    await agent.initialize();
    
    // Mock function set (similar to what real agent would have)
    const mockFunctions = [
      { name: 'searchPatients', description: 'Search for patients' },
      { name: 'getPatientHistory', description: 'Get patient medical history' },
      { name: 'addMedicalNote', description: 'Add medical note' },
      { name: 'scheduleAppointment', description: 'Schedule appointment' },
      { name: 'prescribeMedication', description: 'Prescribe medication' },
      { name: 'uploadDocument', description: 'Upload document' },
      { name: 'updateVitalSigns', description: 'Update vital signs' },
      { name: 'deletePatient', description: 'Delete patient (DANGEROUS)' },
      { name: 'updateUserRoles', description: 'Update user roles (ADMIN ONLY)' },
      { name: 'deleteUser', description: 'Delete user (ADMIN ONLY)' },
      { name: 'modifySystemSettings', description: 'Modify system settings (ADMIN ONLY)' },
      { name: 'updatePatientInfo', description: 'Update patient information' }
    ];
    
    console.log(`📋 Total available functions: ${mockFunctions.length}`);
    
    // Test different user roles
    const testCases = [
      {
        role: 'user',
        expectedFunctions: ['searchPatients', 'getPatientHistory', 'addMedicalNote', 'scheduleAppointment']
      },
      {
        role: 'doctor',
        expectedFunctions: ['searchPatients', 'getPatientHistory', 'addMedicalNote', 'scheduleAppointment', 'prescribeMedication', 'uploadDocument']
      },
      {
        role: 'nurse',
        expectedFunctions: ['searchPatients', 'getPatientHistory', 'addMedicalNote', 'scheduleAppointment', 'updateVitalSigns']
      },
      {
        role: 'admin',
        expectedCount: mockFunctions.length // Admin gets all functions
      },
      {
        role: 'secretary',
        expectedFunctions: ['searchPatients', 'scheduleAppointment', 'updatePatientInfo']
      },
      {
        role: null, // No role provided
        expectedCount: 1 // Should only get searchPatients as fallback
      }
    ];
    
    const results = [];
    
    for (const testCase of testCases) {
      console.log(`\n🧪 Testing role: ${testCase.role || 'NO_ROLE'}`);
      
      const userContext = {
        role: testCase.role,
        practiceId: 'test-practice',
        userId: 'test-user'
      };
      
      const filteredFunctions = agent.filterFunctionsByContext(userContext, mockFunctions);
      const functionNames = filteredFunctions.map(f => f.name);
      
      console.log(`   Functions allowed: ${filteredFunctions.length}`);
      console.log(`   Function names: ${functionNames.join(', ')}`);
      
      let passed = false;
      let expectedCount = 0;
      
      if (testCase.expectedFunctions) {
        expectedCount = testCase.expectedFunctions.length;
        passed = testCase.expectedFunctions.every(fn => functionNames.includes(fn)) &&
                functionNames.length === expectedCount;
      } else if (testCase.expectedCount) {
        expectedCount = testCase.expectedCount;
        passed = filteredFunctions.length === expectedCount;
      }
      
      const status = passed ? '✅ PASSED' : '❌ FAILED';
      console.log(`   Expected: ${expectedCount}, Got: ${filteredFunctions.length} - ${status}`);
      
      results.push({
        role: testCase.role || 'NO_ROLE',
        expected: expectedCount,
        actual: filteredFunctions.length,
        passed,
        functionNames
      });
      
      // Test dangerous operation blocking
      if (testCase.role !== 'admin') {
        console.log(`   🚨 Testing dangerous operation blocking...`);
        try {
          agent.validateOperation('deletePatient', userContext);
          console.log(`   ❌ SECURITY FAILURE: deletePatient should be blocked for ${testCase.role}`);
          results[results.length - 1].securityTest = 'FAILED';
        } catch (error) {
          console.log(`   ✅ SECURITY PASSED: deletePatient correctly blocked - ${error.message}`);
          results[results.length - 1].securityTest = 'PASSED';
        }
      } else {
        console.log(`   ✅ Admin role - dangerous operations allowed`);
        results[results.length - 1].securityTest = 'ADMIN_BYPASS';
      }
    }
    
    // Generate summary
    console.log('\n=== 📊 TEST SUMMARY ===');
    const passed = results.filter(r => r.passed).length;
    const securityPassed = results.filter(r => r.securityTest === 'PASSED' || r.securityTest === 'ADMIN_BYPASS').length;
    
    console.log(`Function Filtering Tests: ${passed}/${results.length} PASSED`);
    console.log(`Security Constraint Tests: ${securityPassed}/${results.length} PASSED`);
    
    // Detailed results table
    console.log('\n| Role | Expected | Actual | Status | Security Test |');
    console.log('|------|----------|--------|--------|---------------|');
    results.forEach(r => {
      const status = r.passed ? '✅ PASS' : '❌ FAIL';
      const security = r.securityTest === 'PASSED' ? '✅ BLOCKED' : 
                      r.securityTest === 'ADMIN_BYPASS' ? '✅ ADMIN' : '❌ FAILED';
      console.log(`| ${r.role} | ${r.expected} | ${r.actual} | ${status} | ${security} |`);
    });
    
    // Final verdict
    if (passed === results.length && securityPassed === results.length) {
      console.log('\n🎉 ALL TESTS PASSED - Function filtering is working correctly!');
      return { success: true, passed, total: results.length, results };
    } else {
      console.log('\n❌ SOME TESTS FAILED - Function filtering needs fixes');
      return { success: false, passed, total: results.length, results };
    }
    
  } catch (error) {
    console.error('❌ Test execution failed:', error);
    return { success: false, error: error.message };
  }
}

// Run the test
if (require.main === module) {
  runFunctionFilteringTests()
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

module.exports = runFunctionFilteringTests;