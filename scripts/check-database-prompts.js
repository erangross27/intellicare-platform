const { MongoClient } = require('mongodb');

async function checkDatabasePrompts() {
  const client = new MongoClient('mongodb://localhost:27017');

  try {
    await client.connect();
    console.log('🔗 Connected to MongoDB');

    const db = client.db('intellicare');
    const collection = db.collection('ai_prompts');

    // First check what collections exist
    const collections = await db.listCollections().toArray();
    console.log('\n📂 Available collections:');
    collections.forEach(col => console.log(`  - ${col.name}`));

    // Check total documents in ai_prompts
    const count = await collection.countDocuments();
    console.log(`\n📊 Total documents in ai_prompts: ${count}`);

    // Get one sample document to see structure
    const sample = await collection.findOne({});
    console.log('\n🔍 Sample document structure:');
    if (sample) {
      console.log('Keys:', Object.keys(sample));
      console.log('Sample:', JSON.stringify(sample, null, 2));
    } else {
      console.log('No documents found');
    }
    
    // First, let's see what's actually in the database
    const sampleDoc = await collection.findOne({});
    console.log('\n🔍 Sample document structure:');
    console.log(JSON.stringify(sampleDoc, null, 2));

    // Check medical_procedures_extraction prompt (Hebrew) for time extraction
    const proceduresPrompt = await collection.findOne({
      language: 'he'
    });
    
    if (proceduresPrompt && proceduresPrompt.prompts && proceduresPrompt.prompts.medical_procedures_extraction) {
      const prompt = proceduresPrompt.prompts.medical_procedures_extraction;
      console.log('\n📋 Hebrew medical_procedures_extraction prompt:');
      console.log('=' .repeat(80));
      console.log(prompt.substring(0, 500) + '...');
      console.log('=' .repeat(80));

      // Check for updated time extraction instruction
      if (prompt.includes('חפש בכל המסמך כולל "תאריך כתיבת הגרסה"')) {
        console.log('✅ UPDATED TIME EXTRACTION FOUND in database prompt!');
      } else if (prompt.includes('DD/MM/YYYY HH:MM')) {
        console.log('⚠️ Basic time format found - but not updated instruction');
      } else {
        console.log('❌ No time format found in database prompt');
      }
    } else {
      console.log('❌ Hebrew medical_procedures_extraction prompt not found in database');
    }
    
    // Skip the old check - we already checked above
    
    // Already checked above
    
    // List all available prompt types
    const allPrompts = await collection.find({}).toArray();
    console.log('\n📝 ALL prompts in database:');
    allPrompts.forEach(prompt => {
      console.log(`  - Language: ${prompt.language}, Type: ${prompt.prompt_type}, Keys: ${Object.keys(prompt)}`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.close();
    console.log('\n🔌 MongoDB connection closed');
  }
}

checkDatabasePrompts().catch(console.error);
