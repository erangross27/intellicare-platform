#!/usr/bin/env node

/**
 * Export translations from MongoDB to static JSON files
 * This eliminates the need for network requests and provides instant loading
 */

const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/intellicare_global';

async function exportTranslations() {
  let client;
  
  try {
    console.log('🚀 [EXPORT] Connecting to MongoDB...');
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    
    const db = client.db();
    const collection = db.collection('translations');
    
    console.log('📋 [EXPORT] Fetching all translations...');
    const translations = await collection.find({}).toArray();
    
    if (translations.length === 0) {
      console.warn('❌ [EXPORT] No translations found in database');
      return;
    }
    
    console.log(`✅ [EXPORT] Found ${translations.length} language(s)`);
    
    // Create output directory
    const outputDir = path.join(__dirname, '../frontend/src/translations');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
      console.log(`📁 [EXPORT] Created directory: ${outputDir}`);
    }
    
    // Export each language to a separate file
    for (const translation of translations) {
      const { language, languageName, isRTL, translations: translationData, version, updatedAt } = translation;
      
      const exportData = {
        language,
        languageName,
        isRTL: isRTL || false,
        translations: translationData,
        version: version || '1.0.0',
        lastUpdated: updatedAt || new Date(),
        source: 'STATIC_FILE',
        translationCount: Object.keys(translationData || {}).length,
        exportedAt: new Date().toISOString()
      };
      
      const filename = `${language}.json`;
      const filepath = path.join(outputDir, filename);
      
      fs.writeFileSync(filepath, JSON.stringify(exportData, null, 2));
      console.log(`💾 [EXPORT] Exported ${language} (${exportData.translationCount} keys) to ${filename}`);
    }
    
    // Create index file with available languages
    const languageIndex = translations.map(t => ({
      code: t.language,
      name: t.languageName,
      isRTL: t.isRTL || false,
      file: `${t.language}.json`,
      translationCount: Object.keys(t.translations || {}).length
    }));
    
    const indexData = {
      languages: languageIndex,
      exportedAt: new Date().toISOString(),
      totalLanguages: languageIndex.length,
      source: 'STATIC_FILES'
    };
    
    const indexPath = path.join(outputDir, 'index.json');
    fs.writeFileSync(indexPath, JSON.stringify(indexData, null, 2));
    console.log(`📋 [EXPORT] Created language index: index.json`);
    
    console.log('✅ [EXPORT] Translation export completed successfully!');
    console.log(`📁 [EXPORT] Files exported to: ${outputDir}`);
    console.log(`🔢 [EXPORT] Total languages: ${translations.length}`);
    console.log(`📊 [EXPORT] Total translation keys: ${translations.reduce((sum, t) => sum + Object.keys(t.translations || {}).length, 0)}`);
    
  } catch (error) {
    console.error('❌ [EXPORT] Export failed:', error);
    process.exit(1);
  } finally {
    if (client) {
      await client.close();
      console.log('🔌 [EXPORT] MongoDB connection closed');
    }
  }
}

// Run the export
if (require.main === module) {
  exportTranslations().catch(console.error);
}

module.exports = { exportTranslations };
