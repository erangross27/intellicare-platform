/**
 * Add FDA API Keys to KMS
 * 
 * This script adds the FDA API credentials to the Production KMS
 * for use by cron jobs and the external API gateway service.
 */

const productionKMS = require('../services/productionKMS');

const FDA_CREDENTIALS = {
  // openFDA API Key (for general FDA API access)
  openFDA: 'xwQJ1lbKuyqtAHWrKQuokoaQkuWiF19YQMwqSnKH',
  
  // FDA iRES (Enforcement Report) API
  FDA_IRES_USER: process.env.FDA_IRES_USER || '',
  FDA_IRES_KEY: process.env.FDA_IRES_KEY || '',
  
  // FDA DDAPI (Data Dashboard) API
  FDA_DDAPI_USER: process.env.FDA_DDAPI_USER || '',
  FDA_DDAPI_KEY: process.env.FDA_DDAPI_KEY || '',
  
  // FDA PCB (Product Code Builder) API
  FDA_PCB_USER: process.env.FDA_PCB_USER || '',
  FDA_PCB_KEY: process.env.FDA_PCB_KEY || ''
};

async function addFDAKeys() {
  console.log('🔐 Initializing Production KMS...');
  await productionKMS.initialize();
  
  console.log('\n📝 Adding FDA API credentials to KMS...\n');
  
  for (const [keyName, keyValue] of Object.entries(FDA_CREDENTIALS)) {
    try {
      // Check if key already exists
      const existingKey = await productionKMS.getInternalKey(keyName);
      
      if (existingKey) {
        console.log(`🔄 Updating existing key: ${keyName}`);
      } else {
        console.log(`➕ Adding new key: ${keyName}`);
      }
      
      // Store the key
      await productionKMS.storeInternalKey(keyName, keyValue);
      console.log(`✅ Successfully stored: ${keyName}`);
      
      // Verify the key can be retrieved
      const verifyKey = await productionKMS.getInternalKey(keyName);
      if (verifyKey === keyValue) {
        console.log(`🔍 Verified: ${keyName} retrieved successfully\n`);
      } else {
        console.error(`❌ Verification failed for: ${keyName}\n`);
      }
    } catch (error) {
      console.error(`❌ Error storing ${keyName}:`, error.message);
    }
  }
  
  console.log('\n✅ FDA API credentials added to KMS successfully!');
  console.log('\nKeys added:');
  console.log('  - openFDA: General FDA API access');
  console.log('  - FDA_IRES_USER/FDA_IRES_KEY: Enforcement Reports API');
  console.log('  - FDA_DDAPI_USER/FDA_DDAPI_KEY: Data Dashboard API');
  console.log('  - FDA_PCB_USER/FDA_PCB_KEY: Product Code Builder API');
}

// Run the script
addFDAKeys().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
