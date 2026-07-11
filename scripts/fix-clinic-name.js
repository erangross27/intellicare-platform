const databaseFactory = require('./utils/databaseFactory');
require('dotenv').config();

async function fixClinicName() {
  try {
    console.log('🔧 Fixing practice name...');
    
    // Initialize database factory
    await databaseFactory.initialize();
    
    // Get global database connection
    const globalDb = await databaseFactory.getGlobalDatabase();
    const Practice = globalDb.model('Practice', require('./models/Practice').schema);
    
    // Find the developer practice
    const practice = await Practice.findOne({ subdomain: 'developer' });
    
    if (!practice) {
      console.log('❌ Developer practice not found');
      return;
    }
    
    console.log(`📋 Current practice name: "${practice.name}"`);
    console.log(`🌐 Subdomain: ${practice.subdomain}`);
    
    // Update to Hebrew name
    const hebrewName = 'המרפאה של הפיתוח';
    practice.name = hebrewName;
    await practice.save();
    
    console.log(`✅ Updated practice name to: "${hebrewName}"`);
    console.log('🎉 Practice name fixed successfully!');
    
  } catch (error) {
    console.error('❌ Error fixing practice name:', error);
  } finally {
    // Cleanup
    await databaseFactory.cleanup();
    console.log('📡 Database connections closed');
  }
}

// Run the fix
fixClinicName().catch(console.error);
