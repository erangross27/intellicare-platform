#!/usr/bin/env node

/**
 * Test script to verify appointment cancellation flow
 * Tests that appointments are properly marked as 'cancelled' in the database
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const SecureDataAccess = require('../apps/backend-api/services/secureDataAccess');
const appointmentService = require('../apps/backend-api/services/appointmentService');
const { ObjectId } = require('mongodb');

async function testAppointmentCancellation() {
  console.log('\n========================================');
  console.log('🧪 Testing Appointment Cancellation Flow');
  console.log('========================================\n');

  try {
    // Initialize appointment service
    await appointmentService.initialize();

    // Use appointment service's own context for proper authentication
    const context = appointmentService.getServiceContext('yale');

    const practiceContext = {
      subdomain: 'yale',
      practiceId: 'yale'
    };

    // 1. Find an active appointment to test with
    console.log('📋 Step 1: Finding an active appointment...');
    const activeAppointments = await SecureDataAccess.query(
      'appointments',
      { status: 'scheduled' },
      { limit: 1 },
      context
    );

    if (!activeAppointments || activeAppointments.length === 0) {
      console.log('⚠️  No scheduled appointments found to test with');
      console.log('   Creating a test appointment...');

      // Create a test appointment
      const testAppointment = {
        patientId: new ObjectId(),
        providerId: 'test-provider',
        scheduledDate: new Date(),
        scheduledTime: '14:00',
        duration: 30,
        status: 'scheduled',
        type: 'consultation'
      };

      await SecureDataAccess.insert('appointments', testAppointment, context);
      console.log('✅ Test appointment created');

      // Retrieve it
      const newAppointments = await SecureDataAccess.query(
        'appointments',
        { patientId: testAppointment.patientId },
        { limit: 1 },
        context
      );

      if (newAppointments && newAppointments.length > 0) {
        appointment = newAppointments[0];
      }
    } else {
      appointment = activeAppointments[0];
    }

    if (!appointment) {
      console.error('❌ Could not create or find an appointment to test');
      process.exit(1);
    }

    console.log(`✅ Found appointment: ${appointment._id}`);
    console.log(`   Status: ${appointment.status}`);
    console.log(`   Patient ID: ${appointment.patientId}`);

    // 2. Cancel the appointment using the service
    console.log('\n🚫 Step 2: Cancelling the appointment...');
    const cancelResult = await appointmentService.cancelAppointment(
      appointment._id.toString(),
      practiceContext,
      { userId: 'test-user' },
      'Test cancellation'
    );

    console.log(`   Cancel result: ${cancelResult.success ? 'SUCCESS' : 'FAILED'}`);
    if (cancelResult.message) {
      console.log(`   Message: ${cancelResult.message}`);
    }

    // 3. Verify the appointment status in the database
    console.log('\n✅ Step 3: Verifying appointment status in database...');
    const updatedAppointments = await SecureDataAccess.query(
      'appointments',
      { _id: appointment._id },
      { limit: 1 },
      context
    );

    if (!updatedAppointments || updatedAppointments.length === 0) {
      console.error('❌ Appointment not found after cancellation!');
      process.exit(1);
    }

    const updatedAppointment = updatedAppointments[0];
    console.log(`   Current status: ${updatedAppointment.status}`);
    console.log(`   Cancellation reason: ${updatedAppointment.cancellationReason || 'None'}`);
    console.log(`   Last updated: ${updatedAppointment.lastUpdated}`);

    // 4. Check if appointment is properly filtered out from scheduled appointments
    console.log('\n🔍 Step 4: Checking if cancelled appointment is filtered from scheduled list...');
    const scheduledOnly = await SecureDataAccess.query(
      'appointments',
      {
        _id: appointment._id,
        status: 'scheduled'
      },
      { limit: 1 },
      context
    );

    console.log(`   Found in scheduled list: ${scheduledOnly && scheduledOnly.length > 0 ? 'YES (BUG!)' : 'NO (correct)'}`);

    // 5. Test availability service filtering
    console.log('\n📅 Step 5: Testing availability service filtering...');
    const allProviderAppointments = await SecureDataAccess.query(
      'appointments',
      { providerId: appointment.providerId },
      { limit: 100 },
      context
    );

    const scheduledCount = allProviderAppointments.filter(apt =>
      apt.status === 'scheduled' || apt.status === 'confirmed'
    ).length;

    const cancelledCount = allProviderAppointments.filter(apt =>
      apt.status === 'cancelled'
    ).length;

    console.log(`   Total appointments for provider: ${allProviderAppointments.length}`);
    console.log(`   Scheduled/Confirmed: ${scheduledCount}`);
    console.log(`   Cancelled: ${cancelledCount}`);

    // Summary
    console.log('\n========================================');
    console.log('📊 Test Results Summary:');
    console.log('========================================');

    const testsPassed = [];
    const testsFailed = [];

    // Test 1: Appointment marked as cancelled
    if (updatedAppointment.status === 'cancelled') {
      testsPassed.push('✅ Appointment status updated to "cancelled"');
    } else {
      testsFailed.push(`❌ Appointment status is "${updatedAppointment.status}" instead of "cancelled"`);
    }

    // Test 2: Cancellation reason recorded
    if (updatedAppointment.cancellationReason) {
      testsPassed.push('✅ Cancellation reason recorded');
    } else {
      testsFailed.push('❌ Cancellation reason not recorded');
    }

    // Test 3: Not in scheduled list
    if (!scheduledOnly || scheduledOnly.length === 0) {
      testsPassed.push('✅ Cancelled appointment filtered from scheduled list');
    } else {
      testsFailed.push('❌ Cancelled appointment still appears in scheduled list');
    }

    // Test 4: Last updated timestamp
    if (updatedAppointment.lastUpdated) {
      testsPassed.push('✅ Last updated timestamp recorded');
    } else {
      testsFailed.push('❌ Last updated timestamp not recorded');
    }

    // Print results
    if (testsPassed.length > 0) {
      console.log('\nPassed Tests:');
      testsPassed.forEach(test => console.log(`  ${test}`));
    }

    if (testsFailed.length > 0) {
      console.log('\nFailed Tests:');
      testsFailed.forEach(test => console.log(`  ${test}`));
    }

    console.log('\n========================================');
    if (testsFailed.length === 0) {
      console.log('🎉 ALL TESTS PASSED! Cancellation flow is working correctly.');
    } else {
      console.log(`⚠️  ${testsFailed.length} test(s) failed. Review the fixes.`);
    }
    console.log('========================================\n');

    process.exit(testsFailed.length === 0 ? 0 : 1);

  } catch (error) {
    console.error('\n❌ Test failed with error:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the test
testAppointmentCancellation();