/**
 * 🧠 Self-Improving Memory System (R-Zero Inspired)
 * 
 * This service implements a self-training AI memory system inspired by Tencent's R-Zero approach.
 * It enables the AI to learn from user interactions, improve over time, and adapt to different
 * user roles (doctors, secretaries, nurses) with role-specific optimizations.
 * 
 * Key Features:
 * - User and role-specific learning patterns
 * - Automatic feedback collection from interactions
 * - Cross-learning between similar users
 * - Adaptive difficulty and challenge generation
 * - Pattern synthesis and confidence scoring
 */

const { ObjectId } = require('mongodb');
const SecureDataAccess = require('./secureDataAccess');
const serviceAccountManager = require('./serviceAccountManager');
const claudeMemoryService = require('./claudeMemoryService');
const proceduralMemoryService = require('./learning/proceduralMemoryService');
const crypto = require('crypto');

class SelfImprovingMemory {
  constructor() {
    this.initialized = false;
    this.serviceToken = null;
    
    // Learning parameters
    this.confidenceThreshold = 0.7;
    this.crossLearningThreshold = 0.85;
    this.feedbackWindow = 30000; // 30 seconds to consider interaction successful
    
    // Role-specific configurations
    // Maps learning system roles to their optimization preferences
    this.roleConfigs = {
      doctor: {
        priorities: ['accuracy', 'comprehensiveness', 'medical_relevance', 'document_analysis'],
        functionPreferences: ['diagnose', 'analyze', 'prescribe', 'lab_analysis', 'interpret_results',
                            'analyzeDocument', 'batchAnalyzeDocuments', 'analyzeUploadedDocuments'],
        successMetrics: ['diagnosis_accuracy', 'treatment_effectiveness', 'document_processing_speed'],
        learningRate: 0.8,
        // All medical/clinical platform roles that map to this learning profile
        platformRoles: ['doctor', 'physician', 'doctor_specialist', 'provider', 'lab_tech', 'technician'],
        // Document processing patterns specific to doctors
        documentPatterns: {
          priorities: ['lab_results', 'imaging_reports', 'consultation_notes', 'referrals'],
          batchProcessing: true,
          autoAssignToPatient: true,
          extractMedicalData: true
        }
      },
      secretary: {
        priorities: ['speed', 'efficiency', 'scheduling', 'administration', 'document_organization'],
        functionPreferences: ['schedule', 'appointment', 'communication', 'billing', 'registration',
                            'analyzeUploadedDocuments', 'assignDocumentToPatient', 'batchAnalyzeDocuments'],
        successMetrics: ['task_completion_time', 'scheduling_efficiency', 'document_filing_accuracy'],
        learningRate: 0.9,
        // All administrative/support platform roles
        platformRoles: ['secretary', 'receptionist', 'billing', 'staff', 'administrative_assistant'],
        // Document processing patterns for administrative staff
        documentPatterns: {
          priorities: ['insurance_forms', 'consent_forms', 'registration_documents', 'billing_documents'],
          batchProcessing: true,
          autoAssignToPatient: true,
          categorizeDocuments: true
        }
      },
      nurse: {
        priorities: ['patient_care', 'vital_monitoring', 'medication', 'clinical_support', 'documentation'],
        functionPreferences: ['vitals', 'medication', 'patient_monitoring', 'care_planning', 'triage',
                            'analyzeDocument', 'uploadDocument', 'addMedicalHistory'],
        successMetrics: ['care_quality', 'response_time', 'documentation_completeness'],
        learningRate: 0.85,
        // All nursing platform roles
        platformRoles: ['nurse', 'nurse_rn', 'nurse_lpn', 'rn', 'lpn', 'nursing_assistant'],
        // Document patterns for nursing staff
        documentPatterns: {
          priorities: ['vaccination_records', 'vital_signs', 'nursing_notes', 'medication_administration'],
          batchProcessing: false,
          autoAssignToPatient: true,
          updateMedicalHistory: true
        }
      },
      admin: {
        priorities: ['reporting', 'compliance', 'management', 'oversight', 'document_compliance'],
        functionPreferences: ['reports', 'analytics', 'compliance', 'audit', 'user_management',
                            'batchAnalyzeDocuments', 'searchDocuments', 'validateDocumentation'],
        successMetrics: ['report_accuracy', 'compliance_score', 'document_audit_success'],
        learningRate: 0.75,
        // All management/administrative platform roles
        platformRoles: ['admin', 'administrator', 'medical_director', 'compliance_officer', 'manager'],
        // Document patterns for administrative oversight
        documentPatterns: {
          priorities: ['compliance_documents', 'audit_reports', 'policy_documents', 'regulatory_filings'],
          batchProcessing: true,
          autoAssignToPatient: false,
          generateReports: true
        }
      }
    };
    
    // Tracking active interactions for feedback
    this.activeInteractions = new Map();
    
    // Cache for role patterns
    this.rolePatternCache = new Map();
    this.cacheTimeout = 10 * 60 * 1000; // 10 minutes
  }
  
  async initialize() {
    if (this.initialized) return this;
    
    try {
      // Authenticate service
      this.serviceToken = await serviceAccountManager.authenticate('self-improving-memory');
      console.log('✅ Self-Improving Memory Service authenticated');
      
      // Get the actual API key from KMS for use in SecureDataAccess
      const productionKMS = require('./productionKMS');
      if (!productionKMS.initialized) {
        await productionKMS.initialize();
      }
      this.apiKey = await productionKMS.getInternalKey('SERVICE_SELF_IMPROVING_MEMORY_KEY');
      
      // Initialize dependent services
      await claudeMemoryService.initialize();
      await proceduralMemoryService.initialize();
      
      this.initialized = true;
      console.log('🧠 Self-Improving Memory initialized');
      console.log('  → Role-based learning: ACTIVE');
      console.log('  → Cross-user synthesis: ENABLED');
      console.log('  → Adaptive difficulty: READY');
      
      // Start background improvement process
      this.startContinuousImprovement();
      
      return this;
    } catch (error) {
      console.error('Failed to initialize SelfImprovingMemory:', error);
      return this;
    }
  }
  
  /**
   * Track the start of an interaction for feedback collection
   */
  startInteraction(interactionId, userId, userRole, query, context) {
    this.activeInteractions.set(interactionId, {
      userId,
      userRole,
      query,
      context,
      startTime: Date.now(),
      functions: [],
      modifications: [],
      accepted: true // Assume success unless modified
    });
    
    return interactionId;
  }
  
  /**
   * Record functions selected by the AI
   */
  recordFunctionSelection(interactionId, functions) {
    const interaction = this.activeInteractions.get(interactionId);
    if (interaction) {
      interaction.functions = functions;
      interaction.selectionTime = Date.now() - interaction.startTime;
    }
  }
  
  /**
   * Record if user modified the AI's response
   */
  recordModification(interactionId, modification) {
    const interaction = this.activeInteractions.get(interactionId);
    if (interaction) {
      interaction.modifications.push(modification);
      interaction.accepted = false; // User modified = not fully successful
    }
  }
  
  /**
   * Complete interaction and collect feedback
   */
  async completeInteraction(interactionId, result) {
    const interaction = this.activeInteractions.get(interactionId);
    if (!interaction) return;
    
    try {
      const feedback = {
        userId: interaction.userId,
        userRole: interaction.userRole,
        query: interaction.query,
        functions: interaction.functions,
        duration: Date.now() - interaction.startTime,
        accepted: interaction.accepted && !interaction.modifications.length,
        modifications: interaction.modifications,
        success: result.success || interaction.accepted,
        
        // Role-specific scoring
        roleScore: this.calculateRoleScore(interaction.userRole, interaction, result),
        
        // Calculate confidence adjustment
        confidenceAdjustment: this.calculateConfidenceAdjustment(interaction, result),
        
        timestamp: new Date()
      };
      
      // Store feedback for learning
      await this.storeFeedback(feedback);
      
      // Update pattern confidence if successful
      if (feedback.success && feedback.roleScore > 0.7) {
        await this.reinforcePattern(feedback);
      }
      
      // Learn from failures
      if (!feedback.success || feedback.roleScore < 0.5) {
        await this.learnFromFailure(feedback);
      }
      
      // Check for cross-learning opportunities
      if (feedback.roleScore > this.crossLearningThreshold) {
        await this.attemptCrossLearning(feedback);
      }
      
    } finally {
      this.activeInteractions.delete(interactionId);
    }
  }
  
  /**
   * Calculate role-specific success score
   */
  calculateRoleScore(role, interaction, result) {
    const config = this.roleConfigs[role];
    if (!config) return 0.5; // Default middle score
    
    let score = 0;
    let weights = 0;
    
    // Check if preferred functions were used
    const usedPreferredFunctions = interaction.functions.filter(f => 
      config.functionPreferences.some(pref => f.toLowerCase().includes(pref))
    ).length;
    score += (usedPreferredFunctions / interaction.functions.length) * 0.3;
    weights += 0.3;
    
    // Check speed for roles that prioritize it
    if (config.priorities.includes('speed') || config.priorities.includes('efficiency')) {
      const speedScore = Math.max(0, 1 - (interaction.duration / this.feedbackWindow));
      score += speedScore * 0.3;
      weights += 0.3;
    }
    
    // Check accuracy for medical roles
    if (config.priorities.includes('accuracy') || config.priorities.includes('medical_relevance')) {
      const accuracyScore = interaction.accepted ? 1 : 0.5;
      score += accuracyScore * 0.4;
      weights += 0.4;
    }
    
    // Check if no modifications were needed
    if (interaction.accepted && !interaction.modifications.length) {
      score += 0.2;
      weights += 0.2;
    }
    
    return weights > 0 ? score / weights : 0.5;
  }
  
  /**
   * Calculate confidence adjustment based on interaction
   */
  calculateConfidenceAdjustment(interaction, result) {
    let adjustment = 0;
    
    // Positive adjustments
    if (interaction.accepted && !interaction.modifications.length) {
      adjustment += 0.05; // Clean success
    }
    if (interaction.duration < 5000) {
      adjustment += 0.03; // Fast execution
    }
    if (result.tokensUsed && result.tokensUsed < 1000) {
      adjustment += 0.02; // Efficient token usage
    }
    
    // Negative adjustments
    if (!interaction.accepted) {
      adjustment -= 0.05; // User rejected
    }
    if (interaction.modifications.length > 0) {
      adjustment -= 0.03 * interaction.modifications.length; // Each modification reduces confidence
    }
    if (interaction.duration > this.feedbackWindow) {
      adjustment -= 0.02; // Too slow
    }
    
    return Math.max(-0.1, Math.min(0.1, adjustment)); // Cap adjustments
  }
  
  /**
   * Store feedback for future learning
   */
  async storeFeedback(feedback) {
    const context = {
      serviceId: 'self-improving-memory',
      apiKey: this.apiKey,
      operation: 'storeFeedback',
      practiceId: feedback.context?.practiceId || 'global',
      queryType: 'INTERNAL_SERVICE'
    };
    
    const feedbackData = {
      ...feedback,
      _id: crypto.randomUUID(),
      createdAt: new Date()
    };
    
    await SecureDataAccess.insert('ai_feedback', feedbackData, context);
  }
  
  /**
   * Reinforce successful patterns
   */
  async reinforcePattern(feedback) {
    // Find related memory
    const memories = await this.findRelatedMemories(feedback);
    
    for (const memory of memories) {
      // Increase confidence
      memory.metrics.confidenceScore = Math.min(0.99, 
        memory.metrics.confidenceScore + feedback.confidenceAdjustment
      );
      
      // Update success metrics
      memory.metrics.totalExecutions += 1;
      memory.metrics.successfulExecutions += 1;
      memory.metrics.successRate = memory.metrics.successfulExecutions / memory.metrics.totalExecutions;
      memory.metrics[`${feedback.userRole}_score`] = feedback.roleScore;
      
      // Update memory
      await this.updateMemory(memory);
    }
  }
  
  /**
   * Learn from failures to improve
   */
  async learnFromFailure(feedback) {
    // Analyze what went wrong
    const analysis = {
      wrongFunctions: feedback.functions.filter(f => 
        !this.roleConfigs[feedback.userRole]?.functionPreferences.includes(f)
      ),
      tooSlow: feedback.duration > this.feedbackWindow,
      userModified: feedback.modifications.length > 0,
      lowRoleScore: feedback.roleScore < 0.5
    };
    
    // Find related memories and reduce confidence
    const memories = await this.findRelatedMemories(feedback);
    
    for (const memory of memories) {
      // Reduce confidence based on failure type
      let reduction = 0.05;
      if (analysis.userModified) reduction += 0.03;
      if (analysis.lowRoleScore) reduction += 0.05;
      
      memory.metrics.confidenceScore = Math.max(0.1, 
        memory.metrics.confidenceScore - reduction
      );
      
      // Track failure
      memory.metrics.failedExecutions = (memory.metrics.failedExecutions || 0) + 1;
      memory.metrics.successRate = memory.metrics.successfulExecutions / 
        (memory.metrics.totalExecutions + 1);
      
      await this.updateMemory(memory);
    }
    
    // Create alternative pattern if consistently failing
    if (memories.length > 0 && memories[0].metrics.successRate < 0.3) {
      await this.createAlternativePattern(feedback, analysis);
    }
  }
  
  /**
   * Attempt to share successful patterns across similar users
   */
  async attemptCrossLearning(feedback) {
    const context = {
      serviceId: 'self-improving-memory',
      apiKey: this.apiKey,
      operation: 'crossLearning',
      practiceId: feedback.context?.practiceId || 'global',
      queryType: 'INTERNAL_SERVICE'
    };
    
    // Find similar users in the same role
    const similarUsers = await SecureDataAccess.query('users', {
      role: feedback.userRole,
      department: feedback.context?.department,
      _id: { $ne: feedback.userId } // Exclude current user
    }, { limit: 10 }, context);
    
    // Check if this pattern would benefit similar users
    for (const user of similarUsers) {
      const userMemories = await SecureDataAccess.query('agent_memories', {
        userId: user._id,
        'triggers.keywords': { $in: this.extractKeywords(feedback.query) }
      }, { limit: 1 }, context);
      
      // If user doesn't have this pattern or has a lower confidence one
      if (!userMemories.length || userMemories[0].metrics.confidenceScore < feedback.roleScore) {
        await this.propagatePattern(feedback, user._id);
      }
    }
  }
  
  /**
   * Create alternative pattern when current one fails
   */
  async createAlternativePattern(feedback, analysis) {
    const roleConfig = this.roleConfigs[feedback.userRole];
    
    // Generate alternative function set based on role preferences
    const alternativeFunctions = roleConfig.functionPreferences
      .filter(f => !feedback.functions.includes(f))
      .slice(0, 3); // Take top 3 alternatives
    
    const alternativePattern = {
      practiceId: feedback.context?.practiceId || 'global',
      userId: feedback.userId,
      memoryType: 'alternative-pattern',
      name: `Alternative: ${feedback.query.substring(0, 50)}`,
      description: `Alternative approach after failed pattern`,
      
      triggers: {
        keywords: this.extractKeywords(feedback.query),
        patterns: [],
        context: { userRole: feedback.userRole }
      },
      
      workflow: {
        selectedFunctions: alternativeFunctions,
        steps: alternativeFunctions.map((f, i) => ({
          order: i + 1,
          action: `Call ${f}`,
          function: f
        }))
      },
      
      metrics: {
        confidenceScore: 0.5, // Start with moderate confidence
        totalExecutions: 0,
        successfulExecutions: 0,
        failedExecutions: 0,
        successRate: 0,
        roleScore: 0
      },
      
      active: true,
      createdAt: new Date()
    };
    
    const context = {
      serviceId: 'self-improving-memory',
      apiKey: this.apiKey,
      operation: 'createAlternative',
      practiceId: feedback.context?.practiceId || 'global',
      queryType: 'INTERNAL_SERVICE'
    };
    
    await SecureDataAccess.insert('agent_memories', alternativePattern, context);
  }
  
  /**
   * Find memories related to feedback
   */
  async findRelatedMemories(feedback) {
    const context = {
      serviceId: 'self-improving-memory',
      apiKey: this.apiKey,
      operation: 'findRelated',
      practiceId: feedback.context?.practiceId || 'global',
      queryType: 'INTERNAL_SERVICE'
    };
    
    const keywords = this.extractKeywords(feedback.query);
    
    return await SecureDataAccess.query('agent_memories', {
      practiceId: feedback.context?.practiceId || 'global',
      userId: feedback.userId,
      'triggers.keywords': { $in: keywords },
      active: true
    }, { limit: 5 }, context);
  }
  
  /**
   * Update memory in database
   */
  async updateMemory(memory) {
    const context = {
      serviceId: 'self-improving-memory',
      apiKey: this.apiKey,
      operation: 'updateMemory',
      practiceId: memory.practiceId,
      queryType: 'INTERNAL_SERVICE'
    };
    
    memory.updatedAt = new Date();
    
    await SecureDataAccess.update('agent_memories', 
      { _id: memory._id },
      { $set: memory },
      context
    );
  }
  
  /**
   * Propagate successful pattern to another user
   */
  async propagatePattern(feedback, targetUserId) {
    const context = {
      serviceId: 'self-improving-memory',
      apiKey: this.apiKey,
      operation: 'propagatePattern',
      practiceId: feedback.context?.practiceId || 'global',
      queryType: 'INTERNAL_SERVICE'
    };
    
    const propagatedPattern = {
      practiceId: feedback.context?.practiceId || 'global',
      userId: targetUserId,
      memoryType: 'cross-learned',
      name: `Learned: ${feedback.query.substring(0, 50)}`,
      description: `Pattern learned from successful execution by similar user`,
      sourceUserId: feedback.userId,
      
      triggers: {
        keywords: this.extractKeywords(feedback.query),
        patterns: [],
        context: { userRole: feedback.userRole }
      },
      
      workflow: {
        selectedFunctions: feedback.functions,
        steps: feedback.functions.map((f, i) => ({
          order: i + 1,
          action: `Call ${f}`,
          function: f
        }))
      },
      
      metrics: {
        confidenceScore: feedback.roleScore * 0.8, // Slightly lower confidence for propagated
        totalExecutions: 0,
        successfulExecutions: 0,
        failedExecutions: 0,
        successRate: 0,
        roleScore: feedback.roleScore,
        propagatedFrom: feedback.userId
      },
      
      active: true,
      createdAt: new Date()
    };
    
    await SecureDataAccess.insert('agent_memories', propagatedPattern, context);
  }
  
  /**
   * Extract keywords from query
   */
  extractKeywords(query) {
    if (!query) return [];
    
    // Remove common words
    const stopWords = ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for'];
    
    return query.toLowerCase()
      .split(/\s+/)
      .filter(word => word.length > 2 && !stopWords.includes(word))
      .slice(0, 10);
  }
  
  /**
   * Get role-optimized suggestions
   */
  async getRoleOptimizedSuggestions(userId, userRole, query, context) {
    const roleConfig = this.roleConfigs[userRole];
    if (!roleConfig) return null;
    
    // Check cache first
    const cacheKey = `${userId}:${userRole}:${query}`;
    const cached = this.rolePatternCache.get(cacheKey);
    if (cached && cached.expiry > Date.now()) {
      return cached.suggestions;
    }
    
    const dataContext = {
      serviceId: 'self-improving-memory',
      apiKey: this.apiKey,
      operation: 'getRoleSuggestions',
      practiceId: context?.practiceId || 'global',
      queryType: 'INTERNAL_SERVICE'
    };
    
    // Find role-specific patterns
    const patterns = await SecureDataAccess.query('agent_memories', {
      practiceId: context?.practiceId || 'global',
      userId,
      [`metrics.${userRole}_score`]: { $gte: 0.7 },
      active: true
    }, { 
      limit: 5,
      sort: { [`metrics.${userRole}_score`]: -1 }
    }, dataContext);
    
    // Also check cross-learned patterns from successful peers
    const crossPatterns = await SecureDataAccess.query('agent_memories', {
      practiceId: context?.practiceId || 'global',
      userId,
      memoryType: 'cross-learned',
      'triggers.context.userRole': userRole,
      'metrics.confidenceScore': { $gte: this.confidenceThreshold }
    }, { limit: 3 }, dataContext);
    
    const suggestions = {
      roleOptimizedFunctions: roleConfig.functionPreferences,
      learnedPatterns: patterns.map(p => ({
        functions: p.workflow?.selectedFunctions || [],
        confidence: p.metrics.confidenceScore,
        roleScore: p.metrics[`${userRole}_score`]
      })),
      crossLearnedPatterns: crossPatterns.map(p => ({
        functions: p.workflow?.selectedFunctions || [],
        confidence: p.metrics.confidenceScore,
        sourceUser: p.metrics.propagatedFrom
      })),
      learningRate: roleConfig.learningRate
    };
    
    // Cache the suggestions
    this.rolePatternCache.set(cacheKey, {
      suggestions,
      expiry: Date.now() + this.cacheTimeout
    });
    
    return suggestions;
  }
  
  /**
   * Generate adaptive challenge for user improvement
   */
  async generateAdaptiveChallenge(userId, userRole, currentLevel) {
    const roleConfig = this.roleConfigs[userRole];
    if (!roleConfig) return null;
    
    const context = {
      serviceId: 'self-improving-memory',
      apiKey: this.apiKey,
      operation: 'generateChallenge',
      practiceId: 'global',
      queryType: 'INTERNAL_SERVICE'
    };
    
    // Get user's performance history
    const recentFeedback = await SecureDataAccess.query('ai_feedback', {
      userId,
      userRole,
      timestamp: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } // Last 7 days
    }, { 
      limit: 20,
      sort: { timestamp: -1 }
    }, context);
    
    // Calculate average performance
    const avgScore = recentFeedback.reduce((sum, f) => sum + f.roleScore, 0) / 
      (recentFeedback.length || 1);
    
    // Generate challenge slightly above current level
    const targetDifficulty = Math.min(1.0, currentLevel + 0.1);
    
    const challenge = {
      userId,
      userRole,
      type: this.selectChallengeType(userRole, avgScore),
      difficulty: targetDifficulty,
      scenario: this.generateScenario(userRole, targetDifficulty),
      expectedFunctions: this.selectChallengeFunctions(roleConfig, targetDifficulty),
      timeLimit: this.calculateTimeLimit(targetDifficulty),
      successCriteria: {
        minRoleScore: targetDifficulty * 0.7,
        maxDuration: this.calculateTimeLimit(targetDifficulty),
        requiredFunctions: Math.floor(roleConfig.functionPreferences.length * targetDifficulty)
      },
      createdAt: new Date()
    };
    
    // Store challenge for tracking
    await SecureDataAccess.insert('ai_challenges', challenge, context);
    
    return challenge;
  }
  
  /**
   * Select appropriate challenge type based on role and performance
   */
  selectChallengeType(role, avgScore) {
    const types = {
      doctor: avgScore < 0.5 ? 'basic_diagnosis' : avgScore < 0.7 ? 'complex_case' : 'rare_condition',
      secretary: avgScore < 0.5 ? 'simple_scheduling' : avgScore < 0.7 ? 'conflict_resolution' : 'multi_resource_optimization',
      nurse: avgScore < 0.5 ? 'vital_monitoring' : avgScore < 0.7 ? 'medication_management' : 'emergency_response',
      admin: avgScore < 0.5 ? 'basic_reporting' : avgScore < 0.7 ? 'compliance_audit' : 'strategic_planning'
    };
    
    return types[role] || 'general_task';
  }
  
  /**
   * Generate scenario based on role and difficulty
   */
  generateScenario(role, difficulty) {
    const scenarios = {
      doctor: {
        0.3: 'Patient with common cold symptoms',
        0.5: 'Patient with multiple chronic conditions',
        0.7: 'Complex differential diagnosis case',
        0.9: 'Rare disease with atypical presentation'
      },
      secretary: {
        0.3: 'Schedule a routine appointment',
        0.5: 'Reschedule multiple appointments due to doctor absence',
        0.7: 'Optimize weekly schedule for maximum efficiency',
        0.9: 'Handle emergency scheduling with resource conflicts'
      },
      nurse: {
        0.3: 'Record patient vital signs',
        0.5: 'Manage medication schedule for multiple patients',
        0.7: 'Coordinate care plan with multiple departments',
        0.9: 'Emergency triage and prioritization'
      }
    };
    
    const roleScenarios = scenarios[role] || scenarios.doctor;
    const closestDifficulty = Object.keys(roleScenarios)
      .map(Number)
      .reduce((prev, curr) => 
        Math.abs(curr - difficulty) < Math.abs(prev - difficulty) ? curr : prev
      );
    
    return roleScenarios[closestDifficulty];
  }
  
  /**
   * Select challenge functions based on role config and difficulty
   */
  selectChallengeFunctions(roleConfig, difficulty) {
    const numFunctions = Math.ceil(roleConfig.functionPreferences.length * difficulty);
    return roleConfig.functionPreferences.slice(0, numFunctions);
  }
  
  /**
   * Calculate time limit based on difficulty
   */
  calculateTimeLimit(difficulty) {
    // Base time of 60 seconds, reduced by difficulty
    return Math.floor(60000 * (2 - difficulty)); // 60-120 seconds based on difficulty
  }
  
  /**
   * Start continuous improvement background process
   */
  startContinuousImprovement() {
    // Run improvement cycle every hour
    setInterval(async () => {
      try {
        await this.runImprovementCycle();
      } catch (error) {
        console.error('Improvement cycle error:', error);
      }
    }, 60 * 60 * 1000); // 1 hour
    
    console.log('⚡ Continuous improvement cycle started (runs hourly)');
  }
  
  /**
   * Run improvement cycle to synthesize patterns
   */
  async runImprovementCycle() {
    console.log('🔄 Running improvement cycle...');
    
    const context = {
      serviceId: 'self-improving-memory',
      apiKey: this.apiKey,
      operation: 'improvementCycle',
      practiceId: 'global',
      queryType: 'INTERNAL_SERVICE'
    };
    
    // Analyze patterns across all users
    const roles = Object.keys(this.roleConfigs);
    
    for (const role of roles) {
      // Find high-performing patterns for this role
      const topPatterns = await SecureDataAccess.query('agent_memories', {
        [`metrics.${role}_score`]: { $gte: 0.85 },
        'metrics.totalExecutions': { $gte: 5 },
        active: true
      }, {
        limit: 10,
        sort: { [`metrics.${role}_score`]: -1 }
      }, context);
      
      if (topPatterns.length > 0) {
        console.log(`  Found ${topPatterns.length} high-performing patterns for ${role}`);
        
        // Promote to best practices
        for (const pattern of topPatterns) {
          await this.promoteTobestPractice(pattern, role);
        }
      }
      
      // Identify and deactivate poor patterns
      const poorPatterns = await SecureDataAccess.query('agent_memories', {
        'metrics.successRate': { $lt: 0.3 },
        'metrics.totalExecutions': { $gte: 10 },
        active: true
      }, { limit: 10 }, context);
      
      for (const pattern of poorPatterns) {
        pattern.active = false;
        pattern.deactivatedReason = 'Poor performance in improvement cycle';
        await this.updateMemory(pattern);
      }
    }
    
    console.log('✅ Improvement cycle completed');
  }
  
  /**
   * Promote pattern to best practice for role
   */
  async promoteTobestPractice(pattern, role) {
    pattern.metadata = pattern.metadata || {};
    pattern.metadata.bestPractice = true;
    pattern.metadata.promotedAt = new Date();
    pattern.metadata.role = role;
    
    // Boost confidence for best practices
    pattern.metrics.confidenceScore = Math.min(0.95, pattern.metrics.confidenceScore + 0.1);
    
    await this.updateMemory(pattern);
  }
  
  /**
   * Public API Methods
   */
  
  /**
   * Track a user interaction for learning
   */
  async trackInteraction(params) {
    const {
      userId,
      userRole,
      practiceId,
      sessionId,
      query,
      response,
      actionTaken,
      actionResult,
      language,
      processingTime,
      timestamp
    } = params;
    
    // Store interaction in memory using claudeMemoryService format
    const memoryData = {
      practiceId,
      userId,
      message: query || 'No query',
      keywords: query ? query.toLowerCase().split(' ').filter(w => w.length > 3) : [],
      functions: actionTaken ? [actionTaken] : ['chat'],
      tokensUsed: 100, // Estimate
      executionTime: processingTime || 1000
    };
    
    await claudeMemoryService.createMemory(memoryData);
    
    // Also store in our format using SecureDataAccess
    const context = {
      serviceId: 'self-improving-memory',
      operation: 'store-interaction',
      practiceId: practiceId || 'global',
      apiKey: this.apiKey
    };
    
    const interactionMemory = {
      userId,
      userRole,
      practiceId,
      sessionId,
      type: 'interaction',
      query,
      response,
      actionTaken,
      actionResult,
      language,
      processingTime,
      timestamp: timestamp || new Date(),
      metadata: {
        tracked: true,
        learned: false
      }
    };
    
    await SecureDataAccess.insert('agent_memories', interactionMemory, context);
    
    // Analyze pattern
    if (processingTime < 2000 && actionResult) {
      // Fast successful interaction - likely a good pattern
      await this.reinforcePattern({
        userId,
        userRole,
        pattern: query,
        success: true,
        roleScore: 0.8
      });
    }
    
    return { success: true };
  }
  
  /**
   * Collect user feedback on AI responses
   */
  async collectFeedback(params) {
    const {
      userId,
      userRole,
      practiceId,
      sessionId,
      messageId,
      rating,
      feedback,
      improvementSuggestion,
      timestamp
    } = params;
    
    // Store feedback using SecureDataAccess (claudeMemoryService doesn't handle feedback format)
    const context = {
      serviceId: 'self-improving-memory',
      operation: 'store-feedback',
      practiceId: practiceId || 'global',
      apiKey: this.apiKey
    };
    
    const feedbackData = {
      userId,
      userRole,
      practiceId,
      sessionId,
      messageId,
      type: 'feedback',
      rating: rating || null,
      feedback: feedback || null,
      improvementSuggestion: improvementSuggestion || null,
      timestamp: timestamp || new Date(),
      metadata: {
        processed: false
      }
    };
    
    await SecureDataAccess.insert('agent_memories', feedbackData, context);
    
    // Process high-value feedback immediately
    if (rating === 5 || rating === 1) {
      await this.learnFromFeedback({ userId, userRole, practiceId });
    }
    
    return { success: true };
  }
  
  /**
   * Get personalized context for a user
   */
  async getContext(params) {
    const { userId, userRole, practiceId, query, language } = params;
    
    // Get user's recent patterns using SecureDataAccess
    const context = {
      serviceId: 'self-improving-memory',
      operation: 'get-recent-memories',
      practiceId: practiceId || 'global',
      queryType: 'INTERNAL_SERVICE',
      apiKey: this.apiKey
    };
    
    const recentMemories = await SecureDataAccess.query('agent_memories', {
      userId,
      practiceId
    }, { limit: 10, sort: { timestamp: -1 } }, context) || [];
    
    // Extract patterns and preferences
    const patterns = [];
    const recentTopics = [];
    const preferences = {};
    
    for (const memory of recentMemories) {
      if (memory.type === 'interaction') {
        // Extract topics
        if (memory.query) {
          const words = memory.query.toLowerCase().split(' ');
          const topics = words.filter(w => w.length > 4);
          recentTopics.push(...topics);
        }
        
        // Extract patterns
        if (memory.actionTaken) {
          patterns.push({
            action: memory.actionTaken,
            frequency: 1
          });
        }
      }
      
      if (memory.type === 'feedback' && memory.rating >= 4) {
        // Learn preferences from positive feedback
        preferences.responseStyle = 'detailed';
      }
    }
    
    // Get role-specific optimizations
    const roleConfig = this.roleConfigs[userRole] || this.roleConfigs.doctor;
    
    return {
      patterns: [...new Set(patterns.map(p => p.action))].slice(0, 5),
      recentTopics: [...new Set(recentTopics)].slice(0, 5),
      preferences,
      learningProfile: {
        role: userRole,
        priorities: roleConfig.priorities,
        preferredFunctions: roleConfig.functionPreferences
      },
      roleOptimizations: {
        learningRate: roleConfig.learningRate,
        successMetrics: roleConfig.successMetrics
      }
    };
  }
  
  /**
   * Learn from collected feedback
   */
  async learnFromFeedback(params) {
    const { userId, userRole, practiceId } = params;
    
    // Get unprocessed feedback using SecureDataAccess
    const context = {
      serviceId: 'self-improving-memory',
      operation: 'get-feedback',
      practiceId: practiceId || 'global',
      queryType: 'INTERNAL_SERVICE',
      apiKey: this.apiKey
    };
    
    const feedbacks = await SecureDataAccess.query('agent_memories', {
      userId,
      practiceId,
      type: 'feedback'
    }, { limit: 100 }, context) || [];
    
    for (const feedback of feedbacks) {
      if (!feedback.metadata?.processed) {
        // Process feedback
        if (feedback.rating) {
          const adjustment = (feedback.rating - 3) * 0.1; // -0.2 to +0.2
          
          // Adjust confidence for related patterns
          if (feedback.messageId) {
            await this.adjustPatternConfidence(userId, feedback.messageId, adjustment);
          }
        }
        
        // Mark as processed
        feedback.metadata = feedback.metadata || {};
        feedback.metadata.processed = true;
        await this.updateMemory(feedback);
      }
    }
    
    return { processed: feedbacks.length };
  }
  
  /**
   * Synthesize patterns from interactions
   */
  async synthesizePatterns(params) {
    const { userId, userRole, practiceId } = params;
    
    // Get all interactions using SecureDataAccess
    const context = {
      serviceId: 'self-improving-memory',
      operation: 'get-interactions',
      practiceId: practiceId || 'global',
      queryType: 'INTERNAL_SERVICE',
      apiKey: this.apiKey
    };
    
    const interactions = await SecureDataAccess.query('agent_memories', {
      userId,
      practiceId,
      type: 'interaction'
    }, { limit: 1000 }, context) || [];
    
    // Group by action type
    const actionGroups = {};
    for (const interaction of interactions) {
      if (interaction.actionTaken) {
        if (!actionGroups[interaction.actionTaken]) {
          actionGroups[interaction.actionTaken] = [];
        }
        actionGroups[interaction.actionTaken].push(interaction);
      }
    }
    
    // Find successful patterns
    const patterns = [];
    for (const [action, group] of Object.entries(actionGroups)) {
      if (group.length >= 3) { // Need at least 3 occurrences
        const avgTime = group.reduce((sum, i) => sum + (i.processingTime || 0), 0) / group.length;
        
        patterns.push({
          action,
          frequency: group.length,
          avgProcessingTime: avgTime,
          confidence: Math.min(0.9, group.length * 0.1)
        });
      }
    }
    
    // Store synthesized patterns using SecureDataAccess
    const patternContext = {
      serviceId: 'self-improving-memory',
      operation: 'store-pattern',
      practiceId: practiceId || 'global',
      apiKey: this.apiKey
    };
    
    for (const pattern of patterns) {
      await SecureDataAccess.insert('agent_memories', {
        userId,
        userRole,
        practiceId,
        type: 'pattern',
        pattern: pattern.action,
        metrics: pattern,
        timestamp: new Date()
      }, patternContext);
    }
    
    return { patternsFound: patterns.length };
  }
  
  /**
   * Cross-learn from similar users
   */
  async crossLearn(params) {
    const { userRole, practiceId } = params;
    
    // This would need access to multiple users' data
    // For now, return a placeholder
    console.log(`🔄 Cross-learning for role: ${userRole} in practice: ${practiceId}`);
    
    return { 
      success: true,
      message: 'Cross-learning requires multiple users with same role'
    };
  }
  
  /**
   * Get success metrics for a user
   */
  async getSuccessMetrics(params) {
    const { userId, userRole, practiceId } = params;
    
    // Get all memories using SecureDataAccess
    const context = {
      serviceId: 'self-improving-memory',
      operation: 'get-all-memories',
      practiceId: practiceId || 'global',
      queryType: 'INTERNAL_SERVICE',
      apiKey: this.apiKey
    };
    
    const memories = await SecureDataAccess.query('agent_memories', {
      userId,
      practiceId
    }, { limit: 5000 }, context) || [];
    
    // Calculate metrics
    const interactions = memories.filter(m => m.type === 'interaction');
    const feedbacks = memories.filter(m => m.type === 'feedback' && m.rating);
    
    const totalInteractions = interactions.length;
    const avgResponseTime = interactions.reduce((sum, i) => sum + (i.processingTime || 0), 0) / (totalInteractions || 1);
    
    const ratings = feedbacks.map(f => f.rating).filter(r => r);
    const averageRating = ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0;
    
    const successfulInteractions = interactions.filter(i => i.actionResult).length;
    const successRate = totalInteractions > 0 ? successfulInteractions / totalInteractions : 0;
    
    // Learning velocity (improvement over time)
    const recentInteractions = interactions.slice(-10);
    const olderInteractions = interactions.slice(-20, -10);
    
    let learningVelocity = 0;
    if (recentInteractions.length > 0 && olderInteractions.length > 0) {
      const recentAvgTime = recentInteractions.reduce((sum, i) => sum + (i.processingTime || 0), 0) / recentInteractions.length;
      const olderAvgTime = olderInteractions.reduce((sum, i) => sum + (i.processingTime || 0), 0) / olderInteractions.length;
      
      // Positive velocity means getting faster
      learningVelocity = olderAvgTime > 0 ? (olderAvgTime - recentAvgTime) / olderAvgTime : 0;
    }
    
    return {
      totalInteractions,
      averageRating,
      successRate,
      avgResponseTime,
      learningVelocity,
      feedbackCount: feedbacks.length,
      lastInteraction: interactions[interactions.length - 1]?.timestamp || null
    };
  }
  
  /**
   * Helper method to update memory
   */
  async updateMemory(memory) {
    const context = {
      serviceId: 'self-improving-memory',
      operation: 'update-memory',
      practiceId: memory.practiceId || 'global',
      apiKey: this.apiKey
    };
    
    await SecureDataAccess.update(
      'agent_memories',
      { _id: memory._id },
      memory,
      context
    );
  }
  
  /**
   * Adjust pattern confidence based on feedback
   */
  async adjustPatternConfidence(userId, messageId, adjustment) {
    // Get pattern memories using SecureDataAccess
    const context = {
      serviceId: 'self-improving-memory',
      operation: 'get-patterns',
      practiceId: 'global',
      queryType: 'INTERNAL_SERVICE',
      apiKey: this.apiKey
    };
    
    const patterns = await SecureDataAccess.query('agent_memories', {
      userId,
      type: 'pattern'
    }, { limit: 100 }, context) || [];
    
    for (const pattern of patterns) {
      if (pattern.metrics) {
        pattern.metrics.confidence = Math.max(0, Math.min(1, 
          (pattern.metrics.confidence || 0.5) + adjustment
        ));
        await this.updateMemory(pattern);
      }
    }
  }
}

// Export singleton instance
module.exports = new SelfImprovingMemory();