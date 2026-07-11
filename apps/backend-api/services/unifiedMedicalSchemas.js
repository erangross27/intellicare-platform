/**
 * Unified Medical Schemas - Single Source of Truth
 *
 * Merges schemas from claudeBatchProcessor.js and collectionSchemas.js
 * Provides helper methods to get schemas filtered for different purposes
 *
 * Created: November 2025
 */

const fs = require('fs');
const path = require('path');

class UnifiedMedicalSchemas {
  constructor() {
    // Load unified schemas from JSON file
    const schemasPath = path.join(__dirname, 'unified-medical-schemas.json');
    this.schemas = JSON.parse(fs.readFileSync(schemasPath, 'utf8'));

    // Base fields common to all collections (from collectionSchemas.js)
    this.baseFields = {
      patientId: {
        type: 'ObjectId',
        required: true,
        extractable: false,
        storable: true,
        agentVisible: true,
        description: 'Patient identifier'
      },
      documentId: {
        type: 'ObjectId',
        required: false,
        extractable: false,
        storable: true,
        agentVisible: false,
        description: 'Source document identifier'
      },
      source: {
        type: 'string',
        extractable: false,
        storable: true,
        agentVisible: false,
        default: 'manual',
        description: 'Data source (manual, agent, batch, import)'
      },
      createdAt: {
        type: 'Date',
        extractable: false,
        storable: true,
        computed: true,
        agentVisible: false,
        description: 'Creation timestamp'
      },
      updatedAt: {
        type: 'Date',
        extractable: false,
        storable: true,
        computed: true,
        agentVisible: false,
        description: 'Last update timestamp'
      },
      createdBy: {
        type: 'ObjectId',
        extractable: false,
        storable: true,
        agentVisible: false,
        description: 'User who created this record'
      },
      updatedBy: {
        type: 'ObjectId',
        extractable: false,
        storable: true,
        agentVisible: false,
        description: 'User who last updated this record'
      }
    };

    console.log(`✅ UnifiedMedicalSchemas initialized with ${Object.keys(this.schemas).length} collections`);
  }

  /**
   * Get complete schema for a collection (all fields)
   * @param {string} collectionName - Name of the collection
   * @returns {object} Complete schema with all fields and metadata
   */
  getSchema(collectionName) {
    const schema = this.schemas[collectionName];

    if (!schema) {
      console.warn(`⚠️  No schema found for collection: ${collectionName}`);
      return { ...this.baseFields };
    }

    // Merge base fields with collection-specific fields
    return {
      ...this.baseFields,
      ...schema
    };
  }

  /**
   * Get extraction schema for a collection (only extractable fields)
   * Used by claudeBatchProcessor.js for AI extraction
   * @param {string} collectionName - Name of the collection
   * @returns {object} Schema with only extractable fields
   */
  getExtractionSchema(collectionName) {
    const fullSchema = this.getSchema(collectionName);
    const extractionSchema = {};

    for (const [fieldName, fieldDef] of Object.entries(fullSchema)) {
      if (fieldDef.extractable) {
        // Remove metadata flags, keep only type/description for extraction
        const { extractable, storable, computed, agentVisible, source, ...cleanField } = fieldDef;
        extractionSchema[fieldName] = cleanField;
      }
    }

    return extractionSchema;
  }

  /**
   * Get storage schema for a collection (all storable fields)
   * Used by collectionSchemas.js for validation and storage
   * @param {string} collectionName - Name of the collection
   * @returns {object} Schema with all storable fields
   */
  getStorageSchema(collectionName) {
    const fullSchema = this.getSchema(collectionName);
    const storageSchema = {};

    for (const [fieldName, fieldDef] of Object.entries(fullSchema)) {
      if (fieldDef.storable !== false) {
        // Keep all fields for storage (including metadata)
        storageSchema[fieldName] = fieldDef;
      }
    }

    return storageSchema;
  }

  /**
   * Get agent schema for a collection (only agent-visible fields)
   * Used by aiHelpers.js for CRUD function tool schemas
   * @param {string} collectionName - Name of the collection
   * @returns {object} Schema with only agent-visible fields
   */
  getAgentSchema(collectionName) {
    const fullSchema = this.getSchema(collectionName);
    const agentSchema = {};

    for (const [fieldName, fieldDef] of Object.entries(fullSchema)) {
      if (fieldDef.agentVisible !== false) {
        // Remove internal metadata, keep type/description/required/default
        const { extractable, storable, computed, agentVisible, source, ...cleanField } = fieldDef;
        agentSchema[fieldName] = cleanField;
      }
    }

    return agentSchema;
  }

  /**
   * Get list of all collection names
   * @returns {array} Array of collection names
   */
  getAllCollections() {
    return Object.keys(this.schemas);
  }

  /**
   * Check if a collection has a defined schema
   * @param {string} collectionName - Name of the collection
   * @returns {boolean} True if schema exists
   */
  hasSchema(collectionName) {
    return !!this.schemas[collectionName];
  }

  /**
   * Transform data according to schema
   * Converts types, applies defaults, validates required fields
   * @param {object} data - Data to transform
   * @param {object} schema - Schema to use for transformation
   * @returns {object} Transformed data
   */
  transformData(data, schema) {
    const transformed = {};

    for (const [fieldName, fieldDef] of Object.entries(schema)) {
      const value = data[fieldName];

      // Apply default if value is undefined
      if (value === undefined && fieldDef.default !== undefined) {
        transformed[fieldName] = fieldDef.default;
        continue;
      }

      // Skip if value is undefined and not required
      if (value === undefined) {
        continue;
      }

      // Type conversion
      if (fieldDef.type === 'Date' && typeof value === 'string') {
        transformed[fieldName] = new Date(value);
      } else if (fieldDef.type === 'number' && typeof value === 'string') {
        transformed[fieldName] = parseFloat(value);
      } else if (fieldDef.type === 'boolean' && typeof value === 'string') {
        transformed[fieldName] = value === 'true' || value === '1';
      } else {
        transformed[fieldName] = value;
      }
    }

    return transformed;
  }

  /**
   * Validate data against schema
   * @param {object} data - Data to validate
   * @param {object} schema - Schema to validate against
   * @returns {object} Validation result { valid: boolean, errors: array }
   */
  validate(data, schema) {
    const errors = [];

    // Check required fields
    for (const [fieldName, fieldDef] of Object.entries(schema)) {
      if (fieldDef.required && (data[fieldName] === undefined || data[fieldName] === null)) {
        errors.push(`Required field missing: ${fieldName}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

// Export singleton instance
module.exports = new UnifiedMedicalSchemas();
