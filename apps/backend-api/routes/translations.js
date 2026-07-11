const SecureDataAccess = require('../services/secureDataAccess');
const express = require('express');
const secureConfigService = require('../services/secureConfigService');
const { MongoClient } = require('mongodb');
const router = express.Router();

// MongoDB connection
const MONGODB_URI = secureConfigService.get('MONGODB_URI') || 'mongodb://localhost:27017';
const DATABASE_NAME = secureConfigService.get('SHARED_DB_NAME') || 'intellicare_global';

let db;

// Initialize database connection
async function initDB() {
  if (!db) {
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    db = client.db(DATABASE_NAME);
  }
  return db;
}

// 🚀 NEW: Get specific translation keys for a page/component
router.get('/:language/keys/:keys', async (req, res) => {
  try {
    const { language, keys } = req.params;
    const requestedKeys = keys.split(',');

    console.log(`🎯 [BACKEND] Page-specific translation request for ${language}: ${requestedKeys.join(', ')}`);

    const context = {
      serviceId: 'translations-route',
      operation: 'getTranslationKeys',
      practiceId: req.practice?.id || 'global'
    };
    const translations = await SecureDataAccess.query('translations', { language: language }, { limit: 1 }, context);
    const translationDoc = translations[0];

    if (!translationDoc || !translationDoc.translations) {
      return res.status(404).json({
        success: false,
        error: `No translations found for language: ${language}`
      });
    }

    // Extract only requested keys
    const filteredTranslations = {};
    requestedKeys.forEach(key => {
      if (translationDoc.translations[key]) {
        filteredTranslations[key] = translationDoc.translations[key];
      }
    });

    console.log(`✅ [BACKEND] Returning ${Object.keys(filteredTranslations).length}/${requestedKeys.length} translations for ${language}`);

    // 🚀 PERFORMANCE: Add caching headers
    res.set({
      'Cache-Control': 'public, max-age=3600, s-maxage=7200', // 1hr client, 2hr CDN
      'ETag': `"${language}-${keys}-${translationDoc.updatedAt?.getTime() || Date.now()}"`,
      'Last-Modified': translationDoc.updatedAt?.toUTCString() || new Date().toUTCString(),
      'Vary': 'Accept-Language'
    });

    res.json({
      success: true,
      data: {
        language: translationDoc.language,
        languageName: translationDoc.languageName,
        isRTL: translationDoc.isRTL || false,
        translations: filteredTranslations,
        version: translationDoc.version,
        lastUpdated: translationDoc.updatedAt,
        source: 'DATABASE_FILTERED',
        translationCount: Object.keys(filteredTranslations).length,
        requestedKeys: requestedKeys
      }
    });
  } catch (error) {
    console.error('❌ [BACKEND] Error fetching filtered translations:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch filtered translations: ' + error.message,
      source: 'DATABASE_ERROR'
    });
  }
});

// Get translations for a specific language (full set)
router.get('/:language', async (req, res) => {
  try {
    const { language } = req.params;
    
    console.log(`🌐 [BACKEND] Translation request received for language: ${language}`);
    console.log(`🔗 [BACKEND] Request from: ${req.get('origin') || 'unknown'}`);
    
    await initDB();
    const collection = db.collection('translations');
    
    console.log(`📊 [BACKEND] Connected to MongoDB database: ${DATABASE_NAME}`);
    
    const context = {
      serviceId: 'translations-route',
      operation: 'getAllTranslations',
      practiceId: req.practice?.id || 'global'
    };
    const translations = await SecureDataAccess.query('translations', { language: language }, { limit: 1 }, context);
    const translationDoc = translations[0];
    
    if (!translationDoc) {
      console.log(`❌ [BACKEND] No translations found in database for language: ${language}`);
      return res.status(404).json({ 
        success: false,
        error: `Translations not found for language: ${language}`,
        availableLanguages: await getAvailableLanguages()
      });
    }
    
    const translationCount = Object.keys(translationDoc.translations || {}).length;
    console.log(`✅ [BACKEND] Successfully loaded ${translationCount} translations from MongoDB for language: ${language}`);
    
    // 🚀 PERFORMANCE: Add caching headers for better performance
    res.set({
      'Cache-Control': 'public, max-age=1800, s-maxage=3600', // 30min client, 1hr CDN
      'ETag': `"${translationDoc._id}-${translationDoc.updatedAt?.getTime() || Date.now()}"`,
      'Last-Modified': translationDoc.updatedAt?.toUTCString() || new Date().toUTCString(),
      'Vary': 'Accept-Language'
    });

    res.json({
      success: true,
      data: {
        language: translationDoc.language,
        languageName: translationDoc.languageName,
        isRTL: translationDoc.isRTL || false,
        translations: translationDoc.translations,
        version: translationDoc.version,
        lastUpdated: translationDoc.updatedAt,
        source: 'DATABASE',
        translationCount: translationCount
      }
    });
  } catch (error) {
    console.error('❌ [BACKEND] Error fetching translations from database:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch translations: ' + error.message,
      source: 'DATABASE_ERROR'
    });
  }
});

// Get all available languages
router.get('/', async (req, res) => {
  try {
    await initDB();
    const collection = db.collection('translations');
    
    const languages = await collection.query(
      {},
      {
        projection: {
          language: 1,
          languageName: 1,
          isRTL: 1,
          version: 1,
          updatedAt: 1,
          _id: 0
        }
      }
    ).toArray();

    // 🚀 PERFORMANCE: Add caching headers for available languages
    res.set({
      'Cache-Control': 'public, max-age=3600, s-maxage=7200', // 1hr client, 2hr CDN
      'ETag': `"languages-${languages.length}-${Date.now()}"`,
      'Vary': 'Accept-Language'
    });

    res.json({
      success: true,
      data: languages
    });
  } catch (error) {
    console.error('Error fetching available languages:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch available languages: ' + error.message 
    });
  }
});

// Update translations for a specific language (admin only)
router.put('/:language', async (req, res) => {
  try {
    const { language } = req.params;
    const { translations, languageName, isRTL } = req.body;
    
    if (!translations || typeof translations !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'Invalid translations data provided'
      });
    }
    
    await initDB();
    const collection = db.collection('translations');
    
    const updateData = {
      language: language,
      translations: translations,
      updatedAt: new Date()
    };
    
    if (languageName) updateData.languageName = languageName;
    if (typeof isRTL === 'boolean') updateData.isRTL = isRTL;
    
    const updateContext = {
      serviceId: 'translations-route',
      operation: 'updateTranslation',
      practiceId: req.practice?.id || 'global'
    };
    const result = await SecureDataAccess.update('translations', 
      { language: language },
      { 
        $set: updateData,
        $setOnInsert: {
          createdAt: new Date(),
          version: '1.0.0',
          category: 'ui'
        }
      },
      updateContext
    );
    
    res.json({
      success: true,
      message: `Translations updated successfully for language: ${language}`,
      modified: result.modifiedCount,
      upserted: result.upsertedCount
    });
  } catch (error) {
    console.error('Error updating translations:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to update translations: ' + error.message 
    });
  }
});

// Add a new translation key to all languages
router.post('/add-key', async (req, res) => {
  try {
    const { key, translations } = req.body;
    
    if (!key || !translations || typeof translations !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'Key and translations object are required'
      });
    }
    
    await initDB();
    const collection = db.collection('translations');
    
    const results = [];
    
    for (const [language, translation] of Object.entries(translations)) {
      const updateCtx = {
        serviceId: 'translations-route',
        operation: 'updateTranslationKey',
        practiceId: req.practice?.id || 'global'
      };
      const result = await SecureDataAccess.update('translations',
        { language: language },
        { 
          $set: { 
            [`translations.${key}`]: translation,
            updatedAt: new Date()
          }
        },
        updateCtx
      );
      results.push({ language, modified: result.modifiedCount });
    }
    
    res.json({
      success: true,
      message: `Translation key '${key}' added to all languages`,
      results: results
    });
  } catch (error) {
    console.error('Error adding translation key:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to add translation key: ' + error.message 
    });
  }
});

// Delete a translation key from all languages
router.delete('/key/:key', async (req, res) => {
  try {
    const { key } = req.params;
    
    await initDB();
    const collection = db.collection('translations');
    
    const result = await collection.updateMany(
      {},
      { 
        $unset: { [`translations.${key}`]: "" },
        $set: { updatedAt: new Date() }
      }
    );
    
    res.json({
      success: true,
      message: `Translation key '${key}' removed from all languages`,
      modified: result.modifiedCount
    });
  } catch (error) {
    console.error('Error deleting translation key:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to delete translation key: ' + error.message 
    });
  }
});

// Helper function to get available languages
async function getAvailableLanguages() {
  try {
    await initDB();
    const collection = db.collection('translations');
    const languages = await collection.query({}, { projection: { language: 1, _id: 0 } }).toArray();
    return languages.map(l => l.language);
  } catch (error) {
    console.error('Error getting available languages:', error);
    return [];
  }
}

// Health check endpoint
router.get('/health/check', async (req, res) => {
  try {
    await initDB();
    const collection = db.collection('translations');
    const count = await collection.countDocuments();
    
    res.json({
      success: true,
      status: 'healthy',
      translationsCount: count,
      database: DATABASE_NAME,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      status: 'unhealthy',
      error: error.message
    });
  }
});

module.exports = router;
