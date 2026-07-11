/**
 * Procedural Memory Service
 * 
 * Stores and retrieves "how-to" knowledge from successful workflows.
 * Implements procedural memory concepts for reusable task patterns.
 */

const SecureDataAccess = require('../secureDataAccess');
const serviceAccountManager = require('../serviceAccountManager');
const learningDataAdapter = require('./learningDataAdapter');
const { LearningEventBusManager, LEARNING_EVENTS } = require('./learningEventBus');
const { LearningConfigManager } = require('./learningConfigService');

class ProceduralMemoryService {
  constructor() {
    this.eventBus = null;
    this.config = null;
    this.dataAdapter = null;
    this.serviceToken = null;
    this.procedures = new Map(); // procedureId -> procedure
    this.procedureIndex = new Map(); // context hash -> procedure IDs
    this.executionHistory = new Map(); // procedureId -> execution results
    this.initialized = false;
    this.stats = {
      totalProcedures: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      averageSuccessRate: 0
    };
  }

  async initialize() {
    if (this.initialized) return;
    
    try {
      // Authenticate service
      this.serviceToken = await serviceAccountManager.authenticate('procedural-memory-service');
      
      // Get singleton instances
      this.eventBus = LearningEventBusManager.getInstance();
      this.config = LearningConfigManager.getInstance();
      this.dataAdapter = learningDataAdapter;
      
      // Initialize data adapter
      await this.dataAdapter.initialize();
      
      // Subscribe to events
      this.subscribeToEvents();
      
      // Load existing procedures from database
      await this.loadProcedures();
      
      // Start memory consolidation
      this.startMemoryConsolidation();
      
      this.initialized = true;
      console.log('✅ Procedural Memory Service initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Procedural Memory Service:', error);
      throw error;
    }
  }

  /**
   * Subscribe to events
   */
  subscribeToEvents() {
    // Listen for detected patterns
    this.eventBus.subscribe(LEARNING_EVENTS.PATTERN_DETECTED, async (event) => {
      await this.createProcedureFromPattern(event.data);
    });
    
    // Listen for successful sequences
    this.eventBus.subscribe(LEARNING_EVENTS.SEQUENCE_FOUND, async (event) => {
      await this.extractProcedure(event.data);
    });
    
    // Listen for solution attempts (R-Zero learning)
    this.eventBus.subscribe(LEARNING_EVENTS.SOLUTION_ATTEMPTED, async (event) => {
      await this.recordProcedureExecution(event.data);
    });
    
    // Listen for learning validation
    this.eventBus.subscribe(LEARNING_EVENTS.LEARNING_VALIDATED, async (event) => {
      await this.updateProcedureSuccess(event.data);
    });
  }

  /**
   * Store a workflow procedure
   */
  async storeWorkflowProcedure(procedure) {
    try {
      // Validate procedure
      if (!procedure.name || !procedure.steps || procedure.steps.length === 0) {
        throw new Error('Invalid procedure: missing name or steps');
      }
      
      // Generate procedure ID
      const procedureId = procedure.id || `proc_${Date.now()}_${Math.random()}`;
      
      // Create procedure object
      const procedureData = {
        id: procedureId,
        name: procedure.name,
        description: procedure.description || '',
        steps: this.standardizeSteps(procedure.steps),
        context: procedure.context || {},
        metadata: {
          createdAt: new Date(),
          lastUsed: null,
          usageCount: 0,
          successRate: 0,
          averageExecutionTime: 0,
          applicableContexts: [],
          requiredFunctions: this.extractRequiredFunctions(procedure.steps)
        },
        performance: {
          successCount: 0,
          failureCount: 0,
          partialCount: 0,
          totalExecutions: 0
        }
      };
      
      // Store in memory
      this.procedures.set(procedureId, procedureData);
      
      // Index by context
      this.indexProcedure(procedureData);
      
      // Store in database
      await this.persistProcedure(procedureData);
      
      // Emit event
      await this.eventBus.emit(LEARNING_EVENTS.PROCEDURE_CREATED, procedureData);
      
      this.stats.totalProcedures++;
      
      return procedureId;
      
    } catch (error) {
      console.error('Error storing workflow procedure:', error);
      throw error;
    }
  }

  /**
   * Retrieve memory for Claude function mapping (Claude-specific interface)
   */
  async retrieveMemory(message, options = {}) {
    try {
      const { practiceId, userId, memoryType, confidence } = options;
      
      // Create context for procedure search
      const context = {
        query: message,
        practiceId,
        userId,
        memoryType,
        minConfidence: confidence || this.learningThreshold || 0.8
      };
      
      // Use existing retrieveProcedure logic
      const procedure = await this.retrieveProcedure(context);
      
      if (!procedure) {
        return null;
      }
      
      // Transform procedure to Claude memory format
      return {
        name: procedure.name || 'Learned Workflow',
        metrics: {
          confidenceScore: procedure.metadata?.successRate || 0.5,
          averageTokensSaved: this.estimateTokensSaved(procedure)
        },
        workflow: {
          selectedFunctions: procedure.steps?.map(step => step.action) || []
        },
        _id: procedure.id
      };
      
    } catch (error) {
      console.error('Error retrieving memory:', error);
      return null;
    }
  }

  /**
   * Retrieve a procedure by context
   */
  async retrieveProcedure(context) {
    try {
      // Find matching procedures
      const candidates = this.findMatchingProcedures(context);
      
      if (candidates.length === 0) {
        return null;
      }
      
      // Rank candidates by relevance and performance
      const ranked = this.rankProcedures(candidates, context);
      
      // Return best match
      const bestMatch = ranked[0];
      
      // Update usage metadata
      bestMatch.metadata.lastUsed = new Date();
      bestMatch.metadata.usageCount++;
      
      return bestMatch;
      
    } catch (error) {
      console.error('Error retrieving procedure:', error);
      return null;
    }
  }

  /**
   * Update procedure success
   */
  async updateProcedureSuccess(procedureId, outcome) {
    try {
      const procedure = this.procedures.get(procedureId);
      
      if (!procedure) {
        throw new Error(`Procedure not found: ${procedureId}`);
      }
      
      // Update performance metrics
      procedure.performance.totalExecutions++;
      
      switch (outcome) {
        case 'success':
          procedure.performance.successCount++;
          break;
        case 'failure':
          procedure.performance.failureCount++;
          break;
        case 'partial':
          procedure.performance.partialCount++;
          break;
      }
      
      // Calculate success rate
      procedure.metadata.successRate = 
        procedure.performance.successCount / procedure.performance.totalExecutions;
      
      // Update in database
      await this.updateProcedureInDB(procedureId, procedure);
      
      // Update stats
      if (outcome === 'success') {
        this.stats.successfulExecutions++;
      } else if (outcome === 'failure') {
        this.stats.failedExecutions++;
      }
      
      this.updateAverageSuccessRate();
      
    } catch (error) {
      console.error('Error updating procedure success:', error);
    }
  }

  /**
   * Create procedure from detected pattern
   */
  async createProcedureFromPattern(pattern) {
    try {
      // Check if pattern is suitable for procedure
      if (!this.isPatternSuitableForProcedure(pattern)) {
        return;
      }
      
      // Convert pattern to procedure
      const procedure = {
        name: `Pattern_${pattern.type}_${pattern.sequence.join('_')}`,
        description: `Automatically extracted from ${pattern.type} pattern`,
        steps: pattern.sequence.map((action, index) => ({
          index: index,
          action: action,
          type: 'function',
          parameters: {},
          expectedOutcome: 'success',
          optional: false
        })),
        context: {
          patternId: pattern.patternId,
          frequency: pattern.frequency,
          confidence: pattern.confidence,
          sourceType: 'pattern_detection'
        }
      };
      
      // Store the procedure
      await this.storeWorkflowProcedure(procedure);
      
    } catch (error) {
      console.error('Error creating procedure from pattern:', error);
    }
  }

  /**
   * Extract procedure from successful sequence
   */
  async extractProcedure(sequenceData) {
    try {
      // Validate sequence
      if (!sequenceData.sequence || sequenceData.sequence.length < 2) {
        return;
      }
      
      // Check if similar procedure already exists
      const existingProcedure = this.findSimilarProcedure(sequenceData.sequence);
      
      if (existingProcedure) {
        // Reinforce existing procedure
        await this.reinforceProcedure(existingProcedure.id, sequenceData);
      } else {
        // Create new procedure
        const procedure = {
          name: this.generateProcedureName(sequenceData),
          description: `Learned from successful execution`,
          steps: this.convertSequenceToSteps(sequenceData.sequence),
          context: sequenceData.metadata || {}
        };
        
        await this.storeWorkflowProcedure(procedure);
      }
      
    } catch (error) {
      console.error('Error extracting procedure:', error);
    }
  }

  /**
   * Record procedure execution
   */
  async recordProcedureExecution(executionData) {
    try {
      const procedureId = executionData.procedureId;
      
      if (!procedureId) return;
      
      // Get or create execution history
      if (!this.executionHistory.has(procedureId)) {
        this.executionHistory.set(procedureId, []);
      }
      
      // Record execution
      this.executionHistory.get(procedureId).push({
        timestamp: new Date(),
        context: executionData.context,
        steps: executionData.steps,
        outcome: executionData.outcome,
        executionTime: executionData.executionTime,
        errors: executionData.errors || []
      });
      
      // Update procedure metadata
      const procedure = this.procedures.get(procedureId);
      
      if (procedure) {
        // Update average execution time
        const executions = this.executionHistory.get(procedureId);
        const totalTime = executions.reduce((sum, e) => sum + (e.executionTime || 0), 0);
        procedure.metadata.averageExecutionTime = totalTime / executions.length;
        
        // Learn from execution context
        this.learnFromExecution(procedure, executionData);
      }
      
    } catch (error) {
      console.error('Error recording procedure execution:', error);
    }
  }

  /**
   * Apply a procedure to current context
   */
  async applyProcedure(procedureId, context) {
    try {
      const procedure = this.procedures.get(procedureId);
      
      if (!procedure) {
        throw new Error(`Procedure not found: ${procedureId}`);
      }
      
      // Adapt procedure to context
      const adaptedSteps = this.adaptStepsToContext(procedure.steps, context);
      
      // Create execution plan
      const executionPlan = {
        procedureId: procedureId,
        procedureName: procedure.name,
        steps: adaptedSteps,
        context: context,
        estimatedTime: procedure.metadata.averageExecutionTime,
        confidence: this.calculateApplicationConfidence(procedure, context)
      };
      
      return executionPlan;
      
    } catch (error) {
      console.error('Error applying procedure:', error);
      throw error;
    }
  }

  /**
   * Find similar procedures
   */
  findSimilarProcedures(targetSteps, threshold = 0.7) {
    const similar = [];
    
    for (const [id, procedure] of this.procedures) {
      const similarity = this.calculateSimilarity(procedure.steps, targetSteps);
      
      if (similarity >= threshold) {
        similar.push({
          ...procedure,
          similarity: similarity
        });
      }
    }
    
    return similar.sort((a, b) => b.similarity - a.similarity);
  }

  /**
   * Transfer procedure to different context
   */
  async transferProcedure(procedureId, targetContext) {
    try {
      const procedure = this.procedures.get(procedureId);
      
      if (!procedure) {
        throw new Error(`Procedure not found: ${procedureId}`);
      }
      
      // Create transferred procedure
      const transferredProcedure = {
        ...procedure,
        id: `${procedureId}_transfer_${Date.now()}`,
        name: `${procedure.name}_adapted`,
        context: {
          ...procedure.context,
          ...targetContext,
          originalProcedureId: procedureId,
          transferDate: new Date()
        },
        steps: this.adaptStepsForTransfer(procedure.steps, targetContext)
      };
      
      // Store transferred procedure
      await this.storeWorkflowProcedure(transferredProcedure);
      
      return transferredProcedure.id;
      
    } catch (error) {
      console.error('Error transferring procedure:', error);
      throw error;
    }
  }

  /**
   * Load procedures from database
   */
  async loadProcedures() {
    try {
      const context = {
        serviceId: 'procedural-memory-service',
        operation: 'load-procedures',
        practiceId: 'global',
        apiKey: this.serviceToken?.apiKey || this.serviceToken
      };
      
      const procedures = await this.dataAdapter.retrieveLearningData(
        'procedural_memories',
        {},
        { limit: 1000 },
        context
      );
      
      for (const proc of procedures) {
        this.procedures.set(proc.id, proc);
        this.indexProcedure(proc);
      }
      
      console.log(`Loaded ${procedures.length} procedures from database`);
      
    } catch (error) {
      console.error('Error loading procedures:', error);
    }
  }

  /**
   * Persist procedure to database
   */
  async persistProcedure(procedure) {
    try {
      const context = {
        serviceId: 'procedural-memory-service',
        operation: 'store-procedure',
        practiceId: procedure.context?.practiceId || 'global',
        apiKey: this.serviceToken?.apiKey || this.serviceToken
      };
      
      await this.dataAdapter.storeLearningData(
        'procedural_memories',
        procedure,
        context
      );
      
    } catch (error) {
      console.error('Error persisting procedure:', error);
    }
  }

  /**
   * Update procedure in database
   */
  async updateProcedureInDB(procedureId, procedure) {
    try {
      const context = {
        serviceId: 'procedural-memory-service',
        operation: 'update-procedure',
        practiceId: procedure.context?.practiceId || 'global',
        apiKey: this.serviceToken?.apiKey
      };
      
      await SecureDataAccess.update(
        'procedural_memories',
        { id: procedureId },
        procedure,
        context
      );
      
    } catch (error) {
      console.error('Error updating procedure in database:', error);
    }
  }

  /**
   * Helper methods
   */
  
  standardizeSteps(steps) {
    return steps.map((step, index) => ({
      index: index,
      action: step.action || step.functionName || step,
      type: step.type || 'function',
      parameters: step.parameters || {},
      expectedOutcome: step.expectedOutcome || 'success',
      optional: step.optional || false,
      timeout: step.timeout || 30000,
      retryable: step.retryable !== false
    }));
  }

  extractRequiredFunctions(steps) {
    return [...new Set(steps.map(step => step.action || step.functionName).filter(Boolean))];
  }

  indexProcedure(procedure) {
    // Create context hash
    const contextHash = this.hashContext(procedure.context);
    
    if (!this.procedureIndex.has(contextHash)) {
      this.procedureIndex.set(contextHash, new Set());
    }
    
    this.procedureIndex.get(contextHash).add(procedure.id);
  }

  hashContext(context) {
    return JSON.stringify(context || {});
  }

  findMatchingProcedures(context) {
    const matches = [];
    
    // Find exact context matches
    const contextHash = this.hashContext(context);
    const exactMatches = this.procedureIndex.get(contextHash);
    
    if (exactMatches) {
      for (const id of exactMatches) {
        const procedure = this.procedures.get(id);
        if (procedure) matches.push(procedure);
      }
    }
    
    // Find partial matches
    for (const [id, procedure] of this.procedures) {
      if (this.contextMatches(procedure.context, context, 0.5)) {
        if (!matches.find(p => p.id === id)) {
          matches.push(procedure);
        }
      }
    }
    
    return matches;
  }

  contextMatches(procContext, targetContext, threshold = 0.7) {
    if (!procContext || !targetContext) return false;
    
    const procKeys = Object.keys(procContext);
    const targetKeys = Object.keys(targetContext);
    
    let matches = 0;
    for (const key of procKeys) {
      if (targetKeys.includes(key) && procContext[key] === targetContext[key]) {
        matches++;
      }
    }
    
    const similarity = matches / Math.max(procKeys.length, targetKeys.length);
    return similarity >= threshold;
  }

  rankProcedures(procedures, context) {
    return procedures.map(proc => ({
      ...proc,
      score: this.calculateProcedureScore(proc, context)
    })).sort((a, b) => b.score - a.score);
  }

  calculateProcedureScore(procedure, context) {
    let score = 0;
    
    // Success rate weight
    score += procedure.metadata.successRate * 0.4;
    
    // Usage frequency weight
    score += Math.min(1, procedure.metadata.usageCount / 100) * 0.2;
    
    // Context similarity weight
    score += this.calculateContextSimilarity(procedure.context, context) * 0.3;
    
    // Recency weight
    const daysSinceUsed = procedure.metadata.lastUsed ? 
      (Date.now() - new Date(procedure.metadata.lastUsed)) / (24 * 60 * 60 * 1000) : 100;
    score += Math.max(0, 1 - daysSinceUsed / 30) * 0.1;
    
    return score;
  }

  calculateContextSimilarity(context1, context2) {
    if (!context1 || !context2) return 0;
    
    const keys1 = Object.keys(context1);
    const keys2 = Object.keys(context2);
    const allKeys = new Set([...keys1, ...keys2]);
    
    let matches = 0;
    for (const key of allKeys) {
      if (context1[key] === context2[key]) matches++;
    }
    
    return matches / allKeys.size;
  }

  isPatternSuitableForProcedure(pattern) {
    return pattern.frequency >= 3 && 
           pattern.confidence >= 0.6 && 
           pattern.sequence && 
           pattern.sequence.length >= 2;
  }

  findSimilarProcedure(sequence) {
    for (const [id, procedure] of this.procedures) {
      const procSteps = procedure.steps.map(s => s.action);
      
      if (this.sequencesAreSimilar(procSteps, sequence)) {
        return procedure;
      }
    }
    
    return null;
  }

  sequencesAreSimilar(seq1, seq2, threshold = 0.8) {
    if (Math.abs(seq1.length - seq2.length) > 2) return false;
    
    const similarity = this.calculateSimilarity(seq1, seq2);
    return similarity >= threshold;
  }

  calculateSimilarity(seq1, seq2) {
    const maxLength = Math.max(seq1.length, seq2.length);
    if (maxLength === 0) return 1;
    
    let matches = 0;
    const minLength = Math.min(seq1.length, seq2.length);
    
    for (let i = 0; i < minLength; i++) {
      if (seq1[i] === seq2[i] || 
          (typeof seq1[i] === 'object' && typeof seq2[i] === 'object' && 
           seq1[i].action === seq2[i].action)) {
        matches++;
      }
    }
    
    return matches / maxLength;
  }

  reinforceProcedure(procedureId, newData) {
    const procedure = this.procedures.get(procedureId);
    
    if (procedure) {
      // Increase confidence
      procedure.metadata.usageCount++;
      
      // Update context with new observations
      if (newData.metadata) {
        procedure.metadata.applicableContexts.push(newData.metadata);
      }
    }
  }

  generateProcedureName(sequenceData) {
    const actions = sequenceData.sequence.slice(0, 3).join('_');
    return `Workflow_${actions}_${Date.now()}`;
  }

  convertSequenceToSteps(sequence) {
    return sequence.map((action, index) => ({
      index: index,
      action: typeof action === 'string' ? action : action.functionName,
      type: 'function',
      parameters: typeof action === 'object' ? action.parameters : {},
      expectedOutcome: 'success',
      optional: false
    }));
  }

  learnFromExecution(procedure, executionData) {
    // Update applicable contexts
    if (executionData.outcome === 'success') {
      procedure.metadata.applicableContexts.push(executionData.context);
      
      // Limit context history
      if (procedure.metadata.applicableContexts.length > 100) {
        procedure.metadata.applicableContexts = 
          procedure.metadata.applicableContexts.slice(-100);
      }
    }
  }

  adaptStepsToContext(steps, context) {
    // Adapt steps based on context
    return steps.map(step => ({
      ...step,
      parameters: this.adaptParameters(step.parameters, context)
    }));
  }

  adaptParameters(parameters, context) {
    const adapted = { ...parameters };
    
    // Replace context variables
    for (const [key, value] of Object.entries(adapted)) {
      if (typeof value === 'string' && value.startsWith('${')) {
        const varName = value.slice(2, -1);
        if (context[varName]) {
          adapted[key] = context[varName];
        }
      }
    }
    
    return adapted;
  }

  calculateApplicationConfidence(procedure, context) {
    const contextSimilarity = this.calculateContextSimilarity(procedure.context, context);
    const successRate = procedure.metadata.successRate;
    const usageRecency = procedure.metadata.lastUsed ? 
      Math.max(0, 1 - (Date.now() - new Date(procedure.metadata.lastUsed)) / (30 * 24 * 60 * 60 * 1000)) : 0;
    
    return (contextSimilarity * 0.5) + (successRate * 0.3) + (usageRecency * 0.2);
  }

  adaptStepsForTransfer(steps, targetContext) {
    return steps.map(step => ({
      ...step,
      parameters: this.adaptParameters(step.parameters, targetContext),
      adapted: true
    }));
  }

  updateAverageSuccessRate() {
    let totalSuccess = 0;
    let totalExecutions = 0;
    
    for (const [id, procedure] of this.procedures) {
      totalSuccess += procedure.performance.successCount;
      totalExecutions += procedure.performance.totalExecutions;
    }
    
    this.stats.averageSuccessRate = totalExecutions > 0 ? 
      totalSuccess / totalExecutions : 0;
  }

  /**
   * Estimate tokens saved by using this procedure
   */
  estimateTokensSaved(procedure) {
    if (!procedure || !procedure.steps) return 0;
    
    // Estimate based on number of functions and complexity
    const functionCount = procedure.steps.length;
    const baseTokensPerFunction = 150; // Approximate tokens for function description
    
    // More functions = more tokens saved by having pre-selected set
    return functionCount * baseTokensPerFunction;
  }

  /**
   * Start memory consolidation process
   */
  startMemoryConsolidation() {
    // Periodically consolidate and optimize procedures
    this.consolidationInterval = setInterval(() => {
      this.consolidateMemories();
    }, 3600000); // Every hour
  }

  /**
   * Consolidate memories
   */
  async consolidateMemories() {
    try {
      // Remove low-performing procedures
      for (const [id, procedure] of this.procedures) {
        if (procedure.performance.totalExecutions > 10 && 
            procedure.metadata.successRate < 0.3) {
          this.procedures.delete(id);
          console.log(`Removed low-performing procedure: ${id}`);
        }
      }
      
      // Merge similar procedures
      await this.mergeSimilarProcedures();
      
      // Update statistics
      this.stats.totalProcedures = this.procedures.size;
      
    } catch (error) {
      console.error('Error consolidating memories:', error);
    }
  }

  /**
   * Merge similar procedures
   */
  async mergeSimilarProcedures() {
    const merged = new Set();
    
    for (const [id1, proc1] of this.procedures) {
      if (merged.has(id1)) continue;
      
      for (const [id2, proc2] of this.procedures) {
        if (id1 === id2 || merged.has(id2)) continue;
        
        const similarity = this.calculateSimilarity(proc1.steps, proc2.steps);
        
        if (similarity > 0.9) {
          // Merge procedures
          if (proc1.metadata.successRate >= proc2.metadata.successRate) {
            // Keep proc1, merge stats from proc2
            proc1.performance.totalExecutions += proc2.performance.totalExecutions;
            proc1.performance.successCount += proc2.performance.successCount;
            proc1.metadata.successRate = 
              proc1.performance.successCount / proc1.performance.totalExecutions;
            
            this.procedures.delete(id2);
            merged.add(id2);
          }
        }
      }
    }
  }

  /**
   * Get service statistics
   */
  getStats() {
    return {
      ...this.stats,
      memorySize: this.procedures.size,
      indexSize: this.procedureIndex.size,
      executionHistorySize: this.executionHistory.size
    };
  }

  /**
   * Cleanup and shutdown
   */
  shutdown() {
    if (this.consolidationInterval) {
      clearInterval(this.consolidationInterval);
    }
    
    console.log('Procedural Memory Service shutdown complete');
  }
}

module.exports = new ProceduralMemoryService();