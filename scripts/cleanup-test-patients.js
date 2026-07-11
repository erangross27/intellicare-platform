/**
 * Cleanup test patients
 */

const mongoose = require('../backend/node_modules/mongoose');
const { createPatientModel } = require('../backend/models/PatientSchemaFactory');

async function cleanupTestPatients() {
  try {
    // Connect to the practice database
    const practiceDb = await mongoose.createConnection('mongodb://localhost:27017/intellicare_practice_developer');
    
    console.log('Connected to practice database');
    
    // Get the Patient model for Israel
    const Patient = createPatientModel(practiceDb, 'Israel');
    
    // Find and delete test patients
    const testNationalIds = ['987654321', '123123123'];
    
    for (const nationalId of testNationalIds) {
      const result = await Patient.deleteOne({ nationalId });
      if (result.deletedCount > 0) {
        console.log(`✅ Deleted patient with nationalId: ${nationalId}`);
      } else {
        console.log(`❌ No patient found with nationalId: ${nationalId}`);
      }
    }
    
    // List remaining patients
    const remainingPatients = await Patient.find({}, 'firstName lastName nationalId');
    console.log(`\nRemaining patients: ${remainingPatients.length}`);
    remainingPatients.forEach(p => {
      console.log(`  - ${p.firstName} ${p.lastName} (${p.nationalId})`);
    });
    
    await practiceDb.close();
    console.log('\nCleanup completed');
    process.exit(0);
    
  } catch (error) {
    console.error('Error during cleanup:', error);
    process.exit(1);
  }
}

cleanupTestPatients();