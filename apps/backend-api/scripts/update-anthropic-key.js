#!/usr/bin/env node
/**
 * Script to update ANTHROPIC_API_KEY in the KMS
 * Usage: node update-anthropic-key.js <new-api-key>
 */

const productionKMS = require('../services/productionKMS');

async function updateKey() {
  const newKey = process.argv[2];
  
  if (!newKey || !newKey.startsWith('sk-ant-')) {
    console.error('❌ Invalid API key format. Must start with "sk-ant-"');
    console.error('Usage: node update-anthropic-key.js <new-api-key>');
    process.exit(1);
  }

  console.log('🔐 Initializing KMS...');
  await productionKMS.initialize();
  
  console.log('📝 Storing new ANTHROPIC_API_KEY...');
  await productionKMS.storeInternalKey('ANTHROPIC_API_KEY', newKey);
  
  console.log('✅ ANTHROPIC_API_KEY updated successfully!');
  
  // Verify the key was stored correctly
  console.log('🔍 Verifying key...');
  const retrievedKey = await productionKMS.getInternalKey('ANTHROPIC_API_KEY');
  
  if (retrievedKey === newKey) {
    console.log('✅ Key verified - matches input!');
    console.log(`📋 Key preview: ${retrievedKey.substring(0, 15)}...${retrievedKey.substring(retrievedKey.length - 8)}`);
  } else {
    console.error('❌ Key verification failed - stored key does not match!');
    process.exit(1);
  }
}

updateKey().catch(error => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
