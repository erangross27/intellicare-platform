/**
 * Workflow Predictor Service
 * 
 * Predicts and suggests complete workflows based on partial inputs
 * and learned patterns from user behavior
 * 
 * Features:
 * - Workflow completion prediction
 * - Multi-path workflow suggestions
 * - Success probability estimation
 * - Time estimation for workflows
 * - Dependency chain prediction
 */

const SecureDataAccess = require('../secureDataAccess');
const serviceAccountManager = require('../serviceAccountManager');
const { learningEventBus } = require('./learningEventBus');
const learningDataAdapter = require('./learningDataAdapter');
const sequencePatternEngine = require('./sequencePatternEngine');
const temporalPatternEngine = require('./temporalPatternEngine');
const userMemoryService = require('./userMemoryService');
const proceduralMemoryService = require('./proceduralMemoryService');

class WorkflowPredictorService {
    constructor() {
        this.serviceId = 'workflow-predictor-service';
        this.serviceToken = null;
        this.predictions = new Map(); // Cache recent predictions
        this.workflowTemplates = new Map(); // Learned workflow templates
        this.contextWeights = {
            userHistory: 0.4,
            clinicPatterns: 0.3,
            globalPatterns: 0.2,
            timeContext: 0.1
        };
        this.initialized = false;
    }

    async initialize() {
        if (this.initialized) return;

        // Authenticate service
        try {
            this.serviceToken = await serviceAccountManager.authenticate(this.serviceId);
        } catch (error) {
            console.error(`Failed to authenticate ${this.serviceId}:`, error.message);
        }

        // Subscribe to workflow events
        learningEventBus.subscribe('workflow.started', 
            this.handleWorkflowStarted.bind(this), 
            this.serviceId
        );
        
        learningEventBus.subscribe('workflow.step.completed', 
            this.handleWorkflowStepCompleted.bind(this), 
            this.serviceId
        );
        
        learningEventBus.subscribe('workflow.completed', 
            this.handleWorkflowCompleted.bind(this), 
            this.serviceId
        );

        // Load workflow templates from database
        await this.loadWorkflowTemplates();
        
        this.initialized = true;
        console.log('✅ WorkflowPredictorService initialized');
    }

    /**
     * Predict complete workflow from partial input
     */
    async predictWorkflow(userId, currentSteps, context = {}) {
        try {
            const predictions = [];
            
            // Get user's historical workflows
            const userPatterns = await userMemoryService.getUserPatterns(userId, {
                type: 'workflow',
                limit: 50
            });
            
            // Get time-based predictions
            const timePatterns = await temporalPatternEngine.predictNextActionByTime(
                userId, 
                new Date()
            );
            
            // Get sequence-based predictions
            const sequencePredictions = await sequencePatternEngine.predictNextAction(
                currentSteps
            );
            
            // Get procedural memories that match
            const procedures = await proceduralMemoryService.retrieveProcedure({
                startingSteps: currentSteps,
                practiceId: context.practiceId || 'global',
                userId
            });
            
            // Combine all predictions with weighted scoring
            const combinedPredictions = await this.combinePredictions({
                userPatterns,
                timePatterns,
                sequencePredictions,
                procedures
            }, context);
            
            // Generate complete workflow paths
            for (const prediction of combinedPredictions) {
                const workflow = await this.generateCompleteWorkflow(
                    currentSteps,
                    prediction,
                    context
                );
                predictions.push(workflow);
            }
            
            // Sort by confidence and relevance
            predictions.sort((a, b) => {
                const scoreA = a.confidence * a.relevance;
                const scoreB = b.confidence * b.relevance;
                return scoreB - scoreA;
            });
            
            // Cache the prediction
            this.cachePrediction(userId, currentSteps, predictions);
            
            // Emit prediction event
            await learningEventBus.emit('workflow.predicted', {
                userId,
                currentSteps,
                predictions: predictions.slice(0, 5), // Top 5
                timestamp: new Date()
            });
            
            return predictions.slice(0, 10); // Return top 10 predictions
            
        } catch (error) {
            console.error('Error predicting workflow:', error);
            return [];
        }
    }

    /**
     * Generate complete workflow from partial steps and prediction
     */
    async generateCompleteWorkflow(currentSteps, prediction, context) {
        const workflow = {
            id: `wf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            name: prediction.name || 'Predicted Workflow',
            currentSteps,
            predictedSteps: [],
            totalSteps: 0,
            confidence: prediction.confidence || 0.5,
            relevance: prediction.relevance || 0.5,
            estimatedTime: 0,
            dependencies: [],
            alternativePaths: [],
            metadata: {
                source: prediction.source,
                basedOn: prediction.basedOn,
                context
            }
        };
        
        // Build the predicted steps
        const steps = await this.buildWorkflowSteps(
            currentSteps[currentSteps.length - 1], 
            prediction,
            context
        );
        
        workflow.predictedSteps = steps;
        workflow.totalSteps = currentSteps.length + steps.length;
        
        // Calculate estimated time
        workflow.estimatedTime = await this.calculateWorkflowTime(
            [...currentSteps, ...steps],
            context
        );
        
        // Identify dependencies
        workflow.dependencies = await this.identifyDependencies(
            workflow.predictedSteps
        );
        
        // Generate alternative paths
        workflow.alternativePaths = await this.generateAlternativePaths(
            currentSteps,
            prediction,
            context
        );
        
        // Calculate success probability
        workflow.successProbability = await this.calculateSuccessProbability(
            workflow,
            context
        );
        
        return workflow;
    }

    /**
     * Build detailed workflow steps
     */
    async buildWorkflowSteps(lastStep, prediction, context) {
        const steps = [];
        let currentStep = lastStep;
        
        // Get the template or pattern
        const template = prediction.template || 
                        this.workflowTemplates.get(prediction.templateId);
        
        if (template) {
            // Use template to build steps
            for (const templateStep of template.steps) {
                if (!this.isStepAlreadyCompleted(templateStep, currentStep)) {
                    const step = {
                        id: `step_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                        function: templateStep.function,
                        params: await this.predictStepParams(
                            templateStep,
                            currentStep,
                            context
                        ),
                        description: templateStep.description,
                        estimatedTime: templateStep.avgTime || 30,
                        optional: templateStep.optional || false,
                        dependencies: templateStep.dependencies || [],
                        confidence: templateStep.confidence || prediction.confidence
                    };
                    steps.push(step);
                    currentStep = step;
                }
            }
        } else {
            // Use pattern matching to predict steps
            const predictedSequence = await sequencePatternEngine.extendSequence(
                [lastStep],
                context
            );
            
            for (const pred of predictedSequence) {
                const step = {
                    id: `step_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                    function: pred.function,
                    params: pred.params || {},
                    description: pred.description || `Call ${pred.function}`,
                    estimatedTime: pred.estimatedTime || 30,
                    optional: false,
                    dependencies: [],
                    confidence: pred.confidence || 0.5
                };
                steps.push(step);
            }
        }
        
        return steps;
    }

    /**
     * Predict parameters for a workflow step
     */
    async predictStepParams(templateStep, previousStep, context) {
        const params = {};
        
        // Copy template defaults
        if (templateStep.defaultParams) {
            Object.assign(params, templateStep.defaultParams);
        }
        
        // Infer from previous step output
        if (previousStep && previousStep.output) {
            for (const [key, value] of Object.entries(templateStep.paramMapping || {})) {
                if (previousStep.output[value]) {
                    params[key] = previousStep.output[value];
                }
            }
        }
        
        // Apply context-specific values
        if (context.practiceId && templateStep.requiresClinic) {
            params.practiceId = context.practiceId;
        }
        
        if (context.userId && templateStep.requiresUser) {
            params.userId = context.userId;
        }
        
        // Predict based on user patterns
        const userParams = await this.predictUserSpecificParams(
            context.userId,
            templateStep.function,
            context
        );
        Object.assign(params, userParams);
        
        return params;
    }

    /**
     * Calculate estimated time for workflow
     */
    async calculateWorkflowTime(steps, context) {
        let totalTime = 0;
        
        for (const step of steps) {
            if (step.estimatedTime) {
                totalTime += step.estimatedTime;
            } else {
                // Get average time from historical data
                const avgTime = await this.getAverageStepTime(
                    step.function,
                    context
                );
                totalTime += avgTime;
            }
        }
        
        // Adjust for user speed
        const userSpeedFactor = await this.getUserSpeedFactor(context.userId);
        totalTime *= userSpeedFactor;
        
        // Add transition time between steps
        totalTime += (steps.length - 1) * 5; // 5 seconds between steps
        
        return Math.round(totalTime);
    }

    /**
     * Calculate success probability for workflow
     */
    async calculateSuccessProbability(workflow, context) {
        let probability = 1.0;
        
        // Factor in step confidence
        for (const step of workflow.predictedSteps) {
            probability *= (step.confidence || 0.8);
        }
        
        // Factor in historical success rate
        const historicalSuccess = await this.getHistoricalSuccessRate(
            workflow.name,
            context
        );
        probability *= historicalSuccess;
        
        // Factor in dependency availability
        const dependencyAvailability = await this.checkDependencyAvailability(
            workflow.dependencies
        );
        probability *= dependencyAvailability;
        
        // Factor in user expertise
        const userExpertise = await this.getUserExpertiseLevel(
            context.userId,
            workflow.predictedSteps
        );
        probability *= (0.5 + userExpertise * 0.5); // 50-100% based on expertise
        
        return Math.min(0.95, Math.max(0.05, probability)); // Cap between 5-95%
    }

    /**
     * Generate alternative workflow paths
     */
    async generateAlternativePaths(currentSteps, mainPrediction, context) {
        const alternatives = [];
        
        // Get variations from templates
        const templateVariations = await this.getTemplateVariations(
            mainPrediction.templateId
        );
        
        for (const variation of templateVariations) {
            const altWorkflow = await this.generateCompleteWorkflow(
                currentSteps,
                variation,
                context
            );
            
            // Calculate difference score
            altWorkflow.differenceScore = this.calculatePathDifference(
                mainPrediction,
                variation
            );
            
            alternatives.push({
                name: altWorkflow.name,
                steps: altWorkflow.predictedSteps.length,
                time: altWorkflow.estimatedTime,
                confidence: altWorkflow.confidence,
                differenceScore: altWorkflow.differenceScore,
                advantages: variation.advantages || [],
                disadvantages: variation.disadvantages || []
            });
        }
        
        // Sort by relevance
        alternatives.sort((a, b) => b.confidence - a.confidence);
        
        return alternatives.slice(0, 3); // Top 3 alternatives
    }

    /**
     * Suggest workflow optimizations
     */
    async suggestOptimizations(workflowId, context) {
        try {
            const workflow = await this.getWorkflowById(workflowId, context);
            const optimizations = [];
            
            // Check for redundant steps
            const redundantSteps = await this.findRedundantSteps(workflow);
            if (redundantSteps.length > 0) {
                optimizations.push({
                    type: 'remove_redundant',
                    impact: 'high',
                    steps: redundantSteps,
                    timeSaved: redundantSteps.reduce((sum, s) => sum + s.time, 0),
                    description: `Remove ${redundantSteps.length} redundant steps`
                });
            }
            
            // Check for parallel execution opportunities
            const parallelizable = await this.findParallelizableSteps(workflow);
            if (parallelizable.length > 0) {
                optimizations.push({
                    type: 'parallelize',
                    impact: 'medium',
                    steps: parallelizable,
                    timeSaved: this.calculateParallelTimeSaving(parallelizable),
                    description: 'Execute independent steps in parallel'
                });
            }
            
            // Check for automation opportunities
            const automatable = await this.findAutomatableSteps(workflow);
            if (automatable.length > 0) {
                optimizations.push({
                    type: 'automate',
                    impact: 'high',
                    steps: automatable,
                    timeSaved: automatable.reduce((sum, s) => sum + s.time * 0.9, 0),
                    description: `Automate ${automatable.length} manual steps`
                });
            }
            
            // Check for better alternatives
            const betterAlternatives = await this.findBetterAlternatives(
                workflow,
                context
            );
            for (const alt of betterAlternatives) {
                optimizations.push({
                    type: 'alternative',
                    impact: alt.improvement > 0.3 ? 'high' : 'medium',
                    alternative: alt,
                    timeSaved: workflow.totalTime - alt.estimatedTime,
                    description: `Use ${alt.name} instead`
                });
            }
            
            // Sort by impact and time saved
            optimizations.sort((a, b) => {
                const scoreA = (a.impact === 'high' ? 3 : a.impact === 'medium' ? 2 : 1) * a.timeSaved;
                const scoreB = (b.impact === 'high' ? 3 : b.impact === 'medium' ? 2 : 1) * b.timeSaved;
                return scoreB - scoreA;
            });
            
            return optimizations;
            
        } catch (error) {
            console.error('Error suggesting optimizations:', error);
            return [];
        }
    }

    /**
     * Learn from completed workflows
     */
    async learnFromCompletion(workflowId, actualSteps, outcome, context) {
        try {
            // Compare predicted vs actual
            const prediction = this.predictions.get(workflowId);
            if (!prediction) return;
            
            const accuracy = this.calculatePredictionAccuracy(
                prediction.predictedSteps,
                actualSteps
            );
            
            // Update confidence scores
            if (accuracy > 0.8) {
                // Reinforcement - prediction was good
                await this.reinforcePredictionPattern(prediction, context);
            } else if (accuracy < 0.5) {
                // Learn from mistake
                await this.learnFromMisprediction(
                    prediction,
                    actualSteps,
                    context
                );
            }
            
            // Store new pattern if novel
            if (await this.isNovelPattern(actualSteps, context)) {
                await this.storeNewWorkflowPattern(actualSteps, outcome, context);
            }
            
            // Update workflow templates
            await this.updateWorkflowTemplate(
                prediction.templateId,
                actualSteps,
                outcome
            );
            
            // Emit learning event
            await learningEventBus.emit('workflow.learning.completed', {
                workflowId,
                accuracy,
                outcome,
                improvementsMade: accuracy < 0.8,
                timestamp: new Date()
            });
            
        } catch (error) {
            console.error('Error learning from workflow completion:', error);
        }
    }

    /**
     * Event Handlers
     */
    async handleWorkflowStarted(data) {
        const { userId, workflowId, initialSteps, context } = data;
        
        // Start predicting next steps
        const predictions = await this.predictWorkflow(
            userId,
            initialSteps,
            context
        );
        
        // Store for learning
        this.predictions.set(workflowId, {
            userId,
            initialSteps,
            predictions,
            startTime: new Date()
        });
    }

    async handleWorkflowStepCompleted(data) {
        const { workflowId, step, context } = data;
        
        const prediction = this.predictions.get(workflowId);
        if (!prediction) return;
        
        // Update predictions based on actual step
        prediction.actualSteps = prediction.actualSteps || [];
        prediction.actualSteps.push(step);
        
        // Re-predict remaining steps
        const newPredictions = await this.predictWorkflow(
            prediction.userId,
            prediction.actualSteps,
            context
        );
        
        prediction.predictions = newPredictions;
    }

    async handleWorkflowCompleted(data) {
        const { workflowId, steps, outcome, context } = data;
        
        // Learn from the completion
        await this.learnFromCompletion(workflowId, steps, outcome, context);
        
        // Clean up prediction cache
        this.predictions.delete(workflowId);
    }

    /**
     * Helper Methods
     */
    async loadWorkflowTemplates() {
        try {
            const templates = await SecureDataAccess.query(
                'workflow_templates',
                { active: true },
                { limit: 1000 },
                {
                    serviceId: this.serviceId,
                    apiKey: this.serviceToken?.apiKey,
                    operation: 'loadWorkflowTemplates',
                    practiceId: 'global'
                }
            );
            
            for (const template of templates) {
                this.workflowTemplates.set(template.id, template);
            }
            
            console.log(`Loaded ${templates.length} workflow templates`);
        } catch (error) {
            console.error('Error loading workflow templates:', error);
        }
    }

    combinePredictions(sources, context) {
        const combined = new Map();
        
        // Weight and combine predictions from different sources
        for (const [source, predictions] of Object.entries(sources)) {
            const weight = this.contextWeights[source] || 0.1;
            
            for (const pred of predictions || []) {
                const key = pred.id || pred.name;
                if (!combined.has(key)) {
                    combined.set(key, {
                        ...pred,
                        confidence: 0,
                        sources: []
                    });
                }
                
                const existing = combined.get(key);
                existing.confidence += (pred.confidence || 0.5) * weight;
                existing.sources.push(source);
            }
        }
        
        // Convert to array and normalize confidence
        return Array.from(combined.values()).map(pred => ({
            ...pred,
            confidence: Math.min(1, pred.confidence),
            relevance: this.calculateRelevance(pred, context)
        }));
    }

    calculateRelevance(prediction, context) {
        let relevance = 0.5;
        
        // Time relevance
        if (context.timeOfDay) {
            const timeMatch = prediction.typicalTime === context.timeOfDay;
            relevance += timeMatch ? 0.2 : -0.1;
        }
        
        // Context relevance
        if (prediction.requiredContext) {
            const contextMatch = Object.keys(prediction.requiredContext)
                .every(key => context[key] === prediction.requiredContext[key]);
            relevance += contextMatch ? 0.3 : -0.2;
        }
        
        // Frequency relevance
        if (prediction.frequency) {
            relevance += Math.min(0.2, prediction.frequency / 100);
        }
        
        return Math.min(1, Math.max(0, relevance));
    }

    cachePrediction(userId, steps, predictions) {
        // Handle undefined or empty steps
        if (!steps || !Array.isArray(steps) || steps.length === 0) {
            return; // Skip caching if no valid steps
        }
        
        const key = `${userId}_${steps.map(s => s.function || 'unknown').join('_')}`;
        this.predictions.set(key, {
            predictions,
            timestamp: new Date(),
            ttl: 3600000 // 1 hour
        });
        
        // Clean old predictions
        for (const [k, v] of this.predictions.entries()) {
            if (Date.now() - v.timestamp > v.ttl) {
                this.predictions.delete(k);
            }
        }
    }

    isStepAlreadyCompleted(templateStep, currentStep) {
        if (!currentStep) return false;
        return currentStep.function === templateStep.function &&
               JSON.stringify(currentStep.params) === JSON.stringify(templateStep.params);
    }

    async getAverageStepTime(functionName, context) {
        try {
            const stats = await SecureDataAccess.query(
                'function_stats',
                { 
                    functionName,
                    practiceId: context.practiceId 
                },
                { limit: 1 },
                {
                    serviceId: this.serviceId,
                    operation: 'getAverageStepTime',
                    practiceId: context.practiceId
                }
            );
            
            return stats[0]?.avgExecutionTime || 30; // Default 30 seconds
        } catch (error) {
            return 30;
        }
    }

    async getUserSpeedFactor(userId) {
        try {
            const userStats = await userMemoryService.getUserStats(userId);
            return userStats?.speedFactor || 1.0;
        } catch (error) {
            return 1.0;
        }
    }

    async identifyDependencies(steps) {
        const dependencies = [];
        
        for (let i = 0; i < steps.length; i++) {
            const step = steps[i];
            
            // Check if step output is used by later steps
            for (let j = i + 1; j < steps.length; j++) {
                const laterStep = steps[j];
                
                if (this.stepDependsOn(laterStep, step)) {
                    dependencies.push({
                        from: step.id,
                        to: laterStep.id,
                        type: 'data',
                        required: true
                    });
                }
            }
        }
        
        return dependencies;
    }

    stepDependsOn(step, dependency) {
        // Check if step params reference dependency output
        for (const paramValue of Object.values(step.params)) {
            if (typeof paramValue === 'string' && 
                paramValue.includes(`{{${dependency.id}}`)) {
                return true;
            }
        }
        return false;
    }

    calculatePredictionAccuracy(predicted, actual) {
        if (!predicted || !actual) return 0;
        
        let matches = 0;
        const minLength = Math.min(predicted.length, actual.length);
        
        for (let i = 0; i < minLength; i++) {
            if (predicted[i].function === actual[i].function) {
                matches++;
            }
        }
        
        return matches / Math.max(predicted.length, actual.length);
    }
}

// Create and export singleton instance
const workflowPredictorService = new WorkflowPredictorService();

// Initialize on first import
if (!workflowPredictorService.initialized) {
    workflowPredictorService.initialize().catch(error => {
        console.error('Failed to initialize WorkflowPredictorService:', error);
    });
}

module.exports = workflowPredictorService;