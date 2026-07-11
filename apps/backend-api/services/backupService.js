const BaseService = require('./baseService');
const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const SecureDataAccess = require('./secureDataAccess');
const serviceAccountManager = require('./serviceAccountManager');
const productionKMS = require('./productionKMS');
const cron = require('node-cron');

class BackupService extends BaseService {
  constructor() {
    super('backup-service');
    this.backupDir = path.join(__dirname, '..', 'backups');
    this.maxBackups = 30; // Keep 30 days of backups
    this.encryptionAlgorithm = 'aes-256-gcm';
    this.serviceToken = null;
    this.scheduledTask = null;
  }

  async onInitialize() {
    console.log('🔐 Authenticating BackupService...');
    
    // Authenticate service
    try {
      const auth = await serviceAccountManager.authenticate('backup-service');
      this.serviceToken = auth.token;
      console.log('✅ BackupService authenticated');
    } catch (error) {
      console.error('❌ Failed to authenticate BackupService:', error.message);
      throw error;
    }

    // Create backup directory if it doesn't exist
    try {
      await fs.mkdir(this.backupDir, { recursive: true });
      console.log(`✅ Backup directory ready: ${this.backupDir}`);
    } catch (error) {
      console.error('❌ Failed to create backup directory:', error);
      throw error;
    }

    // Schedule daily backups at 2 AM
    this.scheduleBackups();
  }

  async onDestroy() {
    // Stop scheduled backups
    if (this.scheduledTask) {
      this.scheduledTask.stop();
      console.log('🛑 Stopped scheduled backups');
    }
  }

  scheduleBackups() {
    // Schedule daily backup at 9:00 PM (21:00)
    this.scheduledTask = cron.schedule('0 21 * * *', async () => {
      console.log('⏰ Starting scheduled backup...');
      try {
        const result = await this.performFullBackup();
        console.log('✅ Scheduled backup completed:', result.filename);
        
        // Clean old backups
        await this.cleanOldBackups();
      } catch (error) {
        console.error('❌ Scheduled backup failed:', error);
        // Log to audit
        await this.logBackupEvent('scheduled_backup_failed', { error: error.message });
      }
    });
    
    console.log('📅 Scheduled daily backups at 9:00 PM (21:00)');
  }

  async performFullBackup() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupName = `backup-${timestamp}`;
    const backupPath = path.join(this.backupDir, backupName);
    
    console.log(`🔄 Starting full backup: ${backupName}`);
    
    try {
      // Create backup directory
      await fs.mkdir(backupPath, { recursive: true });
      
      // Backup databases
      const dbBackup = await this.backupDatabases(backupPath);
      
      // Backup KMS
      const kmsBackup = await this.backupKMS(backupPath);
      
      // Create backup manifest
      const manifest = {
        timestamp: new Date().toISOString(),
        version: '1.0',
        databases: dbBackup.databases,
        kmsKeys: kmsBackup.keys,
        checksum: null
      };
      
      // Calculate checksum
      manifest.checksum = this.calculateChecksum(JSON.stringify(manifest));
      
      // Save manifest
      await fs.writeFile(
        path.join(backupPath, 'manifest.json'),
        JSON.stringify(manifest, null, 2)
      );
      
      // Compress and encrypt backup
      const encryptedBackup = await this.compressAndEncrypt(backupPath);
      
      // Clean up unencrypted backup
      await this.removeDirectory(backupPath);
      
      // Log backup event
      await this.logBackupEvent('backup_completed', {
        filename: encryptedBackup,
        size: (await fs.stat(encryptedBackup)).size,
        databases: dbBackup.databases.length,
        kmsKeys: kmsBackup.keys.length
      });
      
      return {
        success: true,
        filename: encryptedBackup,
        manifest
      };
      
    } catch (error) {
      console.error('❌ Backup failed:', error);
      await this.logBackupEvent('backup_failed', { error: error.message });
      throw error;
    }
  }

  async backupDatabases(backupPath) {
    console.log('📦 Backing up databases...');
    const dbBackupPath = path.join(backupPath, 'databases');
    await fs.mkdir(dbBackupPath, { recursive: true });

    const databases = [];

    try {
      // Get list of all databases
      const mongoose = require('mongoose');
      const globalConn = await this.getConnection('intellicare_practice_global');
      const admin = globalConn.db.admin();
      const dbList = await admin.listDatabases();

      // Filter IntelliCare databases
      const intellicareDbs = dbList.databases.filter(db =>
        db.name.startsWith('intellicare_')
      );

      // Export each database using native Node.js approach
      for (const db of intellicareDbs) {
        console.log(`  Backing up ${db.name}...`);
        const backupFile = path.join(dbBackupPath, `${db.name}.json`);

        try {
          // Connect to the specific database
          const dbConn = await this.getConnection(db.name);
          const collections = await dbConn.db.listCollections().toArray();

          const dbBackup = {
            name: db.name,
            timestamp: new Date().toISOString(),
            collections: {}
          };

          // Backup each collection
          for (const collInfo of collections) {
            const collName = collInfo.name;
            if (collName.startsWith('system.')) continue; // Skip system collections

            const collection = dbConn.db.collection(collName);
            const documents = await collection.find({}).toArray();

            dbBackup.collections[collName] = {
              documents: documents,
              count: documents.length,
              indexes: await collection.indexes()
            };
          }

          // Compress and save
          const compressed = require('zlib').gzipSync(JSON.stringify(dbBackup));
          await fs.writeFile(backupFile + '.gz', compressed);

          databases.push({
            name: db.name,
            size: db.sizeOnDisk || 0,
            collections: Object.keys(dbBackup.collections).length,
            documents: Object.values(dbBackup.collections).reduce((sum, coll) => sum + coll.count, 0)
          });
        } catch (dbError) {
          console.warn(`  ⚠️ Could not backup ${db.name}:`, dbError.message);
        }
      }

      console.log(`✅ Backed up ${databases.length} databases`);
      return { databases };

    } catch (error) {
      console.error('❌ Database backup failed:', error);
      throw error;
    }
  }

  async backupKMS(backupPath) {
    console.log('🔑 Backing up KMS...');
    const kmsBackupPath = path.join(backupPath, 'kms');
    await fs.mkdir(kmsBackupPath, { recursive: true });
    
    const keys = [];
    
    try {
      // Get all KMS keys
      const kmsDir = path.join(__dirname, '..', '.kms');
      const keyFiles = await fs.readdir(kmsDir);
      
      for (const file of keyFiles) {
        if (file.endsWith('.json')) {
          const sourcePath = path.join(kmsDir, file);
          const destPath = path.join(kmsBackupPath, file);
          
          // Copy encrypted key file
          const content = await fs.readFile(sourcePath);
          await fs.writeFile(destPath, content);
          
          keys.push({
            filename: file,
            size: content.length
          });
        }
      }
      
      console.log(`✅ Backed up ${keys.length} KMS keys`);
      return { keys };
      
    } catch (error) {
      console.error('❌ KMS backup failed:', error);
      throw error;
    }
  }

  async compressAndEncrypt(backupPath) {
    console.log('🔐 Compressing and encrypting backup...');

    const archiver = require('archiver');
    const zipFile = `${backupPath}.zip`;
    const encryptedFile = `${backupPath}.enc`;

    try {
      // Create ZIP archive
      await new Promise((resolve, reject) => {
        const output = require('fs').createWriteStream(zipFile);
        const archive = archiver('zip', {
          zlib: { level: 9 } // Maximum compression
        });

        output.on('close', resolve);
        archive.on('error', reject);

        archive.pipe(output);
        archive.directory(backupPath, false);
        archive.finalize();
      });

      console.log('  ✅ ZIP archive created');

      // Get encryption key from KMS
      const encryptionKey = await productionKMS.getInternalKey('BACKUP_ENCRYPTION_KEY');
      if (!encryptionKey) {
        // Generate and store new encryption key
        const newKey = crypto.randomBytes(32).toString('hex');
        await productionKMS.storeInternalKey('BACKUP_ENCRYPTION_KEY', newKey);
        encryptionKey = newKey;
      }

      // Encrypt the compressed file
      const key = Buffer.from(encryptionKey, 'hex');
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv(this.encryptionAlgorithm, key, iv);

      const input = await fs.readFile(zipFile);
      const encrypted = Buffer.concat([
        iv,
        cipher.update(input),
        cipher.final(),
        cipher.getAuthTag()
      ]);

      await fs.writeFile(encryptedFile, encrypted);

      // Clean up ZIP file
      await fs.unlink(zipFile);

      console.log('✅ Backup encrypted successfully');
      return encryptedFile;

    } catch (error) {
      console.error('❌ Encryption failed:', error);
      throw error;
    }
  }

  async restoreFromBackup(backupFile) {
    console.log(`🔄 Restoring from backup: ${backupFile}`);
    
    const tempDir = path.join(this.backupDir, 'temp-restore-' + Date.now());
    
    try {
      // Decrypt backup
      const decryptedPath = await this.decryptBackup(backupFile, tempDir);
      
      // Extract backup
      await execAsync(`tar -xzf "${decryptedPath}" -C "${tempDir}"`);
      
      // Find backup directory
      const dirs = await fs.readdir(tempDir);
      const backupDir = dirs.find(d => d.startsWith('backup-'));
      if (!backupDir) {
        throw new Error('Invalid backup structure');
      }
      
      const extractedPath = path.join(tempDir, backupDir);
      
      // Read manifest
      const manifestPath = path.join(extractedPath, 'manifest.json');
      const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
      
      // Verify checksum
      const manifestCopy = { ...manifest };
      delete manifestCopy.checksum;
      const calculatedChecksum = this.calculateChecksum(JSON.stringify(manifestCopy));
      
      if (calculatedChecksum !== manifest.checksum) {
        throw new Error('Backup integrity check failed');
      }
      
      // Restore databases
      await this.restoreDatabases(path.join(extractedPath, 'databases'));
      
      // Restore KMS
      await this.restoreKMS(path.join(extractedPath, 'kms'));
      
      // Clean up temp directory
      await this.removeDirectory(tempDir);
      
      // Log restore event
      await this.logBackupEvent('restore_completed', {
        backupFile,
        databases: manifest.databases.length,
        kmsKeys: manifest.kmsKeys.length
      });
      
      console.log('✅ Restore completed successfully');
      return { success: true, manifest };
      
    } catch (error) {
      console.error('❌ Restore failed:', error);
      await this.logBackupEvent('restore_failed', { error: error.message });
      
      // Clean up temp directory
      try {
        await this.removeDirectory(tempDir);
      } catch (e) {
        // Ignore cleanup errors
      }
      
      throw error;
    }
  }

  async decryptBackup(encryptedFile, outputDir) {
    console.log('🔓 Decrypting backup...');
    
    await fs.mkdir(outputDir, { recursive: true });
    const decryptedFile = path.join(outputDir, 'backup.tar.gz');
    
    try {
      // Get encryption key from KMS
      const encryptionKey = await productionKMS.getInternalKey('BACKUP_ENCRYPTION_KEY');
      if (!encryptionKey) {
        throw new Error('Backup encryption key not found in KMS');
      }
      
      // Read encrypted file
      const encrypted = await fs.readFile(encryptedFile);
      
      // Extract IV and auth tag
      const iv = encrypted.slice(0, 16);
      const authTag = encrypted.slice(-16);
      const ciphertext = encrypted.slice(16, -16);
      
      // Decrypt
      const key = Buffer.from(encryptionKey, 'hex');
      const decipher = crypto.createDecipheriv(this.encryptionAlgorithm, key, iv);
      decipher.setAuthTag(authTag);
      
      const decrypted = Buffer.concat([
        decipher.update(ciphertext),
        decipher.final()
      ]);
      
      await fs.writeFile(decryptedFile, decrypted);
      
      console.log('✅ Backup decrypted successfully');
      return decryptedFile;
      
    } catch (error) {
      console.error('❌ Decryption failed:', error);
      throw error;
    }
  }

  async restoreDatabases(dbBackupPath) {
    console.log('📦 Restoring databases...');

    const files = await fs.readdir(dbBackupPath);
    const mongoose = require('mongoose');

    for (const file of files) {
      if (file.endsWith('.json.gz')) {
        const dbName = file.replace('.json.gz', '');
        console.log(`  Restoring ${dbName}...`);

        try {
          const backupFile = path.join(dbBackupPath, file);

          // Decompress and read backup
          const compressed = await fs.readFile(backupFile);
          const decompressed = require('zlib').gunzipSync(compressed);
          const dbBackup = JSON.parse(decompressed.toString());

          // Connect to database
          const dbConn = await this.getConnection(dbName);

          // Drop existing collections
          const existingCollections = await dbConn.db.listCollections().toArray();
          for (const coll of existingCollections) {
            if (!coll.name.startsWith('system.')) {
              await dbConn.db.dropCollection(coll.name);
            }
          }

          // Restore each collection
          for (const [collName, collData] of Object.entries(dbBackup.collections)) {
            const collection = dbConn.db.collection(collName);

            // Restore documents
            if (collData.documents && collData.documents.length > 0) {
              await collection.insertMany(collData.documents);
            }

            // Restore indexes
            if (collData.indexes && collData.indexes.length > 1) { // Skip default _id index
              for (const index of collData.indexes) {
                if (index.name !== '_id_') {
                  await collection.createIndex(index.key, {
                    ...index,
                    key: undefined,
                    v: undefined,
                    ns: undefined
                  });
                }
              }
            }
          }

          console.log(`    ✅ ${dbName} restored (${Object.keys(dbBackup.collections).length} collections)`);
        } catch (error) {
          console.error(`    ❌ Failed to restore ${dbName}:`, error.message);
        }
      }
    }

    console.log('✅ Databases restored');
  }

  async restoreKMS(kmsBackupPath) {
    console.log('🔑 Restoring KMS...');
    
    const kmsDir = path.join(__dirname, '..', '.kms');
    const files = await fs.readdir(kmsBackupPath);
    
    for (const file of files) {
      const sourcePath = path.join(kmsBackupPath, file);
      const destPath = path.join(kmsDir, file);
      
      // Backup existing key
      try {
        const existing = await fs.readFile(destPath);
        await fs.writeFile(`${destPath}.backup-${Date.now()}`, existing);
      } catch (e) {
        // No existing file
      }
      
      // Restore key
      const content = await fs.readFile(sourcePath);
      await fs.writeFile(destPath, content);
    }
    
    console.log('✅ KMS restored');
  }

  async cleanOldBackups() {
    console.log('🧹 Cleaning old backups...');
    
    try {
      const files = await fs.readdir(this.backupDir);
      const backupFiles = files
        .filter(f => f.startsWith('backup-') && f.endsWith('.enc'))
        .map(f => ({
          name: f,
          path: path.join(this.backupDir, f),
          timestamp: f.match(/backup-(.+)\.enc/)[1]
        }))
        .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
      
      // Keep only the most recent backups
      if (backupFiles.length > this.maxBackups) {
        const toDelete = backupFiles.slice(this.maxBackups);
        
        for (const file of toDelete) {
          await fs.unlink(file.path);
          console.log(`  Deleted old backup: ${file.name}`);
        }
        
        console.log(`✅ Deleted ${toDelete.length} old backups`);
      }
    } catch (error) {
      console.error('❌ Failed to clean old backups:', error);
    }
  }

  async listBackups() {
    try {
      const files = await fs.readdir(this.backupDir);
      const backups = [];
      
      for (const file of files) {
        if (file.startsWith('backup-') && file.endsWith('.enc')) {
          const filePath = path.join(this.backupDir, file);
          const stats = await fs.stat(filePath);
          
          backups.push({
            filename: file,
            path: filePath,
            size: stats.size,
            created: stats.birthtime,
            timestamp: file.match(/backup-(.+)\.enc/)[1]
          });
        }
      }
      
      return backups.sort((a, b) => b.created - a.created);
      
    } catch (error) {
      console.error('❌ Failed to list backups:', error);
      throw error;
    }
  }

  async getCollectionCount(dbName) {
    try {
      const conn = await this.getConnection(dbName);
      const collections = await conn.db.listCollections().toArray();
      return collections.length;
    } catch (e) {
      return 0;
    }
  }

  calculateChecksum(data) {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  async removeDirectory(dirPath) {
    try {
      await fs.rm(dirPath, { recursive: true, force: true });
    } catch (e) {
      // Ignore errors
    }
  }

  async logBackupEvent(event, details) {
    try {
      const context = {
        serviceId: 'backup-service',
        operation: event,
        practiceId: 'global'
      };
      
      await SecureDataAccess.insert('audit_logs', {
        timestamp: new Date(),
        event,
        service: 'backup-service',
        details,
        success: !event.includes('failed')
      }, context);
    } catch (e) {
      console.error('Failed to log backup event:', e);
    }
  }

  async onHealthCheck() {
    const backups = await this.listBackups();
    const lastBackup = backups[0];
    
    return {
      totalBackups: backups.length,
      lastBackup: lastBackup ? {
        filename: lastBackup.filename,
        created: lastBackup.created,
        size: lastBackup.size
      } : null,
      scheduledTaskActive: this.scheduledTask ? true : false,
      backupDirectory: this.backupDir
    };
  }
}

module.exports = new BackupService();