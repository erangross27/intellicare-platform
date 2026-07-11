const { MongoClient } = require('mongodb');

const MONGODB_URI = 'mongodb://localhost:27017';
const DATABASE_NAME = 'intellicare';

async function addPatientDetailsHebrew() {
  console.log('🔄 Adding Hebrew translations for patient details...');
  
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    const db = client.db(DATABASE_NAME);
    const collection = db.collection('translations');
    
    // Add missing Hebrew translations for patient details
    const hebrewUpdate = await collection.updateOne(
      { language: 'he' },
      {
        $set: {
          // Patient card labels
          'translations.id': 'מזהה',
          'translations.gender': 'מין',
          'translations.age': 'גיל',
          'translations.phone': 'טלפון',
          'translations.email': 'אימייל',
          'translations.status': 'סטטוס',
          'translations.registered': 'נרשם',
          'translations.active': 'פעיל',
          'translations.male': 'זכר',
          'translations.female': 'נקבה',
          'translations.years': 'שנים',
          
          // Action buttons
          'translations.delete': 'מחק',
          'translations.edit': 'ערוך',
          'translations.view': 'צפה',
          
          lastUpdated: new Date()
        }
      }
    );
    
    console.log('✅ Hebrew patient details translations added:', hebrewUpdate.modifiedCount > 0 ? 'Success' : 'No changes');
    
    // Verify the changes
    const hebrewDoc = await collection.findOne({ language: 'he' });
    
    console.log('\n📝 Added Hebrew translations:');
    console.log('ID:', hebrewDoc.translations.id);
    console.log('Gender:', hebrewDoc.translations.gender);
    console.log('Age:', hebrewDoc.translations.age);
    console.log('Phone:', hebrewDoc.translations.phone);
    console.log('Email:', hebrewDoc.translations.email);
    console.log('Status:', hebrewDoc.translations.status);
    console.log('Registered:', hebrewDoc.translations.registered);
    console.log('Active:', hebrewDoc.translations.active);
    console.log('Male:', hebrewDoc.translations.male);
    console.log('Female:', hebrewDoc.translations.female);
    console.log('Years:', hebrewDoc.translations.years);
    console.log('Delete:', hebrewDoc.translations.delete);
    console.log('Edit:', hebrewDoc.translations.edit);
    console.log('View:', hebrewDoc.translations.view);
    
  } catch (error) {
    console.error('❌ Error adding Hebrew translations:', error);
  } finally {
    await client.close();
  }
}

addPatientDetailsHebrew();
