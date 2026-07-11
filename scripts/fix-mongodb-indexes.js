const mongoose = require('mongoose');

async function fixMongoDBIndexes() {
  try {
    console.log('🔧 Fixing MongoDB indexes for Hebrew language support...');
    
    // Connect to MongoDB
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
    const connection = await mongoose.createConnection(mongoURI, {
      dbName: 'intellicare_developer'
    });
    
    console.log('✅ Connected to MongoDB');
    
    // Get collections that might have problematic text indexes
    const collections = ['chat_sessions', 'chat_messages'];
    
    for (const collectionName of collections) {
      try {
        const collection = connection.collection(collectionName);
        
        console.log(`\n📋 Checking collection: ${collectionName}`);
        
        // List existing indexes
        const indexes = await collection.indexes();
        console.log(`Found ${indexes.length} indexes`);
        
        // Drop problematic text indexes
        for (const index of indexes) {
          if (index.name !== '_id_' && (
            index.default_language || 
            index.language_override || 
            (index.key && Object.values(index.key).includes('text'))
          )) {
            try {
              console.log(`🗑️ Dropping problematic index: ${index.name}`);
              await collection.dropIndex(index.name);
              console.log(`✅ Dropped index: ${index.name}`);
            } catch (error) {
              console.log(`⚠️ Could not drop index ${index.name}:`, error.message);
            }
          }
        }
        
        // Create safe indexes for chat_sessions
        if (collectionName === 'chat_sessions') {
          try {
            await collection.createIndex({ userId: 1, lastMessageAt: -1 });
            console.log('✅ Created userId + lastMessageAt index');
          } catch (error) {
            console.log('⚠️ userId + lastMessageAt index already exists');
          }
          
          try {
            await collection.createIndex({ sessionId: 1 }, { unique: true });
            console.log('✅ Created sessionId unique index');
          } catch (error) {
            console.log('⚠️ sessionId unique index already exists');
          }
          
          try {
            await collection.createIndex({ userId: 1 });
            console.log('✅ Created userId index');
          } catch (error) {
            console.log('⚠️ userId index already exists');
          }
        }
        
        // Create safe indexes for chat_messages
        if (collectionName === 'chat_messages') {
          try {
            await collection.createIndex({ sessionId: 1, sequenceNumber: 1 });
            console.log('✅ Created sessionId + sequenceNumber index');
          } catch (error) {
            console.log('⚠️ sessionId + sequenceNumber index already exists');
          }
          
          try {
            await collection.createIndex({ userId: 1, createdAt: -1 });
            console.log('✅ Created userId + createdAt index');
          } catch (error) {
            console.log('⚠️ userId + createdAt index already exists');
          }
          
          try {
            await collection.createIndex({ messageId: 1 }, { unique: true });
            console.log('✅ Created messageId unique index');
          } catch (error) {
            console.log('⚠️ messageId unique index already exists');
          }
        }
        
      } catch (error) {
        console.log(`⚠️ Collection ${collectionName} does not exist or error:`, error.message);
      }
    }
    
    await connection.close();
    console.log('\n✅ MongoDB indexes fixed successfully!');
    console.log('🔄 Please restart the backend server to apply changes.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error fixing indexes:', error.message);
    process.exit(1);
  }
}

fixMongoDBIndexes();
