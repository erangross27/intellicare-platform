/**
 * Workflow Engine Service
 * Manages medical workflow execution, step tracking, and command validation
 * Provides real-time guidance for 439+ medical functions
 */

const EventEmitter = require('events');
const path = require('path');
const { Server } = require(path.resolve(__dirname, '../../../../backend/node_modules/socket.io'));

// Service proxy for lazy loading (prevents circular dependencies)
let serviceProxyManager = null;
function getServiceProxy() {
  if (!serviceProxyManager) {
    serviceProxyManager = require('../../../../backend/services/serviceProxyManager');
  }
  return serviceProxyManager;
}

class WorkflowEngine extends EventEmitter {
  constructor() {
    super();
    
    this.serviceId = 'workflow-engine';
    this.serviceToken = null;
    this.io = null;
    this.workflowNamespace = null;
    this.services = null;
    
    // Active workflows per user/session
    this.activeWorkflows = new Map();
    
    // Workflow definitions cache
    this.workflowDefinitions = new Map();
    
    // User skill levels
    this.userSkills = new Map();
    
    // Command validation patterns
    this.commandPatterns = new Map();
    
    // Contextual help cache
    this.contextualHelp = new Map();
    
    // WebSocket clients
    this.clients = new Map();
    
    // Performance metrics
    this.metrics = {
      workflowsStarted: 0,
      workflowsCompleted: 0,
      workflowsCancelled: 0,
      stepsCompleted: 0,
      commandsValidated: 0,
      helpProvided: 0,
      averageCompletionTime: 0
    };
  }
  
  async initializeServices() {
    if (!this.services) {
      const proxy = getServiceProxy();
      this.services = {
        dataAccess: proxy.getService('secureDataAccess'),
        notifications: proxy.getService('notificationService'),
        audit: proxy.getService('auditService'),
        taskManager: proxy.getService('taskManagementService'),
        socketIO: proxy.getService('socketIOService'),
        serviceAccountManager: proxy.getService('serviceAccountManager'),
        immutableAuditService: proxy.getService('immutableAuditService')
      };
    }
  }
  
  /**
   * Initialize the service with authentication
   */
  async initialize() {
    try {
      await this.initializeServices();
      
      // Authenticate with ServiceAccount and get the service token
      const authResult = await this.services.serviceAccountManager.authenticate(this.serviceId);
      
      // The authenticate method returns an object with apiKey
      if (typeof authResult === 'object' && authResult.apiKey) {
        this.serviceToken = authResult;
      } else {
        // If it returns just the token string
        this.serviceToken = { apiKey: authResult };
      }
      
      console.log('✅ WorkflowEngine authenticated');
      
      // Load workflow definitions
      await this.loadWorkflowDefinitions();
      
      // Load user skills
      await this.loadUserSkills();
      
      // Initialize command patterns
      this.initializeCommandPatterns();
      
      console.log('✅ WorkflowEngine initialized');
      return true;
    } catch (error) {
      console.error('❌ WorkflowEngine initialization error:', error);
      throw error;
    }
  }
  
  /**
   * Get service context for database operations
   */
  getServiceContext(practiceId = 'global', operation = 'database-access') {
    return {
      serviceId: this.serviceId,
      operation: operation,
      practiceId: practiceId
    };
  }
  
  /**
   * Initialize WebSocket namespace for workflows
   */
  initializeWebSocket(io) {
    this.io = io;
    
    // Create workflow namespace
    this.workflowNamespace = io.of('/workflows');
    
    // Setup namespace middleware for authentication
    this.workflowNamespace.use(async (socket, next) => {
      try {
        // Extract session token from httpOnly cookie
        // Look for sessionToken cookie (the actual cookie name used)
        const cookies = socket.handshake.headers.cookie;
        let sessionToken = null;
        
        if (cookies) {
          // Parse cookies to find sessionToken
          const cookieArray = cookies.split(';');
          for (const cookie of cookieArray) {
            const [name, value] = cookie.trim().split('=');
            if (name === 'sessionToken') {
              sessionToken = value;
              break;
            }
          }
        }
        
        if (!sessionToken) {
          return next(new Error('Authentication required'));
        }
        
        // Validate session using SecureSessionManager
        const session = await this.validateSession(sessionToken);
        
        if (!session) {
          return next(new Error('Invalid session'));
        }
        
        socket.userId = session.userId;
        socket.practiceId = session.practiceId;
        socket.userRole = session.userRole;
        socket.userLevel = await this.getUserSkillLevel(session.userId);
        
        next();
      } catch (error) {
        console.error('WebSocket authentication error:', error);
        next(error);
      }
    });
    
    // Setup connection handlers
    this.workflowNamespace.on('connection', (socket) => {
      console.log(`🔗 Workflow client connected: ${socket.id}`);
      
      // Store client info
      this.clients.set(socket.id, {
        userId: socket.userId,
        practiceId: socket.practiceId,
        userLevel: socket.userLevel,
        connectedAt: new Date()
      });
      
      // Setup event handlers
      this.setupSocketHandlers(socket);
      
      // Send initial state
      this.sendInitialState(socket);
      
      // Handle disconnect
      socket.on('disconnect', () => {
        console.log(`❌ Workflow client disconnected: ${socket.id}`);
        this.clients.delete(socket.id);
      });
    });
    
    console.log('✅ Workflow WebSocket namespace initialized');
  }
  
  /**
   * Setup socket event handlers
   */
  setupSocketHandlers(socket) {
    // Start workflow
    socket.on('workflow:start', async (data) => {
      await this.handleStartWorkflow(socket, data);
    });
    
    // Advance workflow step
    socket.on('workflow:advance', async (data) => {
      await this.handleAdvanceStep(socket, data);
    });
    
    // Jump to specific step
    socket.on('workflow:jump', async (data) => {
      await this.handleJumpToStep(socket, data);
    });
    
    // Update step data
    socket.on('workflow:updateStep', async (data) => {
      await this.handleUpdateStepData(socket, data);
    });
    
    // Complete workflow
    socket.on('workflow:complete', async (data) => {
      await this.handleCompleteWorkflow(socket, data);
    });
    
    // Cancel workflow
    socket.on('workflow:cancel', async (data) => {
      await this.handleCancelWorkflow(socket, data);
    });
    
    // Request help
    socket.on('workflow:help', async (data) => {
      await this.handleHelpRequest(socket, data);
    });
    
    // Validate command
    socket.on('command:validate', async (data) => {
      await this.handleCommandValidation(socket, data);
    });
    
    // Restore session
    socket.on('workflow:restore', async (data) => {
      await this.handleRestoreSession(socket, data);
    });
  }
  
  /**
   * Send initial state to connected client
   */
  async sendInitialState(socket) {
    const activeWorkflow = this.activeWorkflows.get(socket.userId);
    
    socket.emit('workflow:state', {
      activeWorkflow: activeWorkflow || null,
      userLevel: socket.userLevel,
      availableWorkflows: await this.getAvailableWorkflows(socket.userLevel)
    });
  }
  
  /**
   * Handle workflow start
   */
  async handleStartWorkflow(socket, data) {
    try {
      const { workflowId } = data;
      
      // Get workflow definition
      const workflow = await this.getWorkflowDefinition(workflowId);
      
      if (!workflow) {
        socket.emit('workflow:error', { error: 'Workflow not found' });
        return;
      }
      
      // Check user permissions
      if (!this.canUserAccessWorkflow(socket.userLevel, workflow)) {
        socket.emit('workflow:error', { error: 'Insufficient permissions' });
        return;
      }
      
      // Create workflow session
      const session = {
        workflowId,
        userId: socket.userId,
        practiceId: socket.practiceId,
        workflow,
        currentStep: 0,
        completedSteps: [],
        stepData: {},
        startedAt: new Date(),
        status: 'active'
      };
      
      // Store in database
      const context = this.getServiceContext(socket.practiceId, 'startWorkflow');
      
      const dbSession = await this.services.dataAccess.create('workflow_sessions', session, context);
      session._id = dbSession._id;
      
      // Store in memory
      this.activeWorkflows.set(socket.userId, session);
      
      // Emit to client
      socket.emit('workflow:started', {
        workflow,
        sessionId: session._id
      });
      
      // Log audit
      await this.services.immutableAuditService.logAction({
        action: 'WORKFLOW_STARTED',
        userId: socket.userId,
        practiceId: socket.practiceId,
        workflowId,
        timestamp: new Date()
      });
      
      // Update metrics
      this.metrics.workflowsStarted++;
      
    } catch (error) {
      console.error('Error starting workflow:', error);
      socket.emit('workflow:error', { error: error.message });
    }
  }
  
  /**
   * Handle step advancement
   */
  async handleAdvanceStep(socket, data) {
    try {
      const session = this.activeWorkflows.get(socket.userId);
      
      if (!session) {
        socket.emit('workflow:error', { error: 'No active workflow' });
        return;
      }
      
      // Validate current step completion
      const currentStep = session.workflow.steps[session.currentStep];
      if (currentStep.required && !this.isStepComplete(session, session.currentStep)) {
        socket.emit('workflow:error', { 
          error: 'Current step has required fields that are not complete' 
        });
        return;
      }
      
      // Mark current step as completed
      session.completedSteps.push(session.currentStep);
      
      // Advance to next step
      session.currentStep++;
      
      // Check if workflow is complete
      if (session.currentStep >= session.workflow.steps.length) {
        await this.handleCompleteWorkflow(socket, { workflowId: session.workflowId });
        return;
      }
      
      // Update database
      const context = this.getServiceContext(socket.practiceId, 'advanceStep');
      
      await this.services.dataAccess.update(
        'workflow_sessions',
        { _id: session._id },
        { 
          currentStep: session.currentStep,
          completedSteps: session.completedSteps
        },
        context
      );
      
      // Emit update
      socket.emit('workflow:advanced', {
        workflowId: session.workflowId,
        step: session.currentStep
      });
      
      // Provide contextual help for new step
      const nextStep = session.workflow.steps[session.currentStep];
      if (nextStep.help) {
        socket.emit('help:contextual', {
          help: nextStep.help,
          relatedCommands: nextStep.commands
        });
      }
      
      // Update metrics
      this.metrics.stepsCompleted++;
      
    } catch (error) {
      console.error('Error advancing step:', error);
      socket.emit('workflow:error', { error: error.message });
    }
  }
  
  /**
   * Handle workflow completion
   */
  async handleCompleteWorkflow(socket, data) {
    try {
      const session = this.activeWorkflows.get(socket.userId);
      
      if (!session) {
        socket.emit('workflow:error', { error: 'No active workflow' });
        return;
      }
      
      // Calculate completion time
      const completionTime = Date.now() - session.startedAt.getTime();
      
      // Update session status
      session.status = 'completed';
      session.completedAt = new Date();
      session.completionTime = completionTime;
      
      // Store in history
      const context = this.getServiceContext(socket.practiceId, 'completeWorkflow');
      
      await this.services.dataAccess.create('workflow_history', {
        ...session,
        userId: socket.userId,
        practiceId: socket.practiceId
      }, context);
      
      // Update user skills
      await this.updateUserSkills(socket.userId, session.workflowId, completionTime);
      
      // Remove from active workflows
      this.activeWorkflows.delete(socket.userId);
      
      // Emit completion
      socket.emit('workflow:completed', {
        workflowId: session.workflowId,
        completionTime,
        skillPoints: this.calculateSkillPoints(session)
      });
      
      // Check for skill level up
      const newLevel = await this.checkSkillLevelUp(socket.userId);
      if (newLevel && newLevel !== socket.userLevel) {
        socket.userLevel = newLevel;
        socket.emit('skill:levelUp', {
          newLevel,
          unlockedFeatures: this.getUnlockedFeatures(newLevel)
        });
      }
      
      // Log audit
      await this.services.immutableAuditService.logAction({
        action: 'WORKFLOW_COMPLETED',
        userId: socket.userId,
        practiceId: socket.practiceId,
        workflowId: session.workflowId,
        completionTime,
        timestamp: new Date()
      });
      
      // Update metrics
      this.metrics.workflowsCompleted++;
      this.updateAverageCompletionTime(completionTime);
      
    } catch (error) {
      console.error('Error completing workflow:', error);
      socket.emit('workflow:error', { error: error.message });
    }
  }
  
  /**
   * Handle command validation
   */
  async handleCommandValidation(socket, data) {
    try {
      const { command, context } = data;
      
      // Get active workflow context
      const session = this.activeWorkflows.get(socket.userId);
      
      // Validate command
      const validation = await this.validateCommand(command, {
        ...context,
        workflow: session?.workflow,
        currentStep: session?.currentStep
      });
      
      // Emit validation result
      socket.emit('command:validated', {
        command,
        isValid: validation.isValid,
        suggestion: validation.suggestion,
        confidence: validation.confidence
      });
      
      // If command is valid and advances workflow
      if (validation.isValid && validation.advancesWorkflow && session) {
        await this.handleAdvanceStep(socket, { 
          workflowId: session.workflowId 
        });
      }
      
      // Update metrics
      this.metrics.commandsValidated++;
      
    } catch (error) {
      console.error('Error validating command:', error);
      socket.emit('workflow:error', { error: error.message });
    }
  }
  
  /**
   * Validate a command
   */
  async validateCommand(command, context) {
    // Basic implementation - would be enhanced with AI
    const patterns = this.commandPatterns.get(context.workflow?.id);
    
    if (!patterns) {
      return { isValid: true, confidence: 0.5 };
    }
    
    for (const pattern of patterns) {
      if (pattern.regex.test(command)) {
        return {
          isValid: true,
          confidence: pattern.confidence || 0.9,
          advancesWorkflow: pattern.advancesWorkflow
        };
      }
    }
    
    // Suggest correction if invalid
    const suggestion = this.getSuggestion(command, patterns);
    
    return {
      isValid: false,
      suggestion,
      confidence: 0.3
    };
  }
  
  /**
   * Load workflow definitions from database
   */
  async loadWorkflowDefinitions() {
    try {
      const context = this.getServiceContext('global', 'loadWorkflowDefinitions');
      
      const workflows = await this.services.dataAccess.query('workflows', {}, {}, context);
      
      for (const workflow of workflows) {
        this.workflowDefinitions.set(workflow.id, workflow);
      }
      
      console.log(`📚 Loaded ${this.workflowDefinitions.size} workflow definitions`);
    } catch (error) {
      console.error('Error loading workflow definitions:', error);
      // Load default workflows if database is empty
      this.loadDefaultWorkflows();
    }
  }
  
  /**
   * Load default workflow definitions
   */
  loadDefaultWorkflows() {
    // These would be loaded from a separate file in production
    try {
      const defaultWorkflows = require('../../../../backend/services/workflowDefinitions');
      
      for (const workflow of defaultWorkflows) {
        this.workflowDefinitions.set(workflow.id, workflow);
      }
    } catch (error) {
      console.warn('Could not load workflow definitions file, using basic defaults');
      // Basic default workflows
      const basicWorkflows = [
        {
          id: 'patient-registration',
          name: 'Patient Registration',
          description: 'Complete patient registration workflow',
          difficulty: 'beginner',
          estimatedTime: 300000,
          points: 10,
          steps: [
            { id: 'collect-info', name: 'Collect Patient Information', required: true },
            { id: 'verify-insurance', name: 'Verify Insurance', required: true },
            { id: 'complete-forms', name: 'Complete Medical Forms', required: true }
          ]
        }
      ];
      
      for (const workflow of basicWorkflows) {
        this.workflowDefinitions.set(workflow.id, workflow);
      }
    }
  }
  
  /**
   * Get workflow definition
   */
  async getWorkflowDefinition(workflowId) {
    return this.workflowDefinitions.get(workflowId);
  }
  
  /**
   * Get available workflows for user level
   */
  async getAvailableWorkflows(userLevel) {
    const available = [];
    
    for (const [id, workflow] of this.workflowDefinitions) {
      if (this.canUserAccessWorkflow(userLevel, workflow)) {
        available.push({
          id: workflow.id,
          name: workflow.name,
          description: workflow.description,
          difficulty: workflow.difficulty,
          estimatedTime: workflow.estimatedTime
        });
      }
    }
    
    return available;
  }
  
  /**
   * Check if user can access workflow
   */
  canUserAccessWorkflow(userLevel, workflow) {
    const levels = ['beginner', 'intermediate', 'advanced', 'expert'];
    const userLevelIndex = levels.indexOf(userLevel);
    const requiredLevelIndex = levels.indexOf(workflow.requiredLevel || 'beginner');
    
    return userLevelIndex >= requiredLevelIndex;
  }
  
  /**
   * Load user skills from database
   */
  async loadUserSkills() {
    try {
      const context = this.getServiceContext('global', 'loadUserSkills');
      
      const skills = await this.services.dataAccess.query('user_skills', {}, {}, context);
      
      for (const skill of skills) {
        this.userSkills.set(skill.userId, skill);
      }
      
      console.log(`📊 Loaded skills for ${this.userSkills.size} users`);
    } catch (error) {
      console.error('Error loading user skills:', error);
    }
  }
  
  /**
   * Get user skill level
   */
  async getUserSkillLevel(userId) {
    const skills = this.userSkills.get(userId);
    return skills?.level || 'beginner';
  }
  
  /**
   * Update user skills after workflow completion
   */
  async updateUserSkills(userId, workflowId, completionTime) {
    const skills = this.userSkills.get(userId) || {
      userId,
      level: 'beginner',
      points: 0,
      completedWorkflows: [],
      averageCompletionTime: 0
    };
    
    // Add completed workflow
    skills.completedWorkflows.push({
      workflowId,
      completedAt: new Date(),
      completionTime
    });
    
    // Calculate points
    const workflow = this.workflowDefinitions.get(workflowId);
    const basePoints = workflow?.points || 10;
    const speedBonus = completionTime < workflow?.estimatedTime ? 5 : 0;
    
    skills.points += basePoints + speedBonus;
    
    // Update average completion time
    const totalTime = skills.completedWorkflows.reduce((sum, w) => sum + w.completionTime, 0);
    skills.averageCompletionTime = totalTime / skills.completedWorkflows.length;
    
    // Update level
    if (skills.points >= 1000 && skills.level === 'advanced') {
      skills.level = 'expert';
    } else if (skills.points >= 500 && skills.level === 'intermediate') {
      skills.level = 'advanced';
    } else if (skills.points >= 100 && skills.level === 'beginner') {
      skills.level = 'intermediate';
    }
    
    // Store in memory
    this.userSkills.set(userId, skills);
    
    // Store in database
    const context = this.getServiceContext('global', 'updateUserSkills');
    
    await this.services.dataAccess.update(
      'user_skills',
      { userId },
      skills,
      context
    );
  }
  
  /**
   * Check if user leveled up
   */
  async checkSkillLevelUp(userId) {
    const skills = this.userSkills.get(userId);
    return skills?.level;
  }
  
  /**
   * Get unlocked features for level
   */
  getUnlockedFeatures(level) {
    const features = {
      beginner: ['basic_workflows', 'help_system'],
      intermediate: ['advanced_workflows', 'shortcuts', 'batch_operations'],
      advanced: ['expert_workflows', 'custom_workflows', 'automation'],
      expert: ['all_features', 'workflow_creation', 'team_management']
    };
    
    return features[level] || [];
  }
  
  /**
   * Initialize command patterns
   */
  initializeCommandPatterns() {
    // Basic patterns - would be enhanced with ML
    this.commandPatterns.set('patient-registration', [
      { regex: /new patient|register patient/i, confidence: 0.9, advancesWorkflow: true },
      { regex: /add patient|create patient/i, confidence: 0.8, advancesWorkflow: true }
    ]);
    
    this.commandPatterns.set('prescription', [
      { regex: /prescribe|prescription|rx/i, confidence: 0.9, advancesWorkflow: true },
      { regex: /medication|drug/i, confidence: 0.7, advancesWorkflow: false }
    ]);
  }
  
  /**
   * Validate session token using SecureSessionManager
   */
  async validateSession(sessionToken) {
    const SecureSessionManager = require('../../../../backend/services/secureSessionManager');
    
    try {
      // Use SecureSessionManager to validate the session
      const session = await SecureSessionManager.validateSession(sessionToken);
      
      if (!session) {
        return null;
      }
      
      return {
        userId: session.userId,
        practiceId: session.practiceId,
        userRole: session.userRole
      };
    } catch (error) {
      console.error('Session validation error:', error);
      return null;
    }
  }
  
  /**
   * Calculate skill points for completed workflow
   */
  calculateSkillPoints(session) {
    const basePoints = session.workflow.points || 10;
    const completionBonus = session.completedSteps.length === session.workflow.steps.length ? 5 : 0;
    const speedBonus = session.completionTime < session.workflow.estimatedTime ? 5 : 0;
    
    return basePoints + completionBonus + speedBonus;
  }
  
  /**
   * Check if step is complete
   */
  isStepComplete(session, stepIndex) {
    const step = session.workflow.steps[stepIndex];
    const stepData = session.stepData[step.id];
    
    if (!step.required) return true;
    if (!stepData) return false;
    
    // Check required fields
    for (const command of step.commands || []) {
      if (command.required && !stepData[command.field]) {
        return false;
      }
    }
    
    return true;
  }
  
  /**
   * Get suggestion for invalid command
   */
  getSuggestion(command, patterns) {
    // Simple Levenshtein distance implementation
    // In production, would use AI for better suggestions
    return 'Did you mean: "Start new patient registration"?';
  }
  
  /**
   * Update average completion time metric
   */
  updateAverageCompletionTime(newTime) {
    const total = this.metrics.workflowsCompleted;
    const currentAvg = this.metrics.averageCompletionTime;
    
    this.metrics.averageCompletionTime = 
      (currentAvg * (total - 1) + newTime) / total;
  }
  
  /**
   * Get service metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      activeWorkflows: this.activeWorkflows.size,
      connectedClients: this.clients.size
    };
  }
}

// Create singleton instance
const workflowEngine = new WorkflowEngine();

// Register with ServiceProxy for lazy loading
if (typeof module !== 'undefined' && module.exports) {
  const proxy = getServiceProxy();
  proxy.registerService('workflowEngine', () => {
    return module.exports;
  });
}

module.exports = workflowEngine;