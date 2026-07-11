#!/usr/bin/env node

/**
 * Simple test to verify appointment cancellation updates status correctly
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function testCancelFlow() {
  console.log('\n🧪 Testing Appointment Cancellation Status Update\n');

  try {
    // Initialize services
    const serviceAccountManager = require('../apps/backend-api/services/serviceAccountManager');
    const SecureDataAccess = require('../apps/backend-api/services/secureDataAccess');
    const { ObjectId } = require('mongodb');

    // Get service token for appointmentService
    const serviceToken = await serviceAccountManager.authenticate('appointmentService');

    const context = {
      serviceId: 'appointmentService',
      operation: 'test-cancellation',
      practiceId: 'yale',
      apiKey: serviceToken?.apiKey || serviceToken
    };

    // 1. Find or create a test appointment
    console.log('📋 Finding a scheduled appointment...');
    let appointments = await SecureDataAccess.query(
      'appointments',
      { status: 'scheduled' },
      { limit: 1 },
      context
    );

    let appointmentId;
    if (!appointments || appointments.length === 0) {
      console.log('   No scheduled appointments found, creating test appointment...');

      // Create a test appointment
      const testAppointment = {
        patientId: new ObjectId('507f1f77bcf86cd799439011'), // Test patient ID
        providerId: 'test-provider-001',
        scheduledDate: new Date('2025-10-15'),
        scheduledTime: '14:00',
        duration: 30,
        status: 'scheduled',
        type: 'consultation',
        createdAt: new Date()
      };

      const insertResult = await SecureDataAccess.insert('appointments', testAppointment, context);
      appointmentId = insertResult.insertedId || insertResult._id;
      console.log(`   ✅ Created test appointment: ${appointmentId}`);
    } else {
      appointmentId = appointments[0]._id;
      console.log(`   ✅ Found appointment: ${appointmentId}`);
    }

    // 2. Show current status
    console.log('\n📊 BEFORE cancellation:');
    appointments = await SecureDataAccess.query(
      'appointments',
      { _id: appointmentId },
      { limit: 1 },
      context
    );

    if (appointments && appointments[0]) {
      console.log(`   Status: ${appointments[0].status}`);
      console.log(`   Cancellation reason: ${appointments[0].cancellationReason || 'None'}`);
    }

    // 3. Cancel the appointment - using the CORRECT update syntax
    console.log('\n🚫 Cancelling appointment...');
    const updateData = {
      status: 'cancelled',
      cancellationReason: 'Test cancellation - verifying status update',
      lastUpdated: new Date(),
      updatedBy: 'test-script'
    };

    await SecureDataAccess.update(
      'appointments',
      { _id: appointmentId },
      { $set: updateData },  // Using MongoDB $set operator
      context
    );

    console.log('   ✅ Update command executed');

    // 4. Verify the status change
    console.log('\n📊 AFTER cancellation:');
    appointments = await SecureDataAccess.query(
      'appointments',
      { _id: appointmentId },
      { limit: 1 },
      context
    );

    if (appointments && appointments[0]) {
      const appointment = appointments[0];
      console.log(`   Status: ${appointment.status}`);
      console.log(`   Cancellation reason: ${appointment.cancellationReason || 'None'}`);
      console.log(`   Last updated: ${appointment.lastUpdated || 'Not set'}`);
      console.log(`   Updated by: ${appointment.updatedBy || 'Not set'}`);

      // 5. Test results
      console.log('\n========================================');
      console.log('📊 TEST RESULTS:');
      console.log('========================================');

      if (appointment.status === 'cancelled') {
        console.log('✅ SUCCESS: Appointment status correctly updated to "cancelled"');
      } else {
        console.log(`❌ FAILURE: Appointment status is "${appointment.status}" instead of "cancelled"`);
      }

      if (appointment.cancellationReason) {
        console.log('✅ SUCCESS: Cancellation reason recorded');
      } else {
        console.log('❌ FAILURE: Cancellation reason not recorded');
      }

      // 6. Check it's filtered from scheduled appointments
      console.log('\n🔍 Checking scheduled appointments filter...');
      const scheduledCheck = await SecureDataAccess.query(
        'appointments',
        { _id: appointmentId, status: 'scheduled' },
        { limit: 1 },
        context
      );

      if (!scheduledCheck || scheduledCheck.length === 0) {
        console.log('✅ SUCCESS: Cancelled appointment is NOT in scheduled list');
      } else {
        console.log('❌ FAILURE: Cancelled appointment still appears in scheduled list');
      }

    } else {
      console.error('❌ Could not retrieve appointment after update');
    }

    console.log('\n✨ Test complete!\n');
    process.exit(0);

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the test
testCancelFlow();