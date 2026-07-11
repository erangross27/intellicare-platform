#!/usr/bin/env node
/**
 * Create MongoDB indexes for fast memory search
 * Indexes improve query performance for filtering and text search
 */

const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');

// Read MongoDB URI
const MONGO_URI = fs.readFileSync(
  path.join(__dirname, '../apps/backend-api/.kms/MONGODB_ADMIN_URI'),
  'utf8'
).trim();

const DB_NAME = 'claude_memory';

async function createIndexes() {
  console.log('🔧 Creating MongoDB indexes for fast search...\n');

  const client = new MongoClient(MONGO_URI);

  try {
    await client.connect();
    const db = client.db(DB_NAME);
    const collection = db.collection('memories');

    // Drop all existing indexes except _id
    console.log('🗑️  Dropping existing indexes (except _id)...');
    await collection.dropIndexes();
    console.log('   ✅ Existing indexes dropped\n');

    // 1. Text index for full-text search on content
    console.log('📝 Creating text index on content...');
    await collection.createIndex(
      { content: 'text', tags: 'text' },
      {
        name: 'content_tags_text',
        weights: {
          content: 10,  // Content is more important than tags
          tags: 5
        },
        default_language: 'english'
      }
    );
    console.log('   ✅ Text index created (content + tags)\n');

    // 2. Compound index for project + category queries
    console.log('📝 Creating compound index: project + category...');
    await collection.createIndex(
      { project: 1, category: 1, timestamp: -1 },
      { name: 'project_category_timestamp' }
    );
    console.log('   ✅ Compound index created\n');

    // 3. Index for timestamp (recent memories)
    console.log('📝 Creating index on timestamp...');
    await collection.createIndex(
      { timestamp: -1 },
      { name: 'timestamp_desc' }
    );
    console.log('   ✅ Timestamp index created\n');

    // 4. Index for tags (array field)
    console.log('📝 Creating index on tags array...');
    await collection.createIndex(
      { tags: 1 },
      { name: 'tags_index' }
    );
    console.log('   ✅ Tags index created\n');

    // 5. Index for category
    console.log('📝 Creating index on category...');
    await collection.createIndex(
      { category: 1 },
      { name: 'category_index' }
    );
    console.log('   ✅ Category index created\n');

    // 6. Index for project
    console.log('📝 Creating index on project...');
    await collection.createIndex(
      { project: 1 },
      { name: 'project_index' }
    );
    console.log('   ✅ Project index created\n');

    // List all indexes
    console.log('📊 All indexes on memories collection:');
    const indexes = await collection.indexes();
    indexes.forEach(idx => {
      const fields = Object.keys(idx.key).join(', ');
      const type = idx.textIndexVersion ? 'TEXT' : 'BTREE';
      console.log(`   - ${idx.name} (${type}): ${fields}`);
    });

    console.log('\n✅ All indexes created successfully!');
    console.log('\n🚀 Search performance should now be significantly faster.');

  } catch (error) {
    console.error('❌ Index creation failed:', error);
    process.exit(1);
  } finally {
    await client.close();
  }
}

createIndexes();
