/**
 * Document Storage Service for Medical Platform
 * Handles large medical documents by separating metadata from content
 * Supports unlimited document sizes through chunking
 */

const { ObjectId } = require('mongodb');
const mongoose = require('mongoose');
const crypto = require('crypto');
const serviceProxyManager = require('./serviceProxyManager');

// Document chunk schema for storing large content
const DocumentChunkSchema = new mongoose.Schema({
  documentId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    index: true
  },
  chunkIndex: {
    type: Number,
    required: true
  },
  totalChunks: {
    type: Number,
    required: true
  },
  data: {
    type: Buffer,
    required: true
  },
  encrypted: {
    type: Boolean,
    default: true
  },
  iv: String,
  tag: String,
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Compound index for efficient retrieval
DocumentChunkSchema.index({ documentId: 1, chunkIndex: 1 });

// Medical data schema for storing extracted medical information
const MedicalDataSchema = new mongoose.Schema({
  documentId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    unique: true,
    index: true
  },
  patientId: {
    type: mongoose.Schema.Types.ObjectId,
    index: true
  },
  // Store full extracted medical data here, not in document metadata
  extractedData: {
    // Patient Information
    patientName: String,
    dateOfBirth: Date,
    nationalId: String,
    mrn: String,
    
    // Document Information
    documentDate: Date,
    documentType: String,
    provider: String,
    facility: String,
    department: String,
    
    // Medical Content - Arrays can be as large as needed
    diagnoses: [{
      code: String,
      description: String,
      date: Date,
      status: String,
      severity: String,
      notes: String
    }],
    
    medications: [{
      name: String,
      dosage: String,
      frequency: String,
      startDate: Date,
      endDate: Date,
      prescriber: String,
      reason: String,
      instructions: String
    }],
    
    allergies: [{
      allergen: String,
      reaction: String,
      severity: String,
      dateIdentified: Date,
      verifiedBy: String
    }],
    
    procedures: [{
      name: String,
      date: Date,
      provider: String,
      facility: String,
      notes: String,
      complications: String,
      outcome: String
    }],
    
    labResults: [{
      testName: String,
      value: String,
      unit: String,
      referenceRange: String,
      flag: String,
      date: Date,
      orderedBy: String,
      interpretation: String
    }],
    
    vitalSigns: [{
      date: Date,
      bloodPressure: String,
      heartRate: Number,
      temperature: Number,
      respiratoryRate: Number,
      oxygenSaturation: Number,
      weight: Number,
      height: Number,
      bmi: Number
    }],
    
    immunizations: [{
      vaccine: String,
      date: Date,
      site: String,
      lotNumber: String,
      manufacturer: String,
      administeredBy: String
    }],
    
    // Full text content
    fullText: String,
    summary: String,
    notes: String,
    recommendations: [String],
    followUpInstructions: String,
    
    // Analysis metadata
    analysisVersion: String,
    analyzedAt: Date,
    confidence: Number,
    language: String
  },
  
  // Search optimization
  searchableText: String, // Concatenated searchable fields
  
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Full text search index
MedicalDataSchema.index({ searchableText: 'text' });

class DocumentStorageService {
  constructor() {
    this.CHUNK_SIZE = 10 * 1024 * 1024; // 10MB chunks
    this.serviceToken = null;
    this.initialized = false;
    this._secureDataAccess = null;
    this._serviceAccountManager = null;
  }

  async initialize() {
    if (this.initialized) return;
    
    try {
      // Get services through proxy manager
      this._secureDataAccess = serviceProxyManager.get('secureDataAccess');
      this._serviceAccountManager = serviceProxyManager.get('serviceAccountManager');
      
      // Authenticate service
      this.serviceToken = await this._serviceAccountManager.authenticate('document-storage-service');
      
      // Initialize models if not already done
      if (!mongoose.models.DocumentChunk) {
        mongoose.model('DocumentChunk', DocumentChunkSchema);
      }
      if (!mongoose.models.MedicalData) {
        mongoose.model('MedicalData', MedicalDataSchema);
      }
      
      this.initialized = true;
      console.log('✅ Document Storage Service initialized');
    } catch (error) {
      console.error('Failed to initialize Document Storage Service:', error);
      throw error;
    }
  }

  /**
   * Store large document content in chunks
   * @param {Object} params
   * @param {ObjectId} params.documentId - Document ID
   * @param {Buffer} params.content - Document content (can be encrypted)
   * @param {String} params.iv - Encryption IV if encrypted
   * @param {String} params.tag - Encryption tag if encrypted
   * @param {Object} context - Security context
   */
  async storeDocumentContent(params, context) {
    
    const { documentId, content, iv, tag } = params;
    
    if (!Buffer.isBuffer(content)) {
      throw new Error('Content must be a Buffer');
    }
    
    // Calculate number of chunks needed
    const totalChunks = Math.ceil(content.length / this.CHUNK_SIZE);
    console.log(`📦 Storing document ${documentId} in ${totalChunks} chunks (${Math.round(content.length / 1024 / 1024 * 100) / 100}MB)`);
    
    // Delete any existing chunks for this document
    await this._secureDataAccess.delete(
      'documentchunks',
      { documentId },
      context
    );
    
    // Store content in chunks
    const chunks = [];
    for (let i = 0; i < totalChunks; i++) {
      const start = i * this.CHUNK_SIZE;
      const end = Math.min(start + this.CHUNK_SIZE, content.length);
      const chunkData = content.slice(start, end);
      
      const chunk = {
        documentId,
        chunkIndex: i,
        totalChunks,
        data: chunkData,
        encrypted: !!iv && !!tag,
        iv: i === 0 ? iv : null, // Store IV only with first chunk
        tag: i === totalChunks - 1 ? tag : null, // Store tag only with last chunk
        createdAt: new Date()
      };
      
      await this._secureDataAccess.insert('documentchunks', chunk, context);
      chunks.push(chunk);
    }
    
    console.log(`✅ Stored ${totalChunks} chunks for document ${documentId}`);
    return {
      documentId,
      totalChunks,
      totalSize: content.length,
      encrypted: !!iv && !!tag
    };
  }

  /**
   * Retrieve document content from chunks
   * @param {ObjectId} documentId - Document ID
   * @param {Object} context - Security context
   */
  async retrieveDocumentContent(documentId, context) {
    
    // Retrieve all chunks for this document
    const chunks = await this._secureDataAccess.query(
      'documentchunks',
      { documentId },
      { sort: { chunkIndex: 1 } },
      context
    );
    
    if (!chunks || chunks.length === 0) {
      return null;
    }
    
    console.log(`📦 Retrieving ${chunks.length} chunks for document ${documentId}`);
    
    // Combine chunks
    const buffers = chunks.map(chunk => chunk.data);
    const content = Buffer.concat(buffers);
    
    // Get encryption parameters from first and last chunks
    const iv = chunks[0].iv;
    const tag = chunks[chunks.length - 1].tag;
    
    return {
      content,
      iv,
      tag,
      encrypted: chunks[0].encrypted,
      totalSize: content.length
    };
  }

  /**
   * Store extracted medical data separately from document
   * @param {Object} params
   * @param {ObjectId} params.documentId - Document ID
   * @param {ObjectId} params.patientId - Patient ID
   * @param {Object} params.extractedData - Full extracted medical data
   * @param {Object} context - Security context
   */
  async storeMedicalData(params, context) {
    
    const { documentId, patientId, extractedData } = params;
    
    // Create searchable text for full-text search
    const searchableText = [
      extractedData.patientName,
      extractedData.summary,
      extractedData.notes,
      ...(extractedData.diagnoses || []).map(d => d.description),
      ...(extractedData.medications || []).map(m => m.name),
      ...(extractedData.procedures || []).map(p => p.name),
      ...(extractedData.recommendations || [])
    ].filter(Boolean).join(' ');
    
    const medicalData = {
      documentId,
      patientId,
      extractedData,
      searchableText,
      updatedAt: new Date()
    };
    
    // Check if medical data already exists for this document
    const existing = await this._secureDataAccess.query(
      'medicaldata',
      { documentId },
      { limit: 1 },
      context
    );
    
    if (existing && existing.length > 0) {
      // Update existing record
      await this._secureDataAccess.update(
        'medicaldata',
        { documentId },
        medicalData,
        context
      );
      console.log(`✅ Updated medical data for document ${documentId}`);
    } else {
      // Insert new record
      await this._secureDataAccess.insert('medicaldata', medicalData, context);
      console.log(`✅ Stored medical data for document ${documentId}`);
    }
    
    return {
      documentId,
      stored: true,
      dataSize: JSON.stringify(extractedData).length
    };
  }

  /**
   * Retrieve medical data for a document
   * @param {ObjectId} documentId - Document ID
   * @param {Object} context - Security context
   */
  async retrieveMedicalData(documentId, context) {
    
    const results = await this._secureDataAccess.query(
      'medicaldata',
      { documentId },
      { limit: 1 },
      context
    );
    
    return results && results.length > 0 ? results[0] : null;
  }

  /**
   * Search medical data across all documents
   * @param {Object} params
   * @param {String} params.searchText - Text to search
   * @param {ObjectId} params.patientId - Optional patient ID filter
   * @param {Object} context - Security context
   */
  async searchMedicalData(params, context) {
    
    const { searchText, patientId } = params;
    
    const query = {
      $text: { $search: searchText }
    };
    
    if (patientId) {
      query.patientId = patientId;
    }
    
    const results = await this._secureDataAccess.query(
      'medicaldata',
      query,
      { 
        limit: 50,
        score: { $meta: 'textScore' },
        sort: { score: { $meta: 'textScore' } }
      },
      context
    );
    
    return results;
  }

  /**
   * Get storage statistics for a practice
   * @param {String} practiceId - Practice ID
   * @param {Object} context - Security context
   */
  async getStorageStats(practiceId, context) {
    
    // Get total chunks count and size
    const pipeline = [
      { $group: {
        _id: null,
        totalChunks: { $sum: 1 },
        totalSize: { $sum: { $bsonSize: '$data' } }
      }}
    ];
    
    const stats = await this._secureDataAccess.aggregate(
      'documentchunks',
      pipeline,
      context
    );
    
    // Get medical data count
    const medicalDataCount = await this._secureDataAccess.query(
      'medicaldata',
      {},
      { count: true },
      context
    );

    return {
      totalChunks: stats[0]?.totalChunks || 0,
      totalSizeBytes: stats[0]?.totalSize || 0,
      totalSizeMB: Math.round((stats[0]?.totalSize || 0) / 1024 / 1024 * 100) / 100,
      medicalDataRecords: medicalDataCount || 0
    };
  }

  /**
   * Clean up orphaned chunks (chunks without corresponding documents)
   * @param {Object} context - Security context
   */
  async cleanupOrphanedChunks(context) {
    
    // Get all document IDs
    const documents = await this._secureDataAccess.query(
      'documents',
      {},
      { projection: { _id: 1 } },
      context
    );
    
    const validDocumentIds = documents.map(d => d._id);
    
    // Delete chunks not in valid document list
    const result = await this._secureDataAccess.delete(
      'documentchunks',
      { documentId: { $nin: validDocumentIds } },
      context,
      { multi: true }
    );
    
    console.log(`🧹 Cleaned up ${result.deletedCount || 0} orphaned chunks`);
    return result;
  }
}

// Export singleton instance
module.exports = new DocumentStorageService();