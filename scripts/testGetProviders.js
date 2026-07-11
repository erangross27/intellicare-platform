#!/usr/bin/env node

/**
 * Test script to verify getProviders function works after fixing import
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function testGetProviders() {
  console.log('\n🧪 Testing getProviders Function\n');

  try {
    const providerService = require('../apps/backend-api/services/providerService');

    // Initialize the service
    await providerService.initialize();
    console.log('✅ providerService initialized successfully\n');

    const practiceContext = {
      subdomain: 'yale',
      practiceId: 'yale'
    };

    const session = {
      userId: 'test-user'
    };

    // Test getProviders
    console.log('📋 Calling getProviders...');
    const result = await providerService.getProviders({}, practiceContext, session);

    console.log('\n📊 Results:');
    console.log(`   Success: ${result.success}`);
    console.log(`   Providers found: ${result.data?.length || 0}`);

    if (result.data && result.data.length > 0) {
      console.log('\n👨‍⚕️ Sample providers:');
      result.data.slice(0, 3).forEach((provider, index) => {
        console.log(`   ${index + 1}. ${provider.firstName} ${provider.lastName} (${provider.specialty || 'N/A'})`);
      });
    }

    console.log('\n✅ Test completed successfully!\n');
    process.exit(0);

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the test
testGetProviders();