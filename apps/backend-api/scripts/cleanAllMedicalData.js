#!/usr/bin/env node

/**
 * Database Cleanup Script - Removes all medical data, documents, and patient linkages
 * Run with: node scripts/cleanAllMedicalData.js
 */

const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');

// Database configuration
const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/intellicare_practice_global?authSource=admin';
const PRACTICE_DB = 'intellicare_practice_yale';

// Get all medical collections from the service
const medicalCollectionsService = require('../services/medicalCollectionsService');
const allCollections = medicalCollectionsService.getAllCollections();

async function cleanDatabase() {
  const client = new MongoClient(MONGO_URI);

  try {
    console.log('🔌 Connecting to MongoDB...');
    await client.connect();

    const db = client.db(PRACTICE_DB);
    console.log(`✅ Connected to database: ${PRACTICE_DB}\n`);

    // Step 1: Clean all medical data collections
    console.log('📊 Cleaning medical data collections...');
    let totalDeleted = 0;

    // Process collections in parallel batches for speed
    const batchSize = 10;
    for (let i = 0; i < allCollections.length; i += batchSize) {
      const batch = allCollections.slice(i, i + batchSize);

      const deletePromises = batch.map(async (collectionName) => {
        try {
          const collection = db.collection(collectionName);
          const result = await collection.deleteMany({});

          if (result.deletedCount > 0) {
            console.log(`   ✓ ${collectionName}: Deleted ${result.deletedCount} documents`);
            return result.deletedCount;
          }
          return 0;
        } catch (error) {
          // Collection might not exist yet, which is fine
          return 0;
        }
      });

      const results = await Promise.all(deletePromises);
      totalDeleted += results.reduce((sum, count) => sum + count, 0);
    }

    console.log(`   📊 Total medical data deleted: ${totalDeleted} documents\n`);

    // Step 2: Clean documents collection
    console.log('📄 Cleaning documents collection...');
    const documentsCollection = db.collection('documents');
    const docResult = await documentsCollection.deleteMany({});
    console.log(`   ✓ Deleted ${docResult.deletedCount} documents\n`);

    // Step 3: Clean patient medical data linkage arrays and ALL medical counts
    console.log('🔗 Cleaning patient medical data linkages...');
    const patientsCollection = db.collection('patients');

    // STRATEGY: Find ALL fields ending with "Count" from ALL patients
    // since different patients may have different count fields
    console.log('   🔍 Scanning all patients to find count fields...');

    const allPatients = await patientsCollection.find({}).toArray();
    const countsToUnset = new Set();

    // Scan ALL patients to find every possible count field
    allPatients.forEach(patient => {
      Object.keys(patient).forEach(key => {
        if (key.endsWith('Count')) {
          countsToUnset.add(key);
        }
      });
    });

    // Build list of all count fields from medical collections (just in case)
    allCollections.forEach(collection => {
      // Convert collection name to count field name
      // e.g., 'medications' -> 'medicationsCount'
      const countField = `${collection.replace(/_/g, '')}Count`;
      countsToUnset.add(countField);
    });

    // Convert Set to object for MongoDB $unset
    const unsetFields = {};
    countsToUnset.forEach(field => {
      unsetFields[field] = '';
    });

    console.log(`   📊 Found ${countsToUnset.size} unique count fields across all patients:`);
    Array.from(countsToUnset).sort().forEach(field => {
      console.log(`      → ${field}`);
    });
    console.log('');

    const updateResult = await patientsCollection.updateMany(
      {},
      {
        $set: {
          medicalData: {},
          medicalHistory: [],
          documents: [],
          doctorSummary: ''  // Clear doctor summary from old patients
        },
        $unset: unsetFields
      }
    );
    console.log(`   ✓ Cleared medical data for ${updateResult.modifiedCount} patients`);
    console.log(`   ✓ Removed ${countsToUnset.size} medical count fields`);
    console.log(`   ✓ Cleared doctorSummary field\n`);

    // Step 4: Clean chat messages that reference medical data
    console.log('💬 Cleaning chat medical data references...');
    const chatsCollection = db.collection('chats');
    const chatResult = await chatsCollection.updateMany(
      { 'messages.extractedData': { $exists: true } },
      { $unset: { 'messages.$[].extractedData': '' } }
    );
    console.log(`   ✓ Cleaned ${chatResult.modifiedCount} chat conversations\n`);

    // Step 5: Clean batch_progress collection
    console.log('📈 Cleaning batch progress data...');
    const batchProgressCollection = db.collection('batch_progress');
    const batchResult = await batchProgressCollection.deleteMany({});
    console.log(`   ✓ Deleted ${batchResult.deletedCount} batch progress records\n`);

    // Step 6: Clean pendinguploads collection
    console.log('📋 Cleaning pending uploads...');
    const pendingUploadsCollection = db.collection('pendinguploads');
    const pendingResult = await pendingUploadsCollection.deleteMany({});
    console.log(`   ✓ Deleted ${pendingResult.deletedCount} pending uploads\n`);

    // Summary
    console.log('✨ Database cleanup complete!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`   Medical data cleaned: ${totalDeleted} documents`);
    console.log(`   Documents deleted: ${docResult.deletedCount}`);
    console.log(`   Patients updated: ${updateResult.modifiedCount}`);
    console.log(`   Chats cleaned: ${chatResult.modifiedCount}`);
    console.log(`   Batch progress cleared: ${batchResult.deletedCount}`);
    console.log(`   Pending uploads cleared: ${pendingResult.deletedCount}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  } catch (error) {
    console.error('❌ Error cleaning database:', error.message);
    process.exit(1);
  } finally {
    await client.close();
    console.log('👋 Database connection closed');
  }
}

// Run the cleanup
cleanDatabase().catch(console.error);