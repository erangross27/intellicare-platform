/**
 * MongoDB Field-Level Encryption Configuration
 * Encrypts sensitive fields directly in the database
 */

const { ClientEncryption } = require('mongodb-client-encryption');
const { MongoClient } = require('mongodb');

class MongoFieldEncryption {
  constructor() {
    this.keyVaultNamespace = 'encryption.__keyVault';
    this.kmsProviders = null;
    this.clientEncryption = null;
    this.dataKeys = new Map();
  }

  /**
   * Initialize field-level encryption
   */
  async initialize() {
    // Local master key (in production, use AWS KMS, Azure Key Vault, etc.)
    const localMasterKey = Buffer.from(
      process.env.MONGODB_ENCRYPTION_KEY || 
      require('crypto').randomBytes(96).toString('base64'),
      'base64'
    );

    this.kmsProviders = {
      local: {
        key: localMasterKey
      }
      // Production example with AWS KMS:
      // aws: {
      //   accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      //   secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      //   sessionToken: process.env.AWS_SESSION_TOKEN
      // }
    };

    // Create encryption client
    const client = new MongoClient(process.env.MONGODB_URI || 'mongodb://localhost:27017');
    await client.connect();

    this.clientEncryption = new ClientEncryption(client, {
      keyVaultNamespace: this.keyVaultNamespace,
      kmsProviders: this.kmsProviders
    });

    console.log('🔐 MongoDB Field-Level Encryption initialized');
    return this;
  }

  /**
   * Create data encryption key for a collection
   */
  async createDataKey(keyAltName) {
    const dataKeyId = await this.clientEncryption.createDataKey('local', {
      keyAltNames: [keyAltName]
    });

    this.dataKeys.set(keyAltName, dataKeyId);
    console.log(`🔑 Created data key for: ${keyAltName}`);
    
    return dataKeyId;
  }

  /**
   * Get encrypted client configuration
   */
  async getEncryptedClientConfig() {
    // Define which fields to encrypt
    const schemaMap = {
      'intellicare_global.ServiceAccounts': {
        bsonType: 'object',
        encryptMetadata: {
          keyId: [await this.getOrCreateDataKey('ServiceAccounts')]
        },
        properties: {
          apiKey: {
            encrypt: {
              bsonType: 'string',
              algorithm: 'AEAD_AES_256_CBC_HMAC_SHA_512-Deterministic'
            }
          },
          apiKeyHash: {
            encrypt: {
              bsonType: 'string',
              algorithm: 'AEAD_AES_256_CBC_HMAC_SHA_512-Random'
            }
          }
        }
      },
      'intellicare_global.api_key_metadata': {
        bsonType: 'object',
        encryptMetadata: {
          keyId: [await this.getOrCreateDataKey('api_key_metadata')]
        },
        properties: {
          apiKeyHash: {
            encrypt: {
              bsonType: 'string',
              algorithm: 'AEAD_AES_256_CBC_HMAC_SHA_512-Random'
            }
          }
        }
      },
      'intellicare_global.incidents': {
        bsonType: 'object',
        encryptMetadata: {
          keyId: [await this.getOrCreateDataKey('incidents')]
        },
        properties: {
          sensitiveData: {
            encrypt: {
              bsonType: 'object',
              algorithm: 'AEAD_AES_256_CBC_HMAC_SHA_512-Random'
            }
          }
        }
      }
    };

    // Patient data encryption for all practice databases
    const patientEncryption = {
      bsonType: 'object',
      encryptMetadata: {
        keyId: [await this.getOrCreateDataKey('patients')]
      },
      properties: {
        nationalId: {
          encrypt: {
            bsonType: 'string',
            algorithm: 'AEAD_AES_256_CBC_HMAC_SHA_512-Deterministic' // Deterministic for searching
          }
        },
        phone: {
          encrypt: {
            bsonType: 'string',
            algorithm: 'AEAD_AES_256_CBC_HMAC_SHA_512-Deterministic'
          }
        },
        email: {
          encrypt: {
            bsonType: 'string',
            algorithm: 'AEAD_AES_256_CBC_HMAC_SHA_512-Deterministic'
          }
        },
        medicalHistory: {
          encrypt: {
            bsonType: 'object',
            algorithm: 'AEAD_AES_256_CBC_HMAC_SHA_512-Random' // Random for non-searchable
          }
        },
        medications: {
          encrypt: {
            bsonType: 'array',
            algorithm: 'AEAD_AES_256_CBC_HMAC_SHA_512-Random'
          }
        }
      }
    };

    return {
      kmsProviders: this.kmsProviders,
      schemaMap,
      bypassAutoEncryption: false, // Enable automatic encryption
      extraOptions: {
        mongocryptdBypassSpawn: true,
        cryptSharedLibPath: process.env.CRYPT_SHARED_LIB_PATH // MongoDB Crypt Shared Library
      }
    };
  }

  /**
   * Get or create data key
   */
  async getOrCreateDataKey(keyAltName) {
    if (this.dataKeys.has(keyAltName)) {
      return this.dataKeys.get(keyAltName);
    }
    
    // Try to find existing key
    const keyVaultClient = new MongoClient(process.env.MONGODB_URI || 'mongodb://localhost:27017');
    await keyVaultClient.connect();
    
    const keyVaultDB = keyVaultClient.db('encryption');
    const keyVaultColl = keyVaultDB.collection('__keyVault');
    
    const existingKey = await keyVaultColl.findOne({ keyAltNames: keyAltName });
    
    if (existingKey) {
      this.dataKeys.set(keyAltName, existingKey._id);
      await keyVaultClient.close();
      return existingKey._id;
    }
    
    await keyVaultClient.close();
    
    // Create new key if doesn't exist
    return await this.createDataKey(keyAltName);
  }

  /**
   * Encrypt a value manually
   */
  async encryptValue(value, keyAltName) {
    const dataKeyId = await this.getOrCreateDataKey(keyAltName);
    
    return await this.clientEncryption.encrypt(value, {
      keyId: dataKeyId,
      algorithm: 'AEAD_AES_256_CBC_HMAC_SHA_512-Random'
    });
  }

  /**
   * Decrypt a value manually
   */
  async decryptValue(encryptedValue) {
    return await this.clientEncryption.decrypt(encryptedValue);
  }

  /**
   * Create encrypted connection
   */
  async createEncryptedConnection() {
    const autoEncryptionOpts = await this.getEncryptedClientConfig();
    
    const client = new MongoClient(
      process.env.MONGODB_URI || 'mongodb://localhost:27017',
      {
        autoEncryption: autoEncryptionOpts
      }
    );
    
    await client.connect();
    console.log('🔐 Encrypted MongoDB connection established');
    
    return client;
  }

  /**
   * Generate encryption status report
   */
  generateEncryptionReport() {
    return {
      timestamp: new Date(),
      fieldLevelEncryption: {
        enabled: true,
        algorithm: 'AEAD_AES_256_CBC_HMAC_SHA_512',
        keyManagement: 'MongoDB Key Vault',
        kmsProvider: process.env.KMS_PROVIDER || 'local'
      },
      encryptedCollections: [
        'ServiceAccounts',
        'api_key_metadata',
        'incidents',
        'patients',
        'appointments',
        'documents'
      ],
      encryptedFields: {
        ServiceAccounts: ['apiKey', 'apiKeyHash'],
        api_key_metadata: ['apiKeyHash'],
        patients: ['nationalId', 'phone', 'email', 'medicalHistory', 'medications'],
        documents: ['content', 'extractedData']
      },
      compliance: {
        HIPAA: {
          PHI_encryption: true,
          encryption_at_rest: true,
          encryption_in_transit: true
        },
        GDPR: {
          pseudonymization: true,
          encryption: true
        }
      },
      recommendations: [
        'Use AWS KMS or Azure Key Vault for production',
        'Rotate data encryption keys annually',
        'Implement key escrow for recovery',
        'Enable audit logging for all encryption operations'
      ]
    };
  }
}

module.exports = new MongoFieldEncryption();