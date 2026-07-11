/**
 * Claude Memory Service - Learning System for Function Selection
 * 
 * This service enables Claude to learn which functions to call for different queries,
 * building a memory of successful patterns that improve over time.
 * 
 * Key Features:
 * - Captures Claude's function selections for each query
 * - Learns successful patterns and workflows
 * - Provides instant recall for learned queries
 * - Reduces tokens by 70%+ after learning
 */

const { ObjectId } = require('mongodb');
const SecureDataAccess = require('./secureDataAccess');
const proceduralMemoryService = require('./learning/proceduralMemoryService');
// Note: memoryVectorService removed - not needed with new learning system
// const memoryVectorService = require('../procedural-memory-ai/services/memoryVectorService');
const serviceAccountManager = require('./serviceAccountManager');
const crypto = require('crypto');

class ClaudeMemoryService {
  constructor() {
    this.initialized = false;
    this.memoryCache = new Map(); // Cache for frequently used patterns
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
    this.learningThreshold = 0.8; // Confidence threshold for using memory
    
    // Track current learning sessions
    this.learningSession = new Map();
  }
  
  async initialize() {
    if (this.initialized) return this;
    
    try {
      // Authenticate service with database
      this.serviceToken = await serviceAccountManager.authenticate('claude-memory-service');
      console.log('✅ Claude Memory Service authenticated');
      
      // Initialize memory services
      await proceduralMemoryService.initialize();
      // memoryVectorService removed - not needed with new learning system
      // await memoryVectorService.initialize();
      
      this.initialized = true;
      console.log('🧠 Claude Memory Service initialized');
      console.log('  → Learning mode: ACTIVE');
      console.log('  → Pattern recognition: ENABLED');
      console.log('  → Token reduction target: 70%+');
      
      return this;
    } catch (error) {
      console.warn('⚠️ Claude Memory Service initialization failed:', error.message);
      console.log('  → Continuing without memory optimization');
      return this;
    }
  }
  
  /**
   * Check if we have a learned pattern for this query
   */
  async checkMemory(message, practiceContext) {
    if (!this.initialized) return null;
    
    try {
      const practiceId = practiceContext?.practiceId || practiceContext?.practice?.id;
      const userId = practiceContext?.user?.id || practiceContext?.user?._id;
      if (!practiceId || !userId) return null;
      
      // Check cache first - include userId in cache key for user-specific memory
      const cacheKey = `${practiceId}:${userId}:${this.normalizeQuery(message)}`;
      const cached = this.memoryCache.get(cacheKey);
      if (cached && cached.expiry > Date.now()) {
        console.log('💾 Memory cache hit for user-specific query');
        return cached.memory;
      }
      
      // Query the database directly for memories
      const context = {
        serviceId: 'claude-memory-service',
        apiKey: this.serviceToken?.apiKey || this.serviceToken?.sessionToken || this.serviceToken,
        operation: 'checkMemory',
        practiceId,
        queryType: 'INTERNAL_SERVICE'
      };
      
      // Find matching memories in the database
      const messageKeywords = this.extractKeywords(message);
      console.log('🔍 Searching for memories with keywords:', messageKeywords);
      
      // Convert practiceId to ObjectId if it's a string
      const mongoose = require('mongoose');
      const practiceObjectId = typeof practiceId === 'string' && practiceId.match(/^[0-9a-fA-F]{24}$/) 
        ? new mongoose.Types.ObjectId(practiceId) 
        : practiceId;
      
      const query = {
        practiceId: practiceObjectId,
        userId,
        memoryType: { $in: ['claude-function-mapping', 'file-upload-pattern', 'document-processing-pattern'] },
        active: true,
        $or: [
          { 'triggers.keywords': { $in: messageKeywords } },
          { 'triggers.patterns': { $in: messageKeywords } }
        ]
      };
      
      console.log('🔍 Query practiceId type:', typeof practiceObjectId, 'value:', practiceObjectId);
      console.log('🔍 Full Query:', JSON.stringify(query, null, 2));
      
      const memories = await SecureDataAccess.query('agent_memories', query, { 
        sort: { 'metrics.confidenceScore': -1 },
        limit: 1 
      }, context);
      
      console.log('🔍 Query result:', memories ? `Found ${memories.length} memories` : 'No result');
      
      const memory = memories && memories.length > 0 ? memories[0] : null;
      
      if (memory) {
        // Handle both old format (missing metrics.confidenceScore) and new format
        const confidenceScore = memory.metrics?.confidenceScore ?? memory.confidence ?? 0.7;
        const tokensSaved = memory.metrics?.averageTokensSaved ?? 0;
        
        console.log(`🧠 MEMORY HIT! Pattern found: ${memory.name}`);
        console.log(`  → Confidence: ${(confidenceScore * 100).toFixed(1)}%`);
        console.log(`  → Tokens saved: ${tokensSaved}`);
        
        // Cache for quick access
        this.memoryCache.set(cacheKey, {
          memory,
          expiry: Date.now() + this.cacheTimeout
        });
        
        // Return the learned function pattern
        return {
          functions: memory.workflow?.selectedFunctions || [],
          confidence: confidenceScore,
          tokensSaved: tokensSaved,
          memoryId: memory._id
        };
      }
      
      return null;
    } catch (error) {
      console.error('Error checking memory:', error);
      return null;
    }
  }
  
  /**
   * Start tracking a learning session
   */
  startLearningSession(sessionId, message, practiceContext) {
    const userId = practiceContext?.user?.id || practiceContext?.user?._id;
    if (!userId) {
      console.log('⚠️ No userId in context, skipping learning session');
      return null;
    }
    
    const learningId = crypto.randomUUID();
    
    this.learningSession.set(learningId, {
      sessionId,
      message,
      practiceContext,
      userId,  // Store userId for user-specific learning
      startTime: Date.now(),
      functions: []
    });
    
    console.log(`🎓 Learning session started for user: ${userId.toString().substring(0, 8)}...`);
    return learningId;
  }
  
  /**
   * Save the functions Claude selected
   */
  trackFunctionSelection(learningId, functions) {
    const session = this.learningSession.get(learningId);
    if (session) {
      session.functions = functions;
      session.selectionTime = Date.now() - session.startTime;
    }
  }
  
  /**
   * Save a successful pattern for future use
   */
  async savePattern(learningId, result, tokensUsed) {
    if (!this.initialized) return;
    
    const session = this.learningSession.get(learningId);
    if (!session || !result.success) return;
    
    try {
      const { message, practiceContext, functions, startTime, userId } = session;
      const practiceId = practiceContext?.practiceId || practiceContext?.practice?.id;
      
      if (!practiceId || !userId || !functions || functions.length === 0) return;
      
      // Extract keywords from the message
      const keywords = this.extractKeywords(message);
      
      // Check if similar memory already exists using SecureDataAccess
      const context = {
        serviceId: 'claude-memory-service',
        apiKey: this.serviceToken?.apiKey || this.serviceToken,
        operation: 'savePattern',
        practiceId,
        queryType: 'INTERNAL_SERVICE'  // Mark as internal to skip injection checks for legitimate $in operator
      };
      
      const existingMemories = await SecureDataAccess.query('agent_memories', {
        practiceId,
        userId,  // Add userId for user-specific memories
        memoryType: 'claude-function-mapping',
        'triggers.keywords': { $in: keywords }
      }, { limit: 1 }, context);
      
      const existingMemory = existingMemories && existingMemories.length > 0 ? existingMemories[0] : null;
      
      if (existingMemory) {
        // Reinforce existing memory
        await this.reinforceMemory(existingMemory, {
          functions,
          tokensUsed,
          executionTime: Date.now() - startTime
        });
        console.log(`📈 Reinforced memory: ${existingMemory.name}`);
      } else {
        // Create new memory
        const memory = await this.createMemory({
          practiceId,
          userId,  // Pass userId for user-specific memory
          message,
          keywords,
          functions,
          tokensUsed,
          executionTime: Date.now() - startTime
        });
        console.log(`💾 New memory created for user ${userId}: ${memory.name}`);
      }
      
      // Clean up learning session
      this.learningSession.delete(learningId);
      
    } catch (error) {
      console.error('Error saving pattern:', error);
    }
  }
  
  /**
   * Create a new memory pattern
   */
  async createMemory(data) {
    const { practiceId, userId, message, keywords, functions, tokensUsed, executionTime } = data;
    
    // Generate a descriptive name
    const name = this.generateMemoryName(message, functions);
    
    // Handle both string and object messages (for file uploads)
    let messageText, fileContext;
    if (typeof message === 'object' && message !== null) {
      // Extract file upload context based on R-Zero self-learning pattern
      messageText = message.fileUploadMessage || message.text || message.content || 'File upload';
      
      // Store file metadata for procedural memory
      fileContext = {
        fileName: message.fileName,
        mimeType: message.mimeType,
        fileType: message.fileType,
        fileSize: message.fileSize,
        hasContent: !!message.content,
        // Learn from file patterns
        isCSV: message.mimeType === 'text/csv' || message.fileName?.toLowerCase().endsWith('.csv'),
        isPDF: message.mimeType === 'application/pdf',
        isImage: message.mimeType?.startsWith('image/'),
        isLabResult: message.fileName?.toLowerCase().includes('lab') || message.content?.includes('lab'),
        isPatientData: message.fileName?.toLowerCase().includes('patient') || message.content?.includes('patient')
      };
    } else {
      messageText = String(message);
      fileContext = null;
    }
    
    // Detect if this is a document-related pattern
    const isDocumentPattern = keywords.some(k => 
      k.includes('document') || k.includes('upload') || k.includes('file') ||
      k.includes('מסמך') || k.includes('קובץ') || k.includes('העלאה') ||
      k === 'document_batch_pattern' || fileContext !== null
    );
    
    // Determine memory type based on context
    const memoryType = isDocumentPattern ? 'document-processing-pattern' : 
                      fileContext ? 'file-upload-pattern' : 
                      'claude-function-mapping';
    
    // Build memory data with file context if present
    const memoryData = {
      practiceId,
      userId,  // Use the actual userId passed in, not 'system'
      name,
      description: `Claude function pattern for: ${messageText.substring(0, 100)}`,
      memoryType,
      
      triggers: {
        patterns: keywords,
        keywords: keywords,
        // Add file type triggers for self-learning
        ...(fileContext && {
          fileTypes: [fileContext.mimeType],
          filePatterns: {
            isCSV: fileContext.isCSV,
            isPDF: fileContext.isPDF,
            isImage: fileContext.isImage,
            isLabResult: fileContext.isLabResult,
            isPatientData: fileContext.isPatientData
          }
        })
      },
      
      workflow: {
        selectedFunctions: functions,
        steps: functions.map((func, index) => ({
          order: index + 1,
          action: `Call ${func}`,
          function: func,
          parameters: {},
          averageTokens: Math.floor(tokensUsed / functions.length)
        })),
        totalSteps: functions.length,
        avgStepTime: Math.floor(executionTime / functions.length),
        // Store file context for procedural memory (R-Zero concept)
        ...(fileContext && { fileContext })
      },
      
      embeddings: {
        vector: new Array(768).fill(0.1), // Placeholder
        model: 'claude',
        version: '1.0'
      },
      
      metrics: {
        totalExecutions: 1,
        successfulExecutions: 1,
        failedExecutions: 0,
        successRate: 1.0,
        averageExecutionTime: executionTime,
        averageTokensUsed: tokensUsed,
        averageTokensSaved: 0, // Will be calculated on reuse
        confidenceScore: 0.7, // Initial confidence
        lastSuccessful: new Date(),
        costSavingsUSD: 0
      },
      
      active: true,
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    // Use SecureDataAccess to create the memory
    const context = {
      serviceId: 'claude-memory-service',
      apiKey: this.serviceToken?.apiKey || this.serviceToken,
      operation: 'createMemory',
      practiceId,
      queryType: 'INTERNAL_SERVICE'  // Mark as internal service operation
    };
    
    // Debug logging to see what we're actually saving
    console.log('📝 Creating memory with data:', JSON.stringify({
      name: memoryData.name,
      hasMetrics: !!memoryData.metrics,
      confidenceScore: memoryData.metrics?.confidenceScore,
      workflowFunctions: memoryData.workflow?.selectedFunctions,
      memoryType: memoryData.memoryType
    }, null, 2));
    
    const createdMemories = await SecureDataAccess.insert('agent_memories', memoryData, context);
    const result = Array.isArray(createdMemories) ? createdMemories[0] : createdMemories;
    
    // Verify what was actually saved
    console.log('✅ Memory saved with:', {
      id: result._id,
      hasMetrics: !!result.metrics,
      confidenceScore: result.metrics?.confidenceScore
    });
    
    return result;
  }
  
  /**
   * Reinforce an existing memory with new successful execution
   */
  async reinforceMemory(memory, execution) {
    const { functions, tokensUsed, executionTime } = execution;
    
    // Ensure metrics object exists (for old records)
    if (!memory.metrics) {
      memory.metrics = {
        totalExecutions: 0,
        successfulExecutions: 0,
        failedExecutions: 0,
        successRate: 0,
        averageExecutionTime: 0,
        averageTokensUsed: 0,
        averageTokensSaved: 0,
        confidenceScore: 0.7, // Default confidence
        lastSuccessful: new Date(),
        costSavingsUSD: 0
      };
    }
    
    // Update metrics
    memory.metrics.totalExecutions += 1;
    memory.metrics.successfulExecutions += 1;
    memory.metrics.successRate = memory.metrics.successfulExecutions / memory.metrics.totalExecutions;
    
    // Update averages
    const prevTotal = memory.metrics.totalExecutions - 1;
    memory.metrics.averageExecutionTime = 
      (memory.metrics.averageExecutionTime * prevTotal + executionTime) / memory.metrics.totalExecutions;
    memory.metrics.averageTokensUsed = 
      (memory.metrics.averageTokensUsed * prevTotal + tokensUsed) / memory.metrics.totalExecutions;
    
    // Increase confidence with each success (max 0.99)
    const currentConfidence = memory.metrics.confidenceScore || 0.7;
    memory.metrics.confidenceScore = Math.min(0.99, currentConfidence + 0.05);
    
    // Calculate tokens saved (compared to baseline 5000)
    const baselineTokens = 5000;
    memory.metrics.averageTokensSaved = baselineTokens - memory.metrics.averageTokensUsed;
    
    // Calculate cost savings (Claude pricing)
    const tokensPerDollar = 1000000 / 3.00; // $3 per 1M input tokens
    memory.metrics.costSavingsUSD = memory.metrics.averageTokensSaved / tokensPerDollar;
    
    memory.metrics.lastSuccessful = new Date();
    memory.updatedAt = new Date();
    
    // Use SecureDataAccess to update the memory
    const context = {
      serviceId: 'claude-memory-service',
      apiKey: this.serviceToken?.apiKey || this.serviceToken,
      operation: 'reinforceMemory',
      practiceId: memory.practiceId,
      queryType: 'INTERNAL_SERVICE'  // Mark as internal service operation
    };
    
    await SecureDataAccess.update('agent_memories', { _id: memory._id }, { $set: memory }, context);
  }
  
  /**
   * Extract keywords from a message
   */
  extractKeywords(message) {
    // Handle both string and object message formats
    let messageText = message;
    let fileKeywords = [];
    
    if (typeof message === 'object' && message !== null) {
      // Extract file-specific keywords for R-Zero self-learning
      if (message.fileName) {
        // Extract keywords from filename
        const fileNameParts = message.fileName.toLowerCase()
          .replace(/\.[^/.]+$/, '') // Remove extension
          .split(/[-_\s]+/);
        fileKeywords.push(...fileNameParts);
      }
      
      if (message.mimeType) {
        // Add file type keywords
        if (message.mimeType.includes('csv')) fileKeywords.push('csv', 'import', 'data');
        if (message.mimeType.includes('pdf')) fileKeywords.push('pdf', 'document', 'analyze');
        if (message.mimeType.includes('image')) fileKeywords.push('image', 'scan', 'ocr');
      }
      
      // Add content-based keywords
      if (message.content) {
        const contentSnippet = message.content.substring(0, 200).toLowerCase();
        if (contentSnippet.includes('patient')) fileKeywords.push('patient', 'record');
        if (contentSnippet.includes('lab')) fileKeywords.push('lab', 'results', 'test');
        if (contentSnippet.includes('prescription')) fileKeywords.push('prescription', 'medication');
        if (contentSnippet.includes('insurance')) fileKeywords.push('insurance', 'claim');
      }
      
      // Extract text for general keywords
      messageText = message.fileUploadMessage || message.text || message.content || message.message || JSON.stringify(message);
    }
    
    // Ensure messageText is a string
    if (typeof messageText !== 'string') {
      messageText = String(messageText);
    }
    
    const words = messageText.toLowerCase().split(/\s+/);
    const stopWords = ['the', 'a', 'an', 'and', 'or', 'but', 'for', 'with', 'to', 'from', 'of', 'in', 'on'];
    
    const textKeywords = words
      .filter(word => word.length > 2 && !stopWords.includes(word));
    
    // Combine file and text keywords, remove duplicates
    const allKeywords = [...new Set([...fileKeywords, ...textKeywords])];
    
    // Document-specific keyword boosting for better pattern matching
    const documentPatterns = [
      'upload', 'document', 'file', 'batch', 'multiple', 'process', 'analyze',
      'מסמך', 'קובץ', 'העלאה', 'עיבוד', 'ניתוח', 'אצווה', 'מרובים',
      'vaccination', 'lab', 'results', 'medical', 'records', 'pdf', 'scan',
      'חיסון', 'מעבדה', 'תוצאות', 'רפואי', 'רשומות'
    ];
    
    // Add special patterns for batch document processing
    const hasBatchPattern = allKeywords.some(k => 
      documentPatterns.includes(k) || k.includes('upload_') || k.includes('[UPLOAD_ID')
    );
    
    if (hasBatchPattern) {
      allKeywords.unshift('document_batch_pattern');
    }
    
    return allKeywords.slice(0, 20); // Increased to 20 for better document matching
  }
  
  /**
   * Generate a descriptive name for the memory
   */
  generateMemoryName(message, functions) {
    // Handle both string and object message formats
    let messageText = message;
    let fileInfo = '';
    
    if (typeof message === 'object' && message !== null) {
      // Special handling for file uploads (R-Zero pattern recognition)
      if (message.fileName || message.mimeType) {
        const fileType = message.mimeType?.split('/')[1] || 'file';
        const fileName = message.fileName?.split('.')[0] || 'upload';
        
        // Create descriptive name based on file type
        if (message.mimeType?.includes('csv')) {
          fileInfo = 'CSV Import';
        } else if (message.mimeType?.includes('pdf')) {
          fileInfo = 'PDF Analysis';
        } else if (message.mimeType?.includes('image')) {
          fileInfo = 'Image Processing';
        } else {
          fileInfo = `${fileType.toUpperCase()} Upload`;
        }
        
        // Add context from filename
        if (fileName.toLowerCase().includes('patient')) fileInfo += ' (Patient Data)';
        else if (fileName.toLowerCase().includes('lab')) fileInfo += ' (Lab Results)';
        else if (fileName.toLowerCase().includes('insurance')) fileInfo += ' (Insurance)';
      }
      
      // Extract text for general processing
      messageText = message.fileUploadMessage || message.text || message.content || message.message || JSON.stringify(message);
    }
    
    // Ensure messageText is a string
    if (typeof messageText !== 'string') {
      messageText = String(messageText);
    }
    
    const action = fileInfo || messageText.split(' ')[0];
    const mainFunction = functions[0] || 'process';
    
    // Create descriptive procedural memory name
    return `${action} → ${mainFunction} (${functions.length} functions)`;
  }
  
  /**
   * Normalize query for caching
   */
  normalizeQuery(message) {
    // Handle both string and object message formats
    let messageText = message;
    if (typeof message === 'object' && message !== null) {
      // If message is an object, try to extract the text
      messageText = message.text || message.content || message.message || JSON.stringify(message);
    }
    
    // Ensure messageText is a string
    if (typeof messageText !== 'string') {
      messageText = String(messageText);
    }
    
    return messageText.toLowerCase().trim().substring(0, 50);
  }
  
  /**
   * Get learning statistics for a practice
   */
  async getStats(practiceId) {
    try {
      // Use SecureDataAccess to query memories
      const context = {
        serviceId: 'claude-memory-service',
        apiKey: this.serviceToken?.apiKey || this.serviceToken,
        operation: 'getStats',
        practiceId
      };
      
      const memories = await SecureDataAccess.query('agent_memories', {
        practiceId,
        memoryType: 'claude-function-mapping',
        active: true
      }, {}, context);
      
      const totalExecutions = memories.reduce((sum, m) => sum + m.metrics.totalExecutions, 0);
      const totalTokensSaved = memories.reduce((sum, m) => sum + m.metrics.averageTokensSaved * m.metrics.totalExecutions, 0);
      const totalCostSaved = memories.reduce((sum, m) => sum + m.metrics.costSavingsUSD * m.metrics.totalExecutions, 0);
      
      return {
        totalMemories: memories.length,
        totalExecutions,
        averageConfidence: memories.reduce((sum, m) => sum + m.metrics.confidenceScore, 0) / memories.length,
        totalTokensSaved,
        totalCostSaved,
        averageHitRate: memories.length > 0 ? (totalExecutions / memories.length) : 0
      };
    } catch (error) {
      console.error('Error getting stats:', error);
      return null;
    }
  }
}

// Singleton instance
const claudeMemoryService = new ClaudeMemoryService();
module.exports = claudeMemoryService;