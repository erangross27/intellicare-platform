const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const DATABASE_NAME = 'intellicare_global';

async function checkCurrentPrompts() {
  let client;
  
  try {
    console.log('🔗 Connecting to MongoDB...');
    client = new MongoClient(MONGODB_URI);
    await client.connect();

    const db = client.db(DATABASE_NAME);
    const promptsCollection = db.collection('ai_prompts');

    console.log('📋 Checking current prompts in database...\n');

    // Get all prompts and separate by category
    const allPrompts = await promptsCollection.find({}).toArray();

    if (allPrompts.length === 0) {
      console.log('❌ No prompts found in database');
      return;
    }

    console.log(`✅ Found ${allPrompts.length} prompt document(s):\n`);

    // Separate document analysis and agent prompts
    const documentPrompts = allPrompts.filter(p => p.category === 'document_analysis' || p.category === 'document_prompts');
    const agentPrompts = allPrompts.filter(p => p.category === 'agent_prompts' || p.category === 'agent');
    const otherPrompts = allPrompts.filter(p => !['document_analysis', 'document_prompts', 'agent_prompts', 'agent'].includes(p.category));

    console.log('📋 DOCUMENT ANALYSIS PROMPTS:');
    console.log('=' .repeat(40));
    if (documentPrompts.length === 0) {
      console.log('   No document analysis prompts found');
    } else {
      documentPrompts.forEach((prompt, index) => {
        console.log(`   ${index + 1}. Language: ${prompt.language}, Category: ${prompt.category}`);
        if (prompt.prompts) {
          Object.entries(prompt.prompts).forEach(([key, value]) => {
            const length = typeof value === 'string' ? value.length : JSON.stringify(value).length;
            console.log(`      - ${key}: ${length} characters`);
          });
        }
      });
    }

    console.log('\n🤖 AGENT PROMPTS:');
    console.log('=' .repeat(40));
    if (agentPrompts.length === 0) {
      console.log('   No agent prompts found');
    } else {
      agentPrompts.forEach((prompt, index) => {
        console.log(`   ${index + 1}. Language: ${prompt.language}, Category: ${prompt.category}`);
        if (prompt.prompts) {
          Object.entries(prompt.prompts).forEach(([key, value]) => {
            const length = typeof value === 'string' ? value.length : JSON.stringify(value).length;
            console.log(`      - ${key}: ${length} characters`);
          });
        }
      });
    }

    if (otherPrompts.length > 0) {
      console.log('\n❓ OTHER PROMPTS:');
      console.log('=' .repeat(40));
      otherPrompts.forEach((prompt, index) => {
        console.log(`   ${index + 1}. Language: ${prompt.language}, Category: ${prompt.category}`);
      });
    }

    // Show detailed content of agent intent_detection prompts
    console.log('\n🔍 AGENT INTENT DETECTION PROMPTS (detailed):\n');

    agentPrompts.forEach((prompt) => {
      if (prompt.prompts && prompt.prompts.intent_detection) {
        console.log(`📝 ${prompt.language.toUpperCase()} Agent Intent Detection Prompt:`);
        console.log('=' .repeat(60));
        console.log(prompt.prompts.intent_detection);
        console.log('=' .repeat(60));
        console.log('');
      }
    });

    // Show sample of document analysis prompts
    console.log('\n🔍 DOCUMENT ANALYSIS PROMPTS (sample):\n');

    documentPrompts.forEach((prompt) => {
      console.log(`📝 ${prompt.language.toUpperCase()} Document Analysis Prompts:`);
      console.log('=' .repeat(60));
      if (prompt.prompts) {
        Object.entries(prompt.prompts).forEach(([key, value]) => {
          console.log(`\n--- ${key.toUpperCase()} ---`);
          const preview = typeof value === 'string' ? value.substring(0, 200) + '...' : JSON.stringify(value, null, 2).substring(0, 200) + '...';
          console.log(preview);
        });
      }
      console.log('=' .repeat(60));
      console.log('');
    });

  } catch (error) {
    console.error('❌ Error checking prompts:', error);
  } finally {
    if (client) {
      await client.close();
      console.log('🔌 MongoDB connection closed');
    }
  }
}

// Run the check
checkCurrentPrompts().catch(console.error);
