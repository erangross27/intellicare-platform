/**
 * Workflow Definitions Service - DDD Operations Feature
 * Manages medical workflow definitions with step-by-step guidance
 * Provides secure access to workflow templates and execution patterns
 */

const serviceAccountManager = require('../../../backend/services/serviceAccountManager');
const SecureDataAccess = require('../../../backend/services/secureDataAccess');
const AuditLog = require('../../../backend/models/AuditLog');

class WorkflowDefinitionsService {
  constructor() {
    this.serviceToken = null;
    this.initialized = false;
    this.workflowCache = new Map();
    
    // Define workflow categories for organization
    this.categories = {
      onboarding: 'Practice and user onboarding workflows',
      clinical: 'Patient care and medical workflows',
      administrative: 'Administrative and operational workflows',
      compliance: 'Regulatory and compliance workflows',
      training: 'Educational and training workflows'
    };
  }

  async initialize() {
    if (this.initialized) return this;
    
    try {
      // Authenticate service with serviceAccountManager
      this.serviceToken = await serviceAccountManager.authenticate('workflow-definitions-service');
      
      // Load workflow definitions
      await this.loadWorkflowDefinitions();
      
      this.initialized = true;
      
      // Log initialization
      await AuditLog.create({
        action: 'SERVICE_INITIALIZED',
        service: 'workflowDefinitions',
        userId: 'system',
        practiceId: 'global',
        timestamp: new Date()
      });
      
      console.log('✅ Workflow Definitions Service initialized');
      return this;
    } catch (error) {
      console.error('❌ Failed to initialize Workflow Definitions Service:', error);
      throw new Error(`Failed to initialize WorkflowDefinitionsService: ${error.message}`);
    }
  }

  getServiceContext(practiceId = 'global') {
    return {
      serviceId: 'workflow-definitions-service',
      operation: 'workflow-management',
      practiceId: practiceId
    };
  }

  /**
   * Get all workflow definitions
   */
  async getWorkflows(options = {}) {
    await this.initialize();
    
    try {
      const { category, difficulty, requiredLevel, language = 'en' } = options;
      let workflows = Array.from(this.workflowCache.values());
      
      // Apply filters
      if (category) {
        workflows = workflows.filter(w => w.category === category);
      }
      
      if (difficulty) {
        workflows = workflows.filter(w => w.difficulty === difficulty);
      }
      
      if (requiredLevel) {
        workflows = workflows.filter(w => w.requiredLevel === requiredLevel);
      }
      
      // Localize workflow names and descriptions
      const localizedWorkflows = workflows.map(workflow => this.localizeWorkflow(workflow, language));
      
      return {
        workflows: localizedWorkflows,
        categories: this.categories,
        totalCount: localizedWorkflows.length
      };
      
    } catch (error) {
      console.error('Get workflows error:', error);
      throw new Error(`Failed to get workflows: ${error.message}`);
    }
  }

  /**
   * Get specific workflow by ID
   */
  async getWorkflow(workflowId, options = {}) {
    await this.initialize();
    
    try {
      const { language = 'en' } = options;
      const workflow = this.workflowCache.get(workflowId);
      
      if (!workflow) {
        throw new Error(`Workflow not found: ${workflowId}`);
      }
      
      const localizedWorkflow = this.localizeWorkflow(workflow, language);
      
      // Log workflow access
      await AuditLog.create({
        action: 'WORKFLOW_ACCESSED',
        userId: options.userId || 'system',
        practiceId: options.practiceId || 'global',
        details: {
          workflowId,
          workflowName: localizedWorkflow.name,
          category: workflow.category
        },
        timestamp: new Date()
      });
      
      return localizedWorkflow;
      
    } catch (error) {
      console.error('Get workflow error:', error);
      throw new Error(`Failed to get workflow: ${error.message}`);
    }
  }

  /**
   * Get workflows by category
   */
  async getWorkflowsByCategory(category, options = {}) {
    await this.initialize();
    
    try {
      const { language = 'en' } = options;
      const workflows = Array.from(this.workflowCache.values())
        .filter(w => w.category === category);
      
      if (workflows.length === 0) {
        return {
          category,
          workflows: [],
          count: 0
        };
      }
      
      const localizedWorkflows = workflows.map(w => this.localizeWorkflow(w, language));
      
      return {
        category,
        workflows: localizedWorkflows,
        count: localizedWorkflows.length
      };
      
    } catch (error) {
      console.error('Get workflows by category error:', error);
      throw new Error(`Failed to get workflows by category: ${error.message}`);
    }
  }

  /**
   * Search workflows
   */
  async searchWorkflows(query, options = {}) {
    await this.initialize();
    
    try {
      const { language = 'en', limit = 50 } = options;
      const searchTerm = query.toLowerCase();
      
      const matchingWorkflows = Array.from(this.workflowCache.values())
        .filter(workflow => {
          const name = this.getLocalizedText(workflow.name, language).toLowerCase();
          const description = this.getLocalizedText(workflow.description, language).toLowerCase();
          
          return name.includes(searchTerm) || 
                 description.includes(searchTerm) ||
                 workflow.category.includes(searchTerm) ||
                 workflow.steps.some(step => 
                   this.getLocalizedText(step.name, language).toLowerCase().includes(searchTerm)
                 );
        })
        .slice(0, limit);
      
      const localizedResults = matchingWorkflows.map(w => this.localizeWorkflow(w, language));
      
      // Log search activity
      await AuditLog.create({
        action: 'WORKFLOW_SEARCH',
        userId: options.userId || 'system',
        practiceId: options.practiceId || 'global',
        details: {
          query,
          resultsCount: localizedResults.length,
          language
        },
        timestamp: new Date()
      });
      
      return {
        query,
        workflows: localizedResults,
        totalCount: localizedResults.length,
        hasMore: matchingWorkflows.length === limit
      };
      
    } catch (error) {
      console.error('Search workflows error:', error);
      throw new Error(`Failed to search workflows: ${error.message}`);
    }
  }

  /**
   * Get workflow step details
   */
  async getWorkflowStep(workflowId, stepId, options = {}) {
    await this.initialize();
    
    try {
      const { language = 'en' } = options;
      const workflow = this.workflowCache.get(workflowId);
      
      if (!workflow) {
        throw new Error(`Workflow not found: ${workflowId}`);
      }
      
      const step = workflow.steps.find(s => s.id === stepId);
      if (!step) {
        throw new Error(`Step not found: ${stepId}`);
      }
      
      const localizedStep = this.localizeStep(step, language);
      
      return {
        workflowId,
        workflow: {
          id: workflow.id,
          name: this.getLocalizedText(workflow.name, language),
          category: workflow.category
        },
        step: localizedStep
      };
      
    } catch (error) {
      console.error('Get workflow step error:', error);
      throw new Error(`Failed to get workflow step: ${error.message}`);
    }
  }

  /**
   * Validate workflow completion
   */
  async validateWorkflowCompletion(workflowId, completedSteps, options = {}) {
    await this.initialize();
    
    try {
      const workflow = this.workflowCache.get(workflowId);
      if (!workflow) {
        throw new Error(`Workflow not found: ${workflowId}`);
      }
      
      const requiredSteps = workflow.steps.filter(step => step.required);
      const completedStepIds = new Set(completedSteps.map(cs => cs.stepId));
      
      const missingSteps = requiredSteps.filter(step => !completedStepIds.has(step.id));
      const isComplete = missingSteps.length === 0;
      
      const validation = {
        workflowId,
        isComplete,
        completedStepsCount: completedSteps.length,
        totalStepsCount: workflow.steps.length,
        requiredStepsCount: requiredSteps.length,
        completedRequiredSteps: requiredSteps.length - missingSteps.length,
        missingSteps: missingSteps.map(step => ({
          id: step.id,
          name: step.name,
          required: step.required
        })),
        completionPercentage: Math.round((completedSteps.length / workflow.steps.length) * 100)
      };
      
      // Log workflow completion validation
      await AuditLog.create({
        action: 'WORKFLOW_VALIDATION',
        userId: options.userId || 'system',
        practiceId: options.practiceId || 'global',
        details: {
          workflowId,
          isComplete,
          completionPercentage: validation.completionPercentage,
          missingStepsCount: missingSteps.length
        },
        timestamp: new Date()
      });
      
      return validation;
      
    } catch (error) {
      console.error('Validate workflow completion error:', error);
      throw new Error(`Failed to validate workflow completion: ${error.message}`);
    }
  }

  /**
   * Get workflow statistics
   */
  async getWorkflowStatistics(options = {}) {
    await this.initialize();
    
    try {
      const workflows = Array.from(this.workflowCache.values());
      
      const statistics = {
        totalWorkflows: workflows.length,
        categoriesBreakdown: {},
        difficultyBreakdown: {},
        averageStepsPerWorkflow: 0,
        autoStartWorkflows: workflows.filter(w => w.autoStart).length
      };
      
      // Calculate category breakdown
      workflows.forEach(workflow => {
        statistics.categoriesBreakdown[workflow.category] = 
          (statistics.categoriesBreakdown[workflow.category] || 0) + 1;
      });
      
      // Calculate difficulty breakdown
      workflows.forEach(workflow => {
        statistics.difficultyBreakdown[workflow.difficulty] = 
          (statistics.difficultyBreakdown[workflow.difficulty] || 0) + 1;
      });
      
      // Calculate average steps per workflow
      const totalSteps = workflows.reduce((sum, workflow) => sum + workflow.steps.length, 0);
      statistics.averageStepsPerWorkflow = Math.round(totalSteps / workflows.length);
      
      return statistics;
      
    } catch (error) {
      console.error('Get workflow statistics error:', error);
      throw new Error(`Failed to get workflow statistics: ${error.message}`);
    }
  }

  // ========== PRIVATE METHODS ==========

  /**
   * Load workflow definitions from the static data file
   */
  async loadWorkflowDefinitions() {
    try {
      // Import the static workflow definitions
      const workflowDefinitions = require('../../../backend/services/workflowDefinitions_old.js');
      
      // Cache workflows for quick access
      workflowDefinitions.forEach(workflow => {
        this.workflowCache.set(workflow.id, workflow);
      });
      
      console.log(`📋 Loaded ${workflowDefinitions.length} workflow definitions`);
      
    } catch (error) {
      console.error('Failed to load workflow definitions:', error);
      throw error;
    }
  }

  /**
   * Localize workflow for specific language
   */
  localizeWorkflow(workflow, language) {
    return {
      ...workflow,
      name: this.getLocalizedText(workflow.name, language),
      description: this.getLocalizedText(workflow.description, language),
      steps: workflow.steps.map(step => this.localizeStep(step, language))
    };
  }

  /**
   * Localize workflow step for specific language
   */
  localizeStep(step, language) {
    return {
      ...step,
      name: this.getLocalizedText(step.name, language),
      description: this.getLocalizedText(step.description, language),
      help: this.getLocalizedText(step.help, language),
      highlight: this.getLocalizedText(step.highlight, language),
      commands: step.commands ? step.commands.map(command => ({
        ...command,
        template: this.getLocalizedText(command.template, language),
        example: this.getLocalizedText(command.example, language),
        options: command.options ? command.options.map(option => ({
          ...option,
          label: this.getLocalizedText(option.label, language),
          description: this.getLocalizedText(option.description, language)
        })) : undefined
      })) : []
    };
  }

  /**
   * Get localized text for a field that may be a string or object with language keys
   */
  getLocalizedText(text, language) {
    if (!text) return '';
    
    if (typeof text === 'string') {
      return text;
    }
    
    if (typeof text === 'object') {
      return text[language] || text.en || text.he || Object.values(text)[0] || '';
    }
    
    return '';
  }
}

module.exports = new WorkflowDefinitionsService();