/**
 * Challenger Service (R-Zero Learning)
 * 
 * Generates progressively challenging tasks for the learning system.
 * Creates scenarios just beyond current capabilities to drive improvement.
 */

const { LearningEventBusManager, LEARNING_EVENTS } = require('./learningEventBus');
const { LearningConfigManager } = require('./learningConfigService');
const proceduralMemoryService = require('./proceduralMemoryService');

const serviceAccountManager = require('../serviceAccountManager');

class ChallengerService {
  constructor() {
    this.serviceId = 'challenger-service';
    this.eventBus = null;
    this.config = null;
    this.challenges = new Map(); // challengeId -> challenge
    this.difficultyLevels = new Map(); // context -> difficulty
    this.performanceHistory = new Map(); // context -> performance
    this.initialized = false;
    this.stats = {
      totalChallenges: 0,
      successfulChallenges: 0,
      failedChallenges: 0,
      averageDifficulty: 5
    };
  }

  async initialize() {
    if (this.initialized) return;

        // Authenticate service
        try {
            this.serviceToken = await serviceAccountManager.authenticate(this.serviceId);
        } catch (error) {
            console.error(`Failed to authenticate ${this.serviceId}:`, error.message);
        }
    
    try {
      // Get singleton instances
      this.eventBus = LearningEventBusManager.getInstance();
      this.config = LearningConfigManager.getInstance();
      
      // Initialize procedural memory
      await proceduralMemoryService.initialize();
      
      // Subscribe to events
      this.subscribeToEvents();
      
      // Load configuration
      this.loadConfig();
      
      // Start challenge generation
      this.startChallengeGeneration();
      
      this.initialized = true;
      console.log('✅ Challenger Service initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Challenger Service:', error);
      throw error;
    }
  }

  /**
   * Load configuration
   */
  loadConfig() {
    const rzeroConfig = this.config.getParameters('rzero');
    this.challengeDifficulty = rzeroConfig?.challengeDifficulty || 'adaptive';
    this.challengeIncrement = rzeroConfig?.challengeIncrement || 0.1;
    this.maxChallengeLevel = rzeroConfig?.maxChallengeLevel || 10;
    this.explorationRate = rzeroConfig?.explorationRate || 0.2;
  }

  /**
   * Subscribe to events
   */
  subscribeToEvents() {
    // Listen for outcome recordings to adjust difficulty
    this.eventBus.subscribe(LEARNING_EVENTS.OUTCOME_RECORDED, async (event) => {
      await this.adjustDifficulty(event.data);
    });
    
    // Listen for validation results
    this.eventBus.subscribe(LEARNING_EVENTS.LEARNING_VALIDATED, async (event) => {
      await this.updatePerformance(event.data);
    });
  }

  /**
   * Generate a challenge based on current capability
   */
  async generateChallenge(currentCapability) {
    try {
      // Determine challenge context
      const context = this.extractContext(currentCapability);
      
      // Get current difficulty level
      const currentDifficulty = this.getDifficultyLevel(context);
      
      // Generate challenge parameters
      const challengeParams = await this.createChallengeParameters(
        context,
        currentDifficulty,
        currentCapability
      );
      
      // Create challenge
      const challenge = {
        challengeId: `challenge_${Date.now()}_${Math.random()}`,
        type: this.determineChallengeType(currentCapability),
        difficulty: currentDifficulty,
        context: context,
        parameters: challengeParams,
        scenario: await this.generateScenario(challengeParams),
        expectedOutcome: this.defineExpectedOutcome(challengeParams),
        metadata: {
          createdAt: new Date(),
          baseCapability: currentCapability,
          explorationFactor: Math.random() < this.explorationRate
        }
      };
      
      // Store challenge
      this.challenges.set(challenge.challengeId, challenge);
      
      // Emit challenge created event
      await this.eventBus.emit(LEARNING_EVENTS.CHALLENGE_CREATED, challenge);
      
      this.stats.totalChallenges++;
      
      return challenge;
      
    } catch (error) {
      console.error('Error generating challenge:', error);
      throw error;
    }
  }

  /**
   * Adjust difficulty based on performance
   */
  async adjustDifficulty(performance) {
    try {
      const context = performance.context;
      const outcome = performance.outcome;
      
      // Get current difficulty
      let currentDifficulty = this.difficultyLevels.get(this.hashContext(context)) || 5;
      
      // Adjust based on outcome
      if (outcome === 'success') {
        // Increase difficulty
        currentDifficulty = Math.min(
          this.maxChallengeLevel,
          currentDifficulty + this.challengeIncrement
        );
      } else if (outcome === 'failure') {
        // Decrease difficulty
        currentDifficulty = Math.max(
          1,
          currentDifficulty - this.challengeIncrement * 0.5
        );
      }
      // 'partial' outcome keeps difficulty the same
      
      // Store updated difficulty
      this.difficultyLevels.set(this.hashContext(context), currentDifficulty);
      
      // Track performance
      await this.trackPerformance(context, outcome, currentDifficulty);
      
    } catch (error) {
      console.error('Error adjusting difficulty:', error);
    }
  }

  /**
   * Create a scenario for the challenge
   */
  async createScenario(context) {
    try {
      // Get existing procedures as base
      const existingProcedures = await proceduralMemoryService.findSimilarProcedures(
        context.baseSequence || [],
        0.5
      );
      
      // Generate scenario based on context type
      const scenario = {
        description: this.generateScenarioDescription(context),
        initialState: this.defineInitialState(context),
        goals: this.defineGoals(context),
        constraints: this.defineConstraints(context),
        resources: this.defineAvailableResources(context),
        variations: []
      };
      
      // Add variations based on existing procedures
      if (existingProcedures.length > 0) {
        scenario.variations = this.createVariations(existingProcedures, context);
      }
      
      return scenario;
      
    } catch (error) {
      console.error('Error creating scenario:', error);
      return null;
    }
  }

  /**
   * Create challenge parameters
   */
  async createChallengeParameters(context, difficulty, capability) {
    const params = {
      difficulty: difficulty,
      complexity: this.calculateComplexity(difficulty),
      requiredFunctions: await this.selectRequiredFunctions(context, difficulty),
      constraints: this.generateConstraints(difficulty),
      timeLimit: this.calculateTimeLimit(difficulty),
      successCriteria: this.defineSuccessCriteria(context, difficulty)
    };
    
    // Add exploration elements
    if (Math.random() < this.explorationRate) {
      params.explorationElement = this.addExplorationElement(context);
    }
    
    return params;
  }

  /**
   * Generate progressively harder challenges
   */
  async generateProgressiveChallenge(previousChallenge, performance) {
    try {
      // Analyze previous performance
      const analysis = this.analyzePreviousPerformance(previousChallenge, performance);
      
      // Determine next challenge parameters
      const nextParams = {
        ...previousChallenge.parameters,
        difficulty: this.calculateNextDifficulty(analysis),
        complexity: this.increaseComplexity(previousChallenge.parameters.complexity, analysis)
      };
      
      // Add new elements based on performance
      if (analysis.successRate > 0.8) {
        // High success - add new challenges
        nextParams.newElements = this.introduceNewElements(previousChallenge);
      } else if (analysis.successRate < 0.3) {
        // Low success - simplify
        nextParams.simplifications = this.simplifyChal

lenge(previousChallenge);
      }
      
      // Create new challenge
      const challenge = {
        challengeId: `challenge_${Date.now()}_${Math.random()}`,
        type: 'progressive',
        previousChallengeId: previousChallenge.challengeId,
        difficulty: nextParams.difficulty,
        parameters: nextParams,
        scenario: await this.generateScenario(nextParams),
        metadata: {
          createdAt: new Date(),
          progression: analysis,
          iteration: (previousChallenge.metadata?.iteration || 0) + 1
        }
      };
      
      // Store challenge
      this.challenges.set(challenge.challengeId, challenge);
      
      // Emit event
      await this.eventBus.emit(LEARNING_EVENTS.CHALLENGE_CREATED, challenge);
      
      return challenge;
      
    } catch (error) {
      console.error('Error generating progressive challenge:', error);
      throw error;
    }
  }

  /**
   * Generate workflow challenges
   */
  async generateWorkflowChallenge(workflowType, practiceContext) {
    try {
      const challenge = {
        challengeId: `workflow_challenge_${Date.now()}`,
        type: 'workflow',
        workflowType: workflowType,
        context: practiceContext,
        tasks: await this.generateWorkflowTasks(workflowType, practiceContext),
        expectedSequence: await this.defineExpectedWorkflow(workflowType),
        variations: this.generateWorkflowVariations(workflowType),
        metrics: {
          targetTime: this.calculateTargetTime(workflowType),
          targetAccuracy: 0.95,
          targetEfficiency: 0.8
        }
      };
      
      // Store challenge
      this.challenges.set(challenge.challengeId, challenge);
      
      // Emit event
      await this.eventBus.emit(LEARNING_EVENTS.CHALLENGE_CREATED, challenge);
      
      return challenge;
      
    } catch (error) {
      console.error('Error generating workflow challenge:', error);
      throw error;
    }
  }

  /**
   * Generate function mastery challenges
   */
  async generateFunctionMasteryChallenge(functionName, currentProficiency) {
    try {
      // Determine challenge level based on proficiency
      const level = this.calculateMasteryLevel(currentProficiency);
      
      const challenge = {
        challengeId: `function_mastery_${functionName}_${Date.now()}`,
        type: 'function_mastery',
        functionName: functionName,
        level: level,
        scenarios: await this.generateFunctionScenarios(functionName, level),
        edgeCases: this.generateEdgeCases(functionName, level),
        combinationChallenges: await this.generateCombinationChallenges(functionName),
        proficiencyTarget: Math.min(1, currentProficiency + 0.1),
        metadata: {
          currentProficiency: currentProficiency,
          attempts: 0,
          successfulAttempts: 0
        }
      };
      
      // Store challenge
      this.challenges.set(challenge.challengeId, challenge);
      
      // Emit event
      await this.eventBus.emit(LEARNING_EVENTS.CHALLENGE_CREATED, challenge);
      
      return challenge;
      
    } catch (error) {
      console.error('Error generating function mastery challenge:', error);
      throw error;
    }
  }

  /**
   * Update performance metrics
   */
  async updatePerformance(validationData) {
    try {
      const challengeId = validationData.challengeId;
      const challenge = this.challenges.get(challengeId);
      
      if (!challenge) return;
      
      // Update challenge metadata
      challenge.metadata.completed = true;
      challenge.metadata.completedAt = new Date();
      challenge.metadata.outcome = validationData.outcome;
      challenge.metadata.performance = validationData.performance;
      
      // Update statistics
      if (validationData.outcome === 'success') {
        this.stats.successfulChallenges++;
      } else if (validationData.outcome === 'failure') {
        this.stats.failedChallenges++;
      }
      
      // Update performance history
      const contextHash = this.hashContext(challenge.context);
      if (!this.performanceHistory.has(contextHash)) {
        this.performanceHistory.set(contextHash, []);
      }
      
      this.performanceHistory.get(contextHash).push({
        challengeId: challengeId,
        difficulty: challenge.difficulty,
        outcome: validationData.outcome,
        timestamp: new Date(),
        performance: validationData.performance
      });
      
      // Analyze for insights
      await this.analyzePerformanceTrends(contextHash);
      
    } catch (error) {
      console.error('Error updating performance:', error);
    }
  }

  /**
   * Analyze performance trends
   */
  async analyzePerformanceTrends(contextHash) {
    const history = this.performanceHistory.get(contextHash);
    
    if (!history || history.length < 5) return;
    
    // Calculate trends
    const recentHistory = history.slice(-10);
    const successRate = recentHistory.filter(h => h.outcome === 'success').length / recentHistory.length;
    const averageDifficulty = recentHistory.reduce((sum, h) => sum + h.difficulty, 0) / recentHistory.length;
    
    // Detect patterns
    const insights = {
      successRate: successRate,
      averageDifficulty: averageDifficulty,
      trend: this.detectTrend(recentHistory),
      recommendations: []
    };
    
    // Generate recommendations
    if (successRate > 0.8) {
      insights.recommendations.push('Increase challenge difficulty');
    } else if (successRate < 0.3) {
      insights.recommendations.push('Reduce challenge difficulty');
    }
    
    if (insights.trend === 'improving') {
      insights.recommendations.push('Continue current progression');
    } else if (insights.trend === 'declining') {
      insights.recommendations.push('Review recent changes');
    }
    
    return insights;
  }

  /**
   * Helper methods
   */
  
  extractContext(capability) {
    return {
      type: capability.type || 'general',
      domain: capability.domain || 'workflow',
      currentLevel: capability.level || 1,
      skills: capability.skills || [],
      timestamp: new Date()
    };
  }

  getDifficultyLevel(context) {
    const contextHash = this.hashContext(context);
    return this.difficultyLevels.get(contextHash) || 5;
  }

  hashContext(context) {
    return JSON.stringify({
      type: context.type,
      domain: context.domain
    });
  }

  determineChallengeType(capability) {
    if (capability.type) return capability.type;
    
    const types = ['sequence', 'workflow', 'optimization', 'exploration'];
    return types[Math.floor(Math.random() * types.length)];
  }

  defineExpectedOutcome(params) {
    return {
      successCriteria: params.successCriteria,
      acceptableRange: this.calculateAcceptableRange(params.difficulty),
      timeLimit: params.timeLimit
    };
  }

  calculateComplexity(difficulty) {
    return Math.ceil(difficulty / 2);
  }

  async selectRequiredFunctions(context, difficulty) {
    // Select functions based on difficulty
    const functionCount = Math.ceil(difficulty / 2);
    const functions = [];
    
    // Get available functions from context
    const availableFunctions = context.availableFunctions || this.getCommonFunctions();
    
    for (let i = 0; i < Math.min(functionCount, availableFunctions.length); i++) {
      functions.push(availableFunctions[i]);
    }
    
    return functions;
  }

  generateConstraints(difficulty) {
    const constraints = [];
    
    if (difficulty > 3) {
      constraints.push({ type: 'time', value: 300000 }); // 5 minutes
    }
    
    if (difficulty > 5) {
      constraints.push({ type: 'retries', value: 2 });
    }
    
    if (difficulty > 7) {
      constraints.push({ type: 'resources', value: 'limited' });
    }
    
    return constraints;
  }

  calculateTimeLimit(difficulty) {
    return 60000 * (11 - difficulty); // More difficult = less time
  }

  defineSuccessCriteria(context, difficulty) {
    return {
      minAccuracy: 0.5 + (difficulty * 0.05),
      maxErrors: Math.max(1, 10 - difficulty),
      requiredOutcome: 'success'
    };
  }

  addExplorationElement(context) {
    return {
      type: 'exploration',
      description: 'Try a new approach',
      bonus: 0.2
    };
  }

  generateScenarioDescription(context) {
    return `Challenge for ${context.type} at difficulty ${context.difficulty}`;
  }

  defineInitialState(context) {
    return {
      resources: 100,
      time: 0,
      completed: []
    };
  }

  defineGoals(context) {
    return context.goals || ['Complete workflow', 'Optimize performance'];
  }

  defineConstraints(context) {
    return context.constraints || [];
  }

  defineAvailableResources(context) {
    return context.resources || ['standard'];
  }

  createVariations(procedures, context) {
    return procedures.slice(0, 3).map(proc => ({
      procedureId: proc.id,
      modification: this.generateModification(proc, context)
    }));
  }

  generateModification(procedure, context) {
    const modifications = ['add_step', 'remove_step', 'reorder', 'parameterize'];
    return modifications[Math.floor(Math.random() * modifications.length)];
  }

  analyzePreviousPerformance(challenge, performance) {
    return {
      successRate: performance.successCount / performance.totalAttempts || 0,
      averageTime: performance.averageTime || 0,
      errorRate: performance.errorCount / performance.totalAttempts || 0
    };
  }

  calculateNextDifficulty(analysis) {
    if (analysis.successRate > 0.8) {
      return Math.min(10, analysis.currentDifficulty + 1);
    } else if (analysis.successRate < 0.3) {
      return Math.max(1, analysis.currentDifficulty - 1);
    }
    return analysis.currentDifficulty;
  }

  increaseComplexity(currentComplexity, analysis) {
    if (analysis.successRate > 0.7) {
      return currentComplexity + 1;
    }
    return currentComplexity;
  }

  introduceNewElements(challenge) {
    return ['new_function', 'additional_constraint', 'parallel_execution'];
  }

  simplifyChallenge(challenge) {
    return ['remove_constraint', 'increase_time_limit', 'provide_hints'];
  }

  async generateWorkflowTasks(workflowType, context) {
    // Generate tasks based on workflow type
    return [
      { task: 'Initialize', required: true },
      { task: 'Process', required: true },
      { task: 'Validate', required: true },
      { task: 'Complete', required: true }
    ];
  }

  async defineExpectedWorkflow(workflowType) {
    return ['Initialize', 'Process', 'Validate', 'Complete'];
  }

  generateWorkflowVariations(workflowType) {
    return [
      { name: 'parallel', description: 'Execute tasks in parallel' },
      { name: 'conditional', description: 'Add conditional branching' }
    ];
  }

  calculateTargetTime(workflowType) {
    return 300000; // 5 minutes default
  }

  calculateMasteryLevel(proficiency) {
    if (proficiency < 0.3) return 'beginner';
    if (proficiency < 0.6) return 'intermediate';
    if (proficiency < 0.9) return 'advanced';
    return 'expert';
  }

  async generateFunctionScenarios(functionName, level) {
    return [
      { scenario: 'Basic usage', difficulty: 1 },
      { scenario: 'With parameters', difficulty: 2 },
      { scenario: 'Error handling', difficulty: 3 }
    ];
  }

  generateEdgeCases(functionName, level) {
    return [
      { case: 'null input', expected: 'handle gracefully' },
      { case: 'invalid parameters', expected: 'validation error' }
    ];
  }

  async generateCombinationChallenges(functionName) {
    return [
      { combine_with: 'function2', scenario: 'Sequential execution' },
      { combine_with: 'function3', scenario: 'Conditional execution' }
    ];
  }

  calculateAcceptableRange(difficulty) {
    return {
      min: 0.5 + (difficulty * 0.03),
      max: 1.0
    };
  }

  getCommonFunctions() {
    return [
      'createPatient',
      'updatePatient',
      'scheduleAppointment',
      'processPayment',
      'generateReport'
    ];
  }

  trackPerformance(context, outcome, difficulty) {
    // Track performance metrics
    const contextHash = this.hashContext(context);
    
    if (!this.performanceHistory.has(contextHash)) {
      this.performanceHistory.set(contextHash, []);
    }
    
    this.performanceHistory.get(contextHash).push({
      outcome: outcome,
      difficulty: difficulty,
      timestamp: new Date()
    });
  }

  detectTrend(history) {
    if (history.length < 3) return 'stable';
    
    const recent = history.slice(-3);
    const successCount = recent.filter(h => h.outcome === 'success').length;
    
    if (successCount === 3) return 'improving';
    if (successCount === 0) return 'declining';
    return 'stable';
  }

  /**
   * Start challenge generation
   */
  startChallengeGeneration() {
    // Periodically generate new challenges
    this.generationInterval = setInterval(async () => {
      await this.generatePeriodicChallenges();
    }, 300000); // Every 5 minutes
  }

  /**
   * Generate periodic challenges
   */
  async generatePeriodicChallenges() {
    try {
      // Generate challenges for different contexts
      const contexts = this.getActiveContexts();
      
      for (const context of contexts) {
        const capability = await this.assessCurrentCapability(context);
        await this.generateChallenge(capability);
      }
      
    } catch (error) {
      console.error('Error generating periodic challenges:', error);
    }
  }

  getActiveContexts() {
    // Get contexts that have recent activity
    const activeContexts = [];
    
    for (const [hash, history] of this.performanceHistory) {
      const recent = history.filter(h => 
        (Date.now() - new Date(h.timestamp)) < 86400000 // Last 24 hours
      );
      
      if (recent.length > 0) {
        activeContexts.push(hash);
      }
    }
    
    return activeContexts;
  }

  async assessCurrentCapability(contextHash) {
    const history = this.performanceHistory.get(contextHash) || [];
    const recentHistory = history.slice(-5);
    
    return {
      type: 'assessed',
      level: this.difficultyLevels.get(contextHash) || 5,
      successRate: recentHistory.filter(h => h.outcome === 'success').length / recentHistory.length || 0
    };
  }

  /**
   * Get service statistics
   */
  getStats() {
    return {
      ...this.stats,
      activeChallenges: this.challenges.size,
      difficultyLevels: this.difficultyLevels.size,
      performanceContexts: this.performanceHistory.size
    };
  }

  /**
   * Cleanup and shutdown
   */
  shutdown() {
    if (this.generationInterval) {
      clearInterval(this.generationInterval);
    }
    
    console.log('Challenger Service shutdown complete');
  }
}

module.exports = new ChallengerService();