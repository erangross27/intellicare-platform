/**
 * Challenger Service - Modular Version
 * 
 * Generates progressively challenging tasks for the learning system.
 * Creates scenarios just beyond current capabilities to drive improvement.
 */

const path = require('path');
const serviceAccountManager = require(path.resolve(__dirname, '../../../backend/services/serviceAccountManager'));
const SecureDataAccess = require(path.resolve(__dirname, '../../../backend/services/secureDataAccess'));

class ChallengerService {
  constructor() {
    this.serviceId = 'challenger-service';
    this.serviceToken = null;
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
      throw error;
    }
    
    try {
      // Load configuration
      this.loadConfig();
      
      // Start challenge generation
      this.startChallengeGeneration();
      
      // Log initialization using SecureDataAccess
      const context = {
        serviceId: this.serviceId,
        operation: 'initialize',
        practiceId: 'global'
      };
      
      await SecureDataAccess.create('audit_logs', {
        action: 'SERVICE_INITIALIZED',
        service: 'challenger-service',
        timestamp: new Date()
      }, context);
      
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
    this.challengeDifficulty = 'adaptive';
    this.challengeIncrement = 0.1;
    this.maxChallengeLevel = 10;
    this.explorationRate = 0.2;
  }

  /**
   * Generate a challenge based on current capability
   */
  async generateChallenge(currentCapability) {
    try {
      // Determine challenge context
      const context = this.extractContext(currentCapability);
      
      // Get current difficulty level
      const currentDifficulty = this.difficultyLevels.get(context) || 5;
      
      // Calculate challenge difficulty (just beyond current capability)
      const challengeDifficulty = Math.min(
        this.maxChallengeLevel,
        currentDifficulty + this.challengeIncrement
      );
      
      // Create challenge
      const challenge = {
        id: `challenge_${Date.now()}_${Math.random()}`,
        context: context,
        type: this.determineChallengeType(currentCapability),
        difficulty: challengeDifficulty,
        description: this.generateChallengeDescription(currentCapability, challengeDifficulty),
        parameters: this.generateChallengeParameters(currentCapability, challengeDifficulty),
        expectedOutcome: this.predictExpectedOutcome(challengeDifficulty),
        createdAt: new Date(),
        status: 'pending'
      };
      
      // Store challenge
      this.challenges.set(challenge.id, challenge);
      
      // Store in database using SecureDataAccess
      const dataContext = {
        serviceId: this.serviceId,
        operation: 'store_challenge',
        practiceId: 'global'
      };
      
      await SecureDataAccess.create('challenges', challenge, dataContext);
      
      // Update statistics
      this.stats.totalChallenges++;
      
      return challenge;
      
    } catch (error) {
      console.error('Error generating challenge:', error);
      throw error;
    }
  }

  /**
   * Extract context from capability
   */
  extractContext(capability) {
    if (capability.functionName) {
      return capability.functionName.split(/[A-Z]/)[0].toLowerCase();
    }
    return 'general';
  }

  /**
   * Determine challenge type based on capability
   */
  determineChallengeType(capability) {
    if (capability.type === 'sequence') return 'workflow_challenge';
    if (capability.type === 'decision') return 'decision_challenge';
    if (capability.type === 'pattern') return 'pattern_challenge';
    return 'general_challenge';
  }

  /**
   * Generate challenge description
   */
  generateChallengeDescription(capability, difficulty) {
    const baseAction = capability.functionName || 'perform task';
    const complexityLevel = difficulty > 7 ? 'complex' : difficulty > 4 ? 'moderate' : 'simple';
    
    return `${complexityLevel} ${baseAction} challenge with difficulty level ${difficulty}`;
  }

  /**
   * Generate challenge parameters
   */
  generateChallengeParameters(capability, difficulty) {
    return {
      baseParameters: capability.parameters || {},
      complexityModifier: difficulty / 10,
      timeConstraint: Math.max(30, 300 - (difficulty * 20)), // seconds
      accuracyThreshold: Math.max(0.5, 0.9 - (difficulty * 0.05)),
      contextVariations: Math.min(5, Math.floor(difficulty / 2))
    };
  }

  /**
   * Predict expected outcome based on difficulty
   */
  predictExpectedOutcome(difficulty) {
    const successProbability = Math.max(0.1, 0.8 - (difficulty * 0.05));
    
    return {
      expectedSuccessRate: successProbability,
      learningOpportunity: difficulty > 6 ? 'high' : difficulty > 3 ? 'medium' : 'low',
      skillDevelopment: this.identifySkillDevelopmentAreas(difficulty)
    };
  }

  /**
   * Identify skill development areas
   */
  identifySkillDevelopmentAreas(difficulty) {
    const areas = [];
    
    if (difficulty > 7) {
      areas.push('advanced_problem_solving', 'complex_decision_making');
    } else if (difficulty > 4) {
      areas.push('pattern_recognition', 'workflow_optimization');
    } else {
      areas.push('basic_execution', 'accuracy_improvement');
    }
    
    return areas;
  }

  /**
   * Adjust difficulty based on performance
   */
  async adjustDifficulty(outcomeData) {
    try {
      const context = outcomeData.context || 'general';
      const success = outcomeData.outcome === 'success';
      const currentDifficulty = this.difficultyLevels.get(context) || 5;
      
      let newDifficulty;
      
      if (success) {
        // Increase difficulty on success
        newDifficulty = Math.min(
          this.maxChallengeLevel,
          currentDifficulty + this.challengeIncrement
        );
        this.stats.successfulChallenges++;
      } else {
        // Decrease difficulty on failure
        newDifficulty = Math.max(
          1,
          currentDifficulty - this.challengeIncrement
        );
        this.stats.failedChallenges++;
      }
      
      this.difficultyLevels.set(context, newDifficulty);
      
      // Update average difficulty
      const difficulties = Array.from(this.difficultyLevels.values());
      this.stats.averageDifficulty = difficulties.reduce((sum, d) => sum + d, 0) / difficulties.length;
      
    } catch (error) {
      console.error('Error adjusting difficulty:', error);
    }
  }

  /**
   * Update performance tracking
   */
  async updatePerformance(validationData) {
    try {
      const context = validationData.context || 'general';
      
      if (!this.performanceHistory.has(context)) {
        this.performanceHistory.set(context, {
          attempts: 0,
          successes: 0,
          failures: 0,
          averageTime: 0,
          improvementRate: 0
        });
      }
      
      const performance = this.performanceHistory.get(context);
      performance.attempts++;
      
      if (validationData.outcome === 'success') {
        performance.successes++;
      } else {
        performance.failures++;
      }
      
      // Update average time
      if (validationData.duration) {
        performance.averageTime = (performance.averageTime * (performance.attempts - 1) + validationData.duration) / performance.attempts;
      }
      
      // Calculate improvement rate
      performance.improvementRate = performance.successes / performance.attempts;
      
    } catch (error) {
      console.error('Error updating performance:', error);
    }
  }

  /**
   * Start challenge generation loop
   */
  startChallengeGeneration() {
    this.challengeInterval = setInterval(async () => {
      await this.generatePeriodicChallenges();
    }, 300000); // Every 5 minutes
  }

  /**
   * Generate periodic challenges
   */
  async generatePeriodicChallenges() {
    try {
      // Generate challenges for different contexts
      const contexts = ['patient', 'billing', 'scheduling', 'reporting'];
      
      for (const context of contexts) {
        const mockCapability = {
          functionName: `${context}Function`,
          type: 'sequence',
          parameters: {}
        };
        
        await this.generateChallenge(mockCapability);
      }
      
    } catch (error) {
      console.error('Error in periodic challenge generation:', error);
    }
  }

  /**
   * Get challenges for context
   */
  async getChallengesForContext(context) {
    const contextChallenges = [];
    
    for (const [id, challenge] of this.challenges) {
      if (challenge.context === context) {
        contextChallenges.push(challenge);
      }
    }
    
    return contextChallenges.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  /**
   * Complete challenge
   */
  async completeChallenge(challengeId, outcome) {
    try {
      const challenge = this.challenges.get(challengeId);
      
      if (!challenge) {
        throw new Error(`Challenge ${challengeId} not found`);
      }
      
      // Update challenge status
      challenge.status = 'completed';
      challenge.outcome = outcome;
      challenge.completedAt = new Date();
      
      // Update difficulty based on outcome
      await this.adjustDifficulty({
        context: challenge.context,
        outcome: outcome.success ? 'success' : 'failure'
      });
      
      // Store completion in database
      const context = {
        serviceId: this.serviceId,
        operation: 'complete_challenge',
        practiceId: 'global'
      };
      
      await SecureDataAccess.update('challenges', 
        { id: challengeId }, 
        { status: 'completed', outcome, completedAt: new Date() }, 
        context
      );
      
      return challenge;
      
    } catch (error) {
      console.error('Error completing challenge:', error);
      throw error;
    }
  }

  /**
   * Get service statistics
   */
  getStats() {
    return {
      ...this.stats,
      activeChallenges: this.challenges.size,
      contextCount: this.difficultyLevels.size,
      averageDifficulty: this.stats.averageDifficulty.toFixed(2)
    };
  }

  /**
   * Get service status
   */
  getStatus() {
    return {
      serviceId: this.serviceId,
      initialized: this.initialized,
      challengesCount: this.challenges.size,
      contextCount: this.difficultyLevels.size,
      stats: this.getStats()
    };
  }

  /**
   * Cleanup and shutdown
   */
  shutdown() {
    if (this.challengeInterval) {
      clearInterval(this.challengeInterval);
    }
    
    console.log('Challenger Service shutdown complete');
  }
}

module.exports = new ChallengerService();