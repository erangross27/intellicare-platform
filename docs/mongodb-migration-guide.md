# MongoDB Translation System & Cloud Migration Guide

## Overview
This guide explains how to move the multilanguage system to MongoDB and migrate your medical platform to the cloud with database backup/restore capabilities.

## Part 1: Moving Translations to MongoDB

### 1.1 Database Schema Design

Create a new MongoDB collection for translations:

```javascript
// Collection: translations
{
  _id: ObjectId("..."),
  language: "en", // Language code (en, he, ar, etc.)
  category: "ui", // Category: ui, medical, errors, etc.
  translations: {
    // Patient Details
    patientDetails: "Patient Details",
    overview: "Overview",
    documents: "Documents",
    history: "History",
    analysis: "Analysis",
    
    // Medical Terms
    labResults: "Lab Results",
    labResultsDetails: "Lab Results Details",
    symptoms: "Symptoms",
    bloodPressure: "Blood Pressure",
    heartRate: "Heart Rate",
    
    // Actions & Buttons
    save: "Save",
    cancel: "Cancel",
    edit: "Edit",
    delete: "Delete",
    
    // Status Messages
    loading: "Loading...",
    success: "Success",
    error: "Error occurred"
  },
  createdAt: ISODate("2025-01-26T15:30:00Z"),
  updatedAt: ISODate("2025-01-26T15:30:00Z"),
  version: "1.0.0" // For versioning translations
}
```

### 1.2 Backend API Implementation

Create translation management endpoints:

```javascript
// backend/routes/translations.js
const express = require('express');
const router = express.Router();

// Get translations for a specific language
router.get('/:language', async (req, res) => {
  try {
    const { language } = req.params;
    const translations = await db.collection('translations')
      .findOne({ language: language });
    
    if (!translations) {
      return res.status(404).json({ 
        error: 'Translations not found for language: ' + language 
      });
    }
    
    res.json({
      success: true,
      data: translations.translations
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update translations for a specific language
router.put('/:language', async (req, res) => {
  try {
    const { language } = req.params;
    const { translations } = req.body;
    
    const result = await db.collection('translations').updateOne(
      { language: language },
      { 
        $set: { 
          translations: translations,
          updatedAt: new Date()
        }
      },
      { upsert: true }
    );
    
    res.json({
      success: true,
      message: 'Translations updated successfully'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all available languages
router.get('/', async (req, res) => {
  try {
    const languages = await db.collection('translations')
      .find({}, { projection: { language: 1, _id: 0 } })
      .toArray();
    
    res.json({
      success: true,
      data: languages.map(l => l.language)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
```

### 1.3 Frontend Translation Service

Update the language configuration to fetch from API:

```javascript
// frontend/src/config/languages.js
import { useState, useEffect, createContext, useContext } from 'react';

const LanguageContext = createContext();

// Translation service to fetch from MongoDB
class TranslationService {
  constructor() {
    this.cache = new Map();
    this.currentLanguage = 'en';
  }

  async loadTranslations(language) {
    if (this.cache.has(language)) {
      return this.cache.get(language);
    }

    try {
      const response = await fetch(`/api/translations/${language}`);
      const data = await response.json();
      
      if (data.success) {
        this.cache.set(language, data.data);
        return data.data;
      }
    } catch (error) {
      console.error('Failed to load translations:', error);
      // Fallback to default English translations
      return this.getDefaultTranslations();
    }
  }

  getDefaultTranslations() {
    return {
      patientDetails: 'Patient Details',
      labResults: 'Lab Results',
      loading: 'Loading...',
      // ... other default translations
    };
  }

  async setLanguage(language) {
    this.currentLanguage = language;
    await this.loadTranslations(language);
  }
}

const translationService = new TranslationService();

// Language Provider Component
export const LanguageProvider = ({ children }) => {
  const [currentLanguage, setCurrentLanguage] = useState('en');
  const [translations, setTranslations] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLanguage(currentLanguage);
  }, [currentLanguage]);

  const loadLanguage = async (language) => {
    setLoading(true);
    try {
      const translations = await translationService.loadTranslations(language);
      setTranslations(translations);
    } catch (error) {
      console.error('Failed to load language:', error);
    } finally {
      setLoading(false);
    }
  };

  const changeLanguage = async (language) => {
    setCurrentLanguage(language);
    await translationService.setLanguage(language);
  };

  const t = (key) => {
    return translations[key] || key;
  };

  const value = {
    currentLanguage,
    translations,
    loading,
    changeLanguage,
    t,
    isRTL: currentLanguage === 'he' || currentLanguage === 'ar'
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};

// Hook to use translations
export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }
  return context;
};
```

### 1.4 Migration Script

Create a script to migrate existing translations to MongoDB:

```javascript
// scripts/migrate-translations.js
const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');

async function migrateTranslations() {
  const client = new MongoClient(process.env.MONGODB_URI);
  
  try {
    await client.connect();
    const db = client.db('medical_doctor');
    const collection = db.collection('translations');

    // Read existing translations from file
    const translationsPath = path.join(__dirname, '../frontend/src/config/languages.js');
    const translationsFile = fs.readFileSync(translationsPath, 'utf8');
    
    // Extract translations (you'll need to parse the TRANSLATIONS object)
    const englishTranslations = {
      // Copy from your existing TRANSLATIONS.en object
      patientDetails: 'Patient Details',
      labResults: 'Lab Results',
      // ... all other translations
    };

    const hebrewTranslations = {
      // Copy from your existing TRANSLATIONS.he object
      patientDetails: 'פרטי מטופל',
      labResults: 'תוצאות מעבדה',
      // ... all other translations
    };

    // Insert English translations
    await collection.updateOne(
      { language: 'en' },
      {
        $set: {
          language: 'en',
          category: 'ui',
          translations: englishTranslations,
          createdAt: new Date(),
          updatedAt: new Date(),
          version: '1.0.0'
        }
      },
      { upsert: true }
    );

    // Insert Hebrew translations
    await collection.updateOne(
      { language: 'he' },
      {
        $set: {
          language: 'he',
          category: 'ui',
          translations: hebrewTranslations,
          createdAt: new Date(),
          updatedAt: new Date(),
          version: '1.0.0'
        }
      },
      { upsert: true }
    );

    console.log('✅ Translations migrated successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    await client.close();
  }
}

// Run migration
migrateTranslations();
```

## Part 2: Cloud Migration & Database Backup/Restore

### 2.1 MongoDB Atlas Setup

1. **Create MongoDB Atlas Account**:
   - Go to https://www.mongodb.com/atlas
   - Create a free account
   - Create a new cluster (M0 Sandbox for free tier)

2. **Configure Network Access**:
   - Add your current IP address
   - For production, add your server's IP addresses

3. **Create Database User**:
   - Create a database user with read/write permissions
   - Save the username and password securely

4. **Get Connection String**:
   ```
   mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/<database_name>?retryWrites=true&w=majority
   ```

### 2.2 Local to Cloud Migration Script

```javascript
// scripts/migrate-to-cloud.js
const { MongoClient } = require('mongodb');

async function migrateToCloud() {
  // Local MongoDB connection
  const localClient = new MongoClient('mongodb://localhost:27017');
  
  // Cloud MongoDB connection (Atlas)
  const cloudClient = new MongoClient(process.env.MONGODB_ATLAS_URI);

  try {
    await localClient.connect();
    await cloudClient.connect();

    const localDb = localClient.db('medical_doctor');
    const cloudDb = cloudClient.db('medical_doctor');

    // Get all collection names
    const collections = await localDb.listCollections().toArray();
    
    console.log('🚀 Starting migration to cloud...');

    for (const collectionInfo of collections) {
      const collectionName = collectionInfo.name;
      console.log(`📦 Migrating collection: ${collectionName}`);

      // Get all documents from local collection
      const localCollection = localDb.collection(collectionName);
      const documents = await localCollection.find({}).toArray();

      if (documents.length > 0) {
        // Insert documents into cloud collection
        const cloudCollection = cloudDb.collection(collectionName);
        await cloudCollection.insertMany(documents);
        console.log(`✅ Migrated ${documents.length} documents to ${collectionName}`);
      }
    }

    console.log('🎉 Migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    await localClient.close();
    await cloudClient.close();
  }
}

migrateToCloud();
```

### 2.3 Backup & Restore Scripts

**Backup Script:**
```javascript
// scripts/backup-database.js
const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');

async function backupDatabase() {
  const client = new MongoClient(process.env.MONGODB_URI);
  
  try {
    await client.connect();
    const db = client.db('medical_doctor');
    
    const backup = {
      timestamp: new Date().toISOString(),
      collections: {}
    };

    // Get all collections
    const collections = await db.listCollections().toArray();
    
    for (const collectionInfo of collections) {
      const collectionName = collectionInfo.name;
      const collection = db.collection(collectionName);
      const documents = await collection.find({}).toArray();
      
      backup.collections[collectionName] = documents;
      console.log(`✅ Backed up ${documents.length} documents from ${collectionName}`);
    }

    // Save backup to file
    const backupDir = path.join(__dirname, '../backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const filename = `backup-${new Date().toISOString().split('T')[0]}.json`;
    const filepath = path.join(backupDir, filename);
    
    fs.writeFileSync(filepath, JSON.stringify(backup, null, 2));
    console.log(`💾 Backup saved to: ${filepath}`);
    
  } catch (error) {
    console.error('❌ Backup failed:', error);
  } finally {
    await client.close();
  }
}

backupDatabase();
```

**Restore Script:**
```javascript
// scripts/restore-database.js
const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');

async function restoreDatabase(backupFile) {
  const client = new MongoClient(process.env.MONGODB_URI);
  
  try {
    await client.connect();
    const db = client.db('medical_doctor');
    
    // Read backup file
    const backupPath = path.join(__dirname, '../backups', backupFile);
    const backupData = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
    
    console.log(`🔄 Restoring from backup: ${backupFile}`);
    console.log(`📅 Backup timestamp: ${backupData.timestamp}`);

    // Restore each collection
    for (const [collectionName, documents] of Object.entries(backupData.collections)) {
      if (documents.length > 0) {
        const collection = db.collection(collectionName);
        
        // Clear existing data (optional - remove if you want to merge)
        await collection.deleteMany({});
        
        // Insert backup data
        await collection.insertMany(documents);
        console.log(`✅ Restored ${documents.length} documents to ${collectionName}`);
      }
    }

    console.log('🎉 Database restored successfully!');
    
  } catch (error) {
    console.error('❌ Restore failed:', error);
  } finally {
    await client.close();
  }
}

// Usage: node restore-database.js backup-2025-01-26.json
const backupFile = process.argv[2];
if (!backupFile) {
  console.error('Please provide backup file name');
  process.exit(1);
}

restoreDatabase(backupFile);
```

### 2.4 Environment Configuration

Update your environment variables:

```bash
# .env (for local development)
MONGODB_URI=mongodb://localhost:27017/medical_doctor

# .env.production (for cloud deployment)
MONGODB_URI=mongodb+srv://username:<DB_PASSWORD>@cluster0.xxxxx.mongodb.net/medical_doctor?retryWrites=true&w=majority
MONGODB_ATLAS_URI=mongodb+srv://username:<DB_PASSWORD>@cluster0.xxxxx.mongodb.net/medical_doctor?retryWrites=true&w=majority
```

### 2.5 Automated Backup Schedule

Create a scheduled backup using cron (Linux/Mac) or Task Scheduler (Windows):

```bash
# Add to crontab (crontab -e)
# Daily backup at 2 AM
0 2 * * * cd /path/to/your/project && node scripts/backup-database.js

# Weekly backup cleanup (keep only last 30 days)
0 3 * * 0 find /path/to/your/project/backups -name "backup-*.json" -mtime +30 -delete
```

### 2.6 Package.json Scripts

Add convenient npm scripts:

```json
{
  "scripts": {
    "migrate:translations": "node scripts/migrate-translations.js",
    "migrate:cloud": "node scripts/migrate-to-cloud.js",
    "backup": "node scripts/backup-database.js",
    "restore": "node scripts/restore-database.js",
    "dev": "concurrently \"npm run dev:backend\" \"npm run dev:frontend\"",
    "dev:backend": "cd backend && npm run dev",
    "dev:frontend": "cd frontend && npm start"
  }
}
```

## Part 3: Implementation Steps

### Step 1: Prepare for Migration
1. Create backup of current database: `npm run backup`
2. Test the backup/restore process locally
3. Set up MongoDB Atlas account and cluster

### Step 2: Migrate Translations
1. Run translation migration: `npm run migrate:translations`
2. Update frontend to use new translation service
3. Test multilanguage functionality

### Step 3: Cloud Migration
1. Update environment variables with Atlas connection string
2. Run cloud migration: `npm run migrate:cloud`
3. Update application to use cloud database
4. Test all functionality

### Step 4: Set Up Automated Backups
1. Configure automated backup schedule
2. Test restore process
3. Document backup/restore procedures

## Part 4: Benefits of This Approach

### Database Benefits:
- **Scalability**: MongoDB Atlas auto-scales based on usage
- **Reliability**: Built-in replication and backup
- **Security**: Enterprise-grade security features
- **Global Distribution**: Deploy closer to users worldwide

### Translation Benefits:
- **Dynamic Updates**: Update translations without code deployment
- **Version Control**: Track translation changes over time
- **Multi-tenant**: Support different translations per organization
- **Performance**: Cached translations for fast loading

### Backup Benefits:
- **Automated**: Scheduled backups without manual intervention
- **Versioned**: Multiple backup points for different restore scenarios
- **Portable**: JSON format allows easy migration between systems
- **Incremental**: Only backup changed data (can be implemented)

This comprehensive system ensures your medical platform is ready for production use with proper internationalization and reliable cloud infrastructure.
