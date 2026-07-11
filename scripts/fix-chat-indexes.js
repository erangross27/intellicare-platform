const mongoose = require('mongoose');

async function fixChatIndexes() {
  try {
    console.log('🔧 Fixing chat session indexes...');
    
    // Connect to MongoDB
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
    const connection = await mongoose.createConnection(mongoURI, {
      dbName: 'intellicare_developer'
    });
    
    console.log('✅ Connected to MongoDB');
    
    // Get the chat_sessions collection
    const collection = connection.collection('chat_sessions');
    
    // List existing indexes
    console.log('📋 Current indexes:');
    const indexes = await collection.indexes();
    indexes.forEach(index => {
      console.log(`- ${index.name}:`, JSON.stringify(index.key, null, 2));
      if (index.default_language || index.language_override) {
        console.log(`  Language settings:`, {
          default_language: index.default_language,
          language_override: index.language_override
        });
      }
    });
    
    // Drop problematic text indexes
    console.log('\n🗑️ Dropping problematic text indexes...');
    for (const index of indexes) {
      if (index.name !== '_id_' && (index.default_language || index.language_override)) {
        try {
          await collection.dropIndex(index.name);
          console.log(`✅ Dropped index: ${index.name}`);
        } catch (error) {
          console.log(`⚠️ Could not drop index ${index.name}:`, error.message);
        }
      }
    }
    
    // Create new text index with proper language settings
    console.log('\n🔨 Creating new text index...');
    await collection.createIndex(
      { 
        userId: 1, 
        title: 'text', 
        summary: 'text' 
      },
      {
        name: 'userId_1_title_text_summary_text',
        default_language: 'none',
        language_override: 'none'
      }
    );
    console.log('✅ Created new text index with language_override: none');
    
    // Create other necessary indexes
    console.log('\n🔨 Creating other indexes...');
    
    // userId and lastMessageAt for sorting
    try {
      await collection.createIndex({ userId: 1, lastMessageAt: -1 });
      console.log('✅ Created userId + lastMessageAt index');
    } catch (error) {
      console.log('⚠️ userId + lastMessageAt index already exists');
    }
    
    // sessionId unique index
    try {
      await collection.createIndex({ sessionId: 1 }, { unique: true });
      console.log('✅ Created sessionId unique index');
    } catch (error) {
      console.log('⚠️ sessionId unique index already exists');
    }
    
    // userId index
    try {
      await collection.createIndex({ userId: 1 });
      console.log('✅ Created userId index');
    } catch (error) {
      console.log('⚠️ userId index already exists');
    }
    
    console.log('\n📋 Final indexes:');
    const finalIndexes = await collection.indexes();
    finalIndexes.forEach(index => {
      console.log(`- ${index.name}:`, JSON.stringify(index.key, null, 2));
      if (index.default_language || index.language_override) {
        console.log(`  Language settings:`, {
          default_language: index.default_language,
          language_override: index.language_override
        });
      }
    });
    
    await connection.close();
    console.log('\n✅ Chat session indexes fixed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error fixing indexes:', error.message);
    process.exit(1);
  }
}

fixChatIndexes();
