/**
 * Personal Assistant Service
 * 
 * Provides personalized suggestions and proactive help based on user patterns.
 * Acts as an intelligent assistant that learns from each user's behavior.
 */

const userMemoryService = require('./userMemoryService');
const temporalPatternEngine = require('./temporalPatternEngine');
const sequencePatternEngine = require('./sequencePatternEngine');
const { LearningEventBusManager, LEARNING_EVENTS } = require('./learningEventBus');
const { LearningConfigManager } = require('./learningConfigService');
const serviceAccountManager = require('../serviceAccountManager');

class PersonalAssistantService {
  constructor() {
    this.serviceId = 'personal-assistant-service';
    this.eventBus = null;
    this.config = null;
    this.userAssistants = new Map(); // userId -> assistant state
    this.activeSuggestions = new Map(); // userId -> current suggestions
    this.suggestionHistory = new Map(); // userId -> suggestion history
    this.initialized = false;
    this.stats = {
      totalSuggestions: 0,
      acceptedSuggestions: 0,
      rejectedSuggestions: 0,
      proactiveHelps: 0
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
      
      // Initialize dependencies
      await userMemoryService.initialize();
      await temporalPatternEngine.initialize();
      await sequencePatternEngine.initialize();
      
      // Subscribe to events
      this.subscribeToEvents();
      
      // Load configuration
      this.loadConfig();
      
      // Start proactive monitoring
      this.startProactiveMonitoring();
      
      this.initialized = true;
      console.log('✅ Personal Assistant Service initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Personal Assistant Service:', error);
      throw error;
    }
  }

  /**
   * Load configuration
   */
  loadConfig() {
    const userConfig = this.config.getConfig('user');
    this.maxSuggestions = userConfig?.maxSuggestions || 5;
    this.suggestionCooldown = userConfig?.suggestionCooldown || 300000; // 5 minutes
    this.minConfidence = userConfig?.minConfidence || 0.6;
  }

  /**
   * Subscribe to events
   */
  subscribeToEvents() {
    // Listen for user interactions
    this.eventBus.subscribe(LEARNING_EVENTS.INTERACTION_CAPTURED, async (event) => {
      await this.updateUserContext(event.data.userId, event.data);
    });
    
    // Listen for pattern detections
    this.eventBus.subscribe(LEARNING_EVENTS.PATTERN_DETECTED, async (event) => {
      await this.considerPatternSuggestion(event.data);
    });
    
    // Listen for temporal patterns
    this.eventBus.subscribe('temporal.routine.detected', async (event) => {
      await this.handleRoutineDetection(event.data);
    });
  }

  /**
   * Get personalized suggestions for user
   */
  async getPersonalizedSuggestions(userId, context) {
    try {
      // Get or create user assistant
      if (!this.userAssistants.has(userId)) {
        await this.initializeUserAssistant(userId);
      }
      
      const assistant = this.userAssistants.get(userId);
      const suggestions = [];
      
      // Get user preferences
      const preferences = await userMemoryService.getUserPreferences(userId);
      
      // Get suggestions based on different strategies
      if (preferences.suggestionStyle !== 'minimal') {
        // Workflow continuation suggestions
        const workflowSuggestions = await this.getWorkflowSuggestions(userId, context);
        suggestions.push(...workflowSuggestions);
        
        // Time-based suggestions
        const timeSuggestions = await this.getTimeBasedSuggestions(userId, context);
        suggestions.push(...timeSuggestions);
        
        // Context-based suggestions
        const contextSuggestions = await this.getContextBasedSuggestions(userId, context);
        suggestions.push(...contextSuggestions);
        
        // Proactive help suggestions
        if (preferences.suggestionStyle === 'proactive') {
          const proactiveSuggestions = await this.getProactiveSuggestions(userId, context);
          suggestions.push(...proactiveSuggestions);
        }
      }
      
      // Rank and filter suggestions
      const rankedSuggestions = this.rankSuggestions(suggestions, preferences);
      
      // Limit suggestions based on preferences
      const maxCount = preferences.suggestionStyle === 'proactive' ? this.maxSuggestions :
                       preferences.suggestionStyle === 'reactive' ? 3 : 1;
      
      const finalSuggestions = rankedSuggestions.slice(0, maxCount);
      
      // Store active suggestions
      this.activeSuggestions.set(userId, finalSuggestions);
      
      // Update statistics
      this.stats.totalSuggestions += finalSuggestions.length;
      
      return finalSuggestions;
      
    } catch (error) {
      console.error(`Error getting suggestions for user ${userId}:`, error);
      return [];
    }
  }

  /**
   * Predict user intent based on current action
   */
  async predictUserIntent(userId, currentAction) {
    try {
      const predictions = [];
      
      // Get user patterns
      const patterns = await userMemoryService.getUserPatterns(userId);
      
      if (!patterns) return predictions;
      
      // Check sequence patterns for next action
      const sequencePredictions = await sequencePatternEngine.predictNextAction(
        [currentAction]
      );
      
      for (const pred of sequencePredictions) {
        predictions.push({
          type: 'next_action',
          action: pred.action,
          confidence: pred.confidence,
          reason: 'Based on your common workflow patterns'
        });
      }
      
      // Check temporal patterns
      const temporalPredictions = await temporalPatternEngine.predictNextActionByTime(
        userId,
        new Date()
      );
      
      if (temporalPredictions) {
        predictions.push(...temporalPredictions.map(p => ({
          type: 'time_based',
          action: p.functionName,
          confidence: p.confidence,
          reason: p.reason
        })));
      }
      
      // Analyze intent from action name
      const intent = this.analyzeActionIntent(currentAction);
      
      if (intent) {
        predictions.push({
          type: 'intent',
          action: intent.suggestedAction,
          confidence: 0.7,
          reason: `Looks like you're trying to ${intent.description}`
        });
      }
      
      return predictions.sort((a, b) => b.confidence - a.confidence);
      
    } catch (error) {
      console.error(`Error predicting intent for user ${userId}:`, error);
      return [];
    }
  }

  /**
   * Offer proactive help
   */
  async offerProactiveHelp(userId, situation) {
    try {
      const helps = [];
      
      // Check if user needs help based on situation
      if (situation.type === 'stuck') {
        helps.push({
          type: 'guidance',
          title: 'Need help?',
          message: `You seem to be stuck. Would you like me to guide you through ${situation.context}?`,
          actions: [
            { label: 'Yes, help me', action: 'start_guidance' },
            { label: 'No thanks', action: 'dismiss' }
          ]
        });
      }
      
      if (situation.type === 'error') {
        helps.push({
          type: 'error_recovery',
          title: 'Error detected',
          message: `I noticed an error. Here's how to fix it:`,
          steps: await this.getErrorRecoverySteps(situation.error),
          actions: [
            { label: 'Fix automatically', action: 'auto_fix' },
            { label: 'Show me how', action: 'show_steps' }
          ]
        });
      }
      
      if (situation.type === 'inefficiency') {
        helps.push({
          type: 'optimization',
          title: 'Quick tip',
          message: `There's a faster way to do this:`,
          suggestion: await this.getEfficiencyTip(situation),
          actions: [
            { label: 'Show me', action: 'demonstrate' },
            { label: 'Later', action: 'remind_later' }
          ]
        });
      }
      
      if (situation.type === 'new_feature') {
        helps.push({
          type: 'feature_discovery',
          title: 'Did you know?',
          message: `There's a new feature that might help you: ${situation.feature}`,
          actions: [
            { label: 'Learn more', action: 'show_feature' },
            { label: 'Not interested', action: 'dismiss' }
          ]
        });
      }
      
      // Record proactive help
      this.stats.proactiveHelps += helps.length;
      
      // Store in history
      if (!this.suggestionHistory.has(userId)) {
        this.suggestionHistory.set(userId, []);
      }
      
      this.suggestionHistory.get(userId).push({
        timestamp: new Date(),
        situation: situation,
        helps: helps
      });
      
      return helps;
      
    } catch (error) {
      console.error(`Error offering proactive help to user ${userId}:`, error);
      return [];
    }
  }

  /**
   * Initialize user assistant
   */
  async initializeUserAssistant(userId) {
    const assistant = {
      userId: userId,
      state: 'active',
      context: {
        currentWorkflow: null,
        lastAction: null,
        lastSuggestion: null,
        sessionStart: new Date()
      },
      preferences: await userMemoryService.getUserPreferences(userId),
      statistics: await userMemoryService.getUserStatistics(userId),
      lastInteraction: new Date()
    };
    
    this.userAssistants.set(userId, assistant);
  }

  /**
   * Update user context
   */
  async updateUserContext(userId, interaction) {
    if (!this.userAssistants.has(userId)) {
      await this.initializeUserAssistant(userId);
    }
    
    const assistant = this.userAssistants.get(userId);
    
    // Update context
    assistant.context.lastAction = interaction.functionName;
    assistant.lastInteraction = new Date();
    
    // Check if starting new workflow
    const timeSinceLastAction = Date.now() - assistant.lastInteraction;
    if (timeSinceLastAction > 300000) { // 5 minutes
      assistant.context.currentWorkflow = [interaction.functionName];
    } else {
      assistant.context.currentWorkflow = assistant.context.currentWorkflow || [];
      assistant.context.currentWorkflow.push(interaction.functionName);
    }
  }

  /**
   * Get workflow suggestions
   */
  async getWorkflowSuggestions(userId, context) {
    const suggestions = [];
    const assistant = this.userAssistants.get(userId);
    
    if (!assistant?.context.currentWorkflow) return suggestions;
    
    // Get next action predictions
    const predictions = await sequencePatternEngine.predictNextAction(
      assistant.context.currentWorkflow
    );
    
    for (const prediction of predictions.slice(0, 2)) {
      suggestions.push({
        id: `workflow_${Date.now()}_${Math.random()}`,
        type: 'workflow_continuation',
        title: 'Continue workflow',
        description: `Next step: ${prediction.action}`,
        action: prediction.action,
        confidence: prediction.confidence,
        reason: `You often follow this sequence (${Math.round(prediction.confidence * 100)}% confidence)`,
        category: 'workflow'
      });
    }
    
    return suggestions;
  }

  /**
   * Get time-based suggestions
   */
  async getTimeBasedSuggestions(userId, context) {
    const suggestions = [];
    const currentTime = context.currentTime || new Date();
    
    // Get user's typical schedule
    const schedule = await temporalPatternEngine.getUserSchedule(userId);
    
    if (!schedule) return suggestions;
    
    // Check for routine tasks
    if (schedule.dailyRoutines && schedule.dailyRoutines.length > 0) {
      const currentHour = currentTime.getHours();
      
      for (const routine of schedule.dailyRoutines) {
        if (Math.abs(routine.typicalStart - currentHour) <= 1) {
          suggestions.push({
            id: `routine_${Date.now()}_${Math.random()}`,
            type: 'daily_routine',
            title: `${routine.timeOfDay} routine`,
            description: `Start your ${routine.timeOfDay} workflow`,
            action: routine.functions[0],
            confidence: 0.8,
            reason: `You usually do this around ${routine.typicalStart}:00`,
            category: 'routine'
          });
        }
      }
    }
    
    // Get time-based predictions
    const timePredictions = await temporalPatternEngine.predictNextActionByTime(userId, currentTime);
    
    if (timePredictions) {
      for (const pred of timePredictions.slice(0, 1)) {
        suggestions.push({
          id: `time_${Date.now()}_${Math.random()}`,
          type: 'time_suggestion',
          title: 'Common task for this time',
          description: pred.functionName,
          action: pred.functionName,
          confidence: pred.confidence,
          reason: pred.reason,
          category: 'temporal'
        });
      }
    }
    
    return suggestions;
  }

  /**
   * Get context-based suggestions
   */
  async getContextBasedSuggestions(userId, context) {
    const suggestions = [];
    
    // Get user patterns
    const patterns = await userMemoryService.getUserPatterns(userId, {
      type: 'contextual',
      minConfidence: this.minConfidence
    });
    
    if (!patterns) return suggestions;
    
    // Find matching contexts
    for (const pattern of patterns.slice(0, 2)) {
      if (this.contextMatches(pattern.metadata?.context, context)) {
        suggestions.push({
          id: `context_${Date.now()}_${Math.random()}`,
          type: 'context_suggestion',
          title: 'Suggested action',
          description: pattern.pattern[0] || 'Recommended workflow',
          action: pattern.pattern[0],
          confidence: pattern.confidence,
          reason: 'Based on similar context',
          category: 'contextual'
        });
      }
    }
    
    return suggestions;
  }

  /**
   * Get proactive suggestions
   */
  async getProactiveSuggestions(userId, context) {
    const suggestions = [];
    const assistant = this.userAssistants.get(userId);
    
    if (!assistant) return suggestions;
    
    // Check for automation opportunities
    if (assistant.context.currentWorkflow?.length >= 3) {
      const workflowKey = assistant.context.currentWorkflow.join('->');
      
      if (this.isRepetitiveWorkflow(userId, workflowKey)) {
        suggestions.push({
          id: `automation_${Date.now()}_${Math.random()}`,
          type: 'automation_opportunity',
          title: 'Automate this workflow?',
          description: 'This workflow could be automated',
          action: 'create_automation',
          confidence: 0.9,
          reason: "You've done this workflow many times",
          category: 'automation',
          metadata: {
            workflow: assistant.context.currentWorkflow
          }
        });
      }
    }
    
    // Check for shortcuts
    const shortcuts = await this.findShortcuts(userId, context);
    
    for (const shortcut of shortcuts.slice(0, 1)) {
      suggestions.push({
        id: `shortcut_${Date.now()}_${Math.random()}`,
        type: 'shortcut',
        title: 'Quick action',
        description: shortcut.description,
        action: shortcut.action,
        confidence: 0.7,
        reason: shortcut.reason,
        category: 'efficiency'
      });
    }
    
    return suggestions;
  }

  /**
   * Consider pattern for suggestion
   */
  async considerPatternSuggestion(pattern) {
    if (!pattern.userId || pattern.confidence < this.minConfidence) return;
    
    const userId = pattern.userId;
    
    // Check cooldown
    if (this.isInCooldown(userId)) return;
    
    // Create suggestion from pattern
    const suggestion = {
      id: `pattern_${pattern.patternId}`,
      type: 'pattern_based',
      title: 'Recommended action',
      description: `Based on your patterns`,
      action: pattern.sequence?.[0],
      confidence: pattern.confidence,
      reason: 'Frequently used pattern detected',
      category: 'pattern'
    };
    
    // Add to active suggestions
    if (!this.activeSuggestions.has(userId)) {
      this.activeSuggestions.set(userId, []);
    }
    
    this.activeSuggestions.get(userId).push(suggestion);
    
    // Emit suggestion offered event
    await this.eventBus.emit(LEARNING_EVENTS.SUGGESTION_OFFERED, {
      userId: userId,
      suggestion: suggestion
    });
  }

  /**
   * Handle routine detection
   */
  async handleRoutineDetection(data) {
    const { userId, routines } = data;
    
    // Create routine reminders
    for (const routine of routines) {
      const suggestion = {
        id: `routine_reminder_${Date.now()}`,
        type: 'routine_reminder',
        title: `${routine.timeOfDay} routine`,
        description: `Time for your ${routine.timeOfDay} tasks`,
        action: routine.functions[0],
        confidence: 0.9,
        reason: 'Daily routine detected',
        category: 'routine',
        schedule: {
          time: routine.typicalStart,
          frequency: 'daily'
        }
      };
      
      // Store for scheduled delivery
      this.scheduleRoutineReminder(userId, suggestion);
    }
  }

  /**
   * Rank suggestions
   */
  rankSuggestions(suggestions, preferences) {
    return suggestions.sort((a, b) => {
      // Calculate scores
      const scoreA = this.calculateSuggestionScore(a, preferences);
      const scoreB = this.calculateSuggestionScore(b, preferences);
      
      return scoreB - scoreA;
    });
  }

  /**
   * Calculate suggestion score
   */
  calculateSuggestionScore(suggestion, preferences) {
    let score = 0;
    
    // Confidence weight (0-40)
    score += suggestion.confidence * 40;
    
    // Category preference weight (0-30)
    const categoryWeights = {
      workflow: preferences.suggestionStyle === 'proactive' ? 30 : 20,
      routine: 25,
      automation: preferences.automationLevel === 'high' ? 30 : 15,
      temporal: 20,
      contextual: 20,
      efficiency: 25,
      pattern: 15
    };
    
    score += categoryWeights[suggestion.category] || 10;
    
    // Recency weight (0-20)
    if (suggestion.timestamp) {
      const ageMinutes = (Date.now() - suggestion.timestamp) / 60000;
      score += Math.max(0, 20 - ageMinutes / 10);
    }
    
    // User preference alignment (0-10)
    if (preferences.suggestionStyle === 'proactive' && suggestion.type === 'automation_opportunity') {
      score += 10;
    }
    
    return score;
  }

  /**
   * Helper methods
   */
  
  contextMatches(context1, context2) {
    if (!context1 || !context2) return false;
    
    const keys1 = Object.keys(context1);
    const keys2 = Object.keys(context2);
    
    let matches = 0;
    for (const key of keys1) {
      if (context2[key] === context1[key]) matches++;
    }
    
    return matches / keys1.length > 0.7;
  }

  isRepetitiveWorkflow(userId, workflowKey) {
    // Check if workflow has been repeated multiple times
    const history = this.suggestionHistory.get(userId) || [];
    const count = history.filter(h => 
      h.situation?.workflow === workflowKey
    ).length;
    
    return count >= 3;
  }

  async findShortcuts(userId, context) {
    const shortcuts = [];
    
    // Quick actions based on context
    if (context.currentView === 'patient_list') {
      shortcuts.push({
        action: 'quick_search',
        description: 'Press "/" to search',
        reason: 'Keyboard shortcut available'
      });
    }
    
    if (context.multipleItemsSelected) {
      shortcuts.push({
        action: 'batch_action',
        description: 'Process all at once',
        reason: 'Multiple items selected'
      });
    }
    
    return shortcuts;
  }

  isInCooldown(userId) {
    const assistant = this.userAssistants.get(userId);
    
    if (!assistant?.context.lastSuggestion) return false;
    
    const timeSinceLastSuggestion = Date.now() - assistant.context.lastSuggestion;
    return timeSinceLastSuggestion < this.suggestionCooldown;
  }

  analyzeActionIntent(action) {
    const intents = {
      'search': { description: 'find something', suggestedAction: 'advanced_search' },
      'create': { description: 'create a new item', suggestedAction: 'quick_create' },
      'update': { description: 'modify data', suggestedAction: 'bulk_update' },
      'delete': { description: 'remove items', suggestedAction: 'confirm_delete' },
      'schedule': { description: 'set up an appointment', suggestedAction: 'calendar_view' },
      'report': { description: 'generate reports', suggestedAction: 'report_builder' }
    };
    
    for (const [key, intent] of Object.entries(intents)) {
      if (action.toLowerCase().includes(key)) {
        return intent;
      }
    }
    
    return null;
  }

  async getErrorRecoverySteps(error) {
    // Generate recovery steps based on error type
    return [
      'Check your input data',
      'Verify permissions',
      'Try refreshing the page',
      'Contact support if issue persists'
    ];
  }

  async getEfficiencyTip(situation) {
    return `Use batch processing instead of individual actions`;
  }

  scheduleRoutineReminder(userId, suggestion) {
    // Store for scheduled delivery (would integrate with notification system)
    console.log(`Scheduled routine reminder for user ${userId}:`, suggestion);
  }

  /**
   * Start proactive monitoring
   */
  startProactiveMonitoring() {
    this.monitoringInterval = setInterval(async () => {
      await this.checkProactiveOpportunities();
    }, 60000); // Every minute
  }

  /**
   * Check for proactive opportunities
   */
  async checkProactiveOpportunities() {
    try {
      for (const [userId, assistant] of this.userAssistants) {
        // Check for inactive users who might need help
        const timeSinceLastInteraction = Date.now() - assistant.lastInteraction;
        
        if (timeSinceLastInteraction > 180000 && timeSinceLastInteraction < 300000) { // 3-5 minutes
          await this.offerProactiveHelp(userId, {
            type: 'stuck',
            context: 'current task'
          });
        }
        
        // Check for daily routines
        const schedule = await temporalPatternEngine.getUserSchedule(userId);
        
        if (schedule?.dailyRoutines) {
          const currentHour = new Date().getHours();
          
          for (const routine of schedule.dailyRoutines) {
            if (routine.typicalStart === currentHour) {
              await this.offerProactiveHelp(userId, {
                type: 'routine',
                routine: routine
              });
            }
          }
        }
      }
    } catch (error) {
      console.error('Error in proactive monitoring:', error);
    }
  }

  /**
   * Handle suggestion acceptance
   */
  async handleSuggestionAccepted(userId, suggestionId) {
    this.stats.acceptedSuggestions++;
    
    // Reinforce pattern
    const suggestion = this.activeSuggestions.get(userId)?.find(s => s.id === suggestionId);
    
    if (suggestion) {
      await this.eventBus.emit(LEARNING_EVENTS.SUGGESTION_ACCEPTED, {
        userId: userId,
        suggestionId: suggestionId,
        patternId: suggestion.metadata?.patternId
      });
    }
  }

  /**
   * Handle suggestion rejection
   */
  async handleSuggestionRejected(userId, suggestionId) {
    this.stats.rejectedSuggestions++;
    
    // Weaken pattern
    const suggestion = this.activeSuggestions.get(userId)?.find(s => s.id === suggestionId);
    
    if (suggestion) {
      await this.eventBus.emit(LEARNING_EVENTS.SUGGESTION_REJECTED, {
        userId: userId,
        suggestionId: suggestionId,
        patternId: suggestion.metadata?.patternId
      });
    }
  }

  /**
   * Get service statistics
   */
  getStats() {
    return {
      ...this.stats,
      activeUsers: this.userAssistants.size,
      activeSuggestions: Array.from(this.activeSuggestions.values()).flat().length,
      acceptanceRate: this.stats.acceptedSuggestions / 
                     (this.stats.acceptedSuggestions + this.stats.rejectedSuggestions) || 0
    };
  }

  /**
   * Cleanup and shutdown
   */
  shutdown() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }
    
    console.log('Personal Assistant Service shutdown complete');
  }
}

module.exports = new PersonalAssistantService();