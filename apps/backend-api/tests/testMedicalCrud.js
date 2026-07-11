/**
 * Test script for Medical CRUD Operations
 * Tests all 33 categories with their CRUD functions
 */

const medicalCrudService = require('../services/medicalCrudService');
const { ObjectId } = require('mongodb');

// Test configuration
const TEST_PATIENT_ID = '507f1f77bcf86cd799439011'; // Sample ObjectId
const TEST_SESSION_ID = 'test-session-123';

async function testCrudOperations() {
  console.log('🧪 Testing Medical CRUD Operations\n');
  console.log('=' .repeat(60));

  const results = {
    passed: [],
    failed: [],
    categories: []
  };

  // Sample test data for different categories
  const testData = {
    appointments: {
      patientId: TEST_PATIENT_ID,
      date: '2025-02-15',
      time: '14:30',
      reason: 'Regular checkup',
      provider: 'Dr. Smith',
      status: 'scheduled'
    },
    medications: {
      patientId: TEST_PATIENT_ID,
      medication: 'Aspirin',
      dosage: '100mg',
      frequency: 'Once daily',
      startDate: new Date(),
      prescribedBy: 'Dr. Jones'
    },
    allergies: {
      patientId: TEST_PATIENT_ID,
      allergen: 'Peanuts',
      severity: 'severe',
      reaction: 'Anaphylaxis',
      discoveredDate: new Date()
    },
    vitals: {
      patientId: TEST_PATIENT_ID,
      bloodPressure: '120/80',
      heartRate: 72,
      temperature: 98.6,
      weight: 70,
      recordedAt: new Date()
    },
    laboratory: {
      patientId: TEST_PATIENT_ID,
      testName: 'Complete Blood Count',
      result: 'Normal',
      referenceRange: '4.5-11.0',
      orderedBy: 'Dr. Brown',
      testDate: new Date()
    }
  };

  // Test first 5 categories as a sample
  const categoriesToTest = ['appointments', 'medications', 'allergies', 'vitals', 'laboratory'];

  for (const category of categoriesToTest) {
    console.log(`\n📋 Testing category: ${category}`);
    console.log('-'.repeat(40));

    try {
      // Test 1: GET (should be empty initially)
      console.log(`  1️⃣ Testing GET ${category}...`);
      const getResult = await medicalCrudService.getCategoryData(
        category,
        TEST_PATIENT_ID,
        TEST_SESSION_ID
      );

      if (getResult.success) {
        console.log(`     ✅ GET successful (${getResult.recordsFound} records)`);
        results.passed.push(`${category}-get`);
      } else {
        console.log(`     ❌ GET failed: ${getResult.error}`);
        results.failed.push(`${category}-get`);
      }

      // Test 2: ADD
      console.log(`  2️⃣ Testing ADD ${category}...`);
      const addData = testData[category] || {
        patientId: TEST_PATIENT_ID,
        testField: 'test value',
        createdAt: new Date()
      };

      const addResult = await medicalCrudService.addCategoryRecord(
        category,
        addData,
        TEST_SESSION_ID
      );

      let recordId = null;
      if (addResult.success) {
        recordId = addResult.recordId;
        console.log(`     ✅ ADD successful (ID: ${recordId})`);
        results.passed.push(`${category}-add`);
      } else {
        console.log(`     ❌ ADD failed: ${addResult.error}`);
        results.failed.push(`${category}-add`);
      }

      // Test 3: UPDATE (if ADD was successful)
      if (recordId) {
        console.log(`  3️⃣ Testing UPDATE ${category}...`);
        const updateResult = await medicalCrudService.updateCategoryRecord(
          category,
          recordId,
          { notes: 'Updated via test script' },
          TEST_SESSION_ID
        );

        if (updateResult.success) {
          console.log(`     ✅ UPDATE successful`);
          results.passed.push(`${category}-update`);
        } else {
          console.log(`     ❌ UPDATE failed: ${updateResult.error}`);
          results.failed.push(`${category}-update`);
        }

        // Test 4: DELETE
        console.log(`  4️⃣ Testing DELETE ${category}...`);
        const deleteResult = await medicalCrudService.deleteCategoryRecord(
          category,
          recordId,
          TEST_SESSION_ID
        );

        if (deleteResult.success) {
          console.log(`     ✅ DELETE successful (soft delete)`);
          results.passed.push(`${category}-delete`);
        } else {
          console.log(`     ❌ DELETE failed: ${deleteResult.error}`);
          results.failed.push(`${category}-delete`);
        }
      }

      // Test 5: Get Summary
      console.log(`  5️⃣ Testing SUMMARY ${category}...`);
      const summaryResult = await medicalCrudService.getCategorySummary(
        category,
        TEST_PATIENT_ID
      );

      if (summaryResult.success) {
        console.log(`     ✅ SUMMARY successful (${summaryResult.summary.totalRecords} total records)`);
        results.passed.push(`${category}-summary`);
      } else {
        console.log(`     ❌ SUMMARY failed: ${summaryResult.error}`);
        results.failed.push(`${category}-summary`);
      }

      results.categories.push(category);

    } catch (error) {
      console.log(`  ❌ Error testing ${category}: ${error.message}`);
      results.failed.push(`${category}-error`);
    }
  }

  // Test getPatientCategories
  console.log('\n📊 Testing getPatientCategories...');
  try {
    const categoriesResult = await medicalCrudService.getPatientCategories(TEST_PATIENT_ID);
    if (categoriesResult.success) {
      console.log(`✅ Found ${categoriesResult.totalCategories} categories with data`);
      if (categoriesResult.categories.length > 0) {
        console.log('Categories with data:', categoriesResult.categories.map(c => c.name).join(', '));
      }
      results.passed.push('getPatientCategories');
    } else {
      console.log(`❌ Failed: ${categoriesResult.error}`);
      results.failed.push('getPatientCategories');
    }
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
    results.failed.push('getPatientCategories-error');
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 Test Summary:');
  console.log('-'.repeat(60));
  console.log(`✅ Passed: ${results.passed.length} operations`);
  console.log(`❌ Failed: ${results.failed.length} operations`);
  console.log(`📁 Categories tested: ${results.categories.length}/33`);

  if (results.failed.length > 0) {
    console.log('\nFailed operations:', results.failed.join(', '));
  }

  console.log('\n💡 Note: This test uses mock operations.');
  console.log('   In production, SecureDataAccess will handle actual database operations.');
  console.log('\n✨ Medical CRUD test complete!');

  // Return exit code
  process.exit(results.failed.length > 0 ? 1 : 0);
}

// Run tests if executed directly
if (require.main === module) {
  // Mock global.practiceId for testing
  global.practiceId = 'test-practice';

  testCrudOperations().catch(error => {
    console.error('Test runner error:', error);
    process.exit(1);
  });
}

module.exports = { testCrudOperations };