/**
 * Efficiency Analyzer Service - Modular Version
 * 
 * Analyzes user and practice efficiency, identifies improvement areas,
 * and tracks the impact of implemented optimizations
 */

const path = require('path');
const serviceAccountManager = require(path.resolve(__dirname, '../../../backend/services/serviceAccountManager'));
const SecureDataAccess = require(path.resolve(__dirname, '../../../backend/services/secureDataAccess'));

class EfficiencyAnalyzerService {
    constructor() {
        this.serviceId = 'efficiency-analyzer-service';
        this.serviceToken = null;
        this.metricsCache = new Map();
        this.benchmarks = new Map();
        this.efficiencyThresholds = {
            excellent: 0.9,
            good: 0.75,
            average: 0.6,
            poor: 0.4
        };
        this.wasteCategories = {
            TIME_WASTE: 'Unnecessary time spent',
            REPETITION_WASTE: 'Redundant repetitive actions',
            NAVIGATION_WASTE: 'Inefficient navigation patterns',
            ERROR_WASTE: 'Time lost to errors and corrections',
            WAIT_WASTE: 'Idle time waiting for processes',
            SEARCH_WASTE: 'Excessive searching for information'
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
            throw error;
        }

        try {
            // Log initialization using SecureDataAccess
            const context = {
                serviceId: this.serviceId,
                operation: 'initialize',
                practiceId: 'global'
            };

            await SecureDataAccess.create('audit_logs', {
                action: 'SERVICE_INITIALIZED',
                service: 'efficiency-analyzer-service',
                timestamp: new Date()
            }, context);

            this.initialized = true;
            console.log('✅ Efficiency Analyzer Service initialized');
        } catch (error) {
            console.error('❌ Failed to initialize Efficiency Analyzer Service:', error);
            throw error;
        }
    }

    /**
     * Analyze user efficiency
     */
    async analyzeUserEfficiency(userId, practiceId, timeframe = '7d') {
        try {
            const context = {
                serviceId: this.serviceId,
                operation: 'analyze_user_efficiency',
                practiceId: practiceId
            };

            // Get user interactions from database
            const interactions = await SecureDataAccess.query(
                'user_interactions', 
                { userId, practiceId }, 
                { timeframe }, 
                context
            );

            const efficiency = {
                userId,
                practiceId,
                timeframe,
                metrics: this.calculateEfficiencyMetrics(interactions),
                wasteSources: this.identifyWasteSources(interactions),
                recommendations: this.generateRecommendations(interactions),
                score: 0,
                category: 'average'
            };

            efficiency.score = this.calculateOverallEfficiency(efficiency.metrics);
            efficiency.category = this.categorizeEfficiency(efficiency.score);

            // Cache results
            this.metricsCache.set(`${userId}_${timeframe}`, efficiency);

            // Store analysis in database
            await SecureDataAccess.create('efficiency_analysis', efficiency, context);

            return efficiency;

        } catch (error) {
            console.error('Error analyzing user efficiency:', error);
            throw error;
        }
    }

    /**
     * Calculate efficiency metrics
     */
    calculateEfficiencyMetrics(interactions) {
        const metrics = {
            totalTime: 0,
            productiveTime: 0,
            wastedTime: 0,
            taskCompletionRate: 0,
            errorRate: 0,
            averageTaskTime: 0,
            navigationEfficiency: 0,
            multitaskingScore: 0
        };

        if (!interactions || interactions.length === 0) {
            return metrics;
        }

        // Calculate basic metrics
        metrics.totalTime = interactions.reduce((sum, i) => sum + (i.duration || 0), 0);
        metrics.productiveTime = interactions
            .filter(i => i.outcome === 'success')
            .reduce((sum, i) => sum + (i.duration || 0), 0);
        
        metrics.wastedTime = metrics.totalTime - metrics.productiveTime;
        metrics.taskCompletionRate = interactions.filter(i => i.outcome === 'success').length / interactions.length;
        metrics.errorRate = interactions.filter(i => i.outcome === 'failure').length / interactions.length;
        metrics.averageTaskTime = metrics.totalTime / interactions.length;

        return metrics;
    }

    /**
     * Identify waste sources
     */
    identifyWasteSources(interactions) {
        const wasteSources = [];

        // Time waste detection
        const longTasks = interactions.filter(i => (i.duration || 0) > 300000); // > 5 minutes
        if (longTasks.length > 0) {
            wasteSources.push({
                category: 'TIME_WASTE',
                description: `${longTasks.length} tasks took longer than expected`,
                impact: 'medium',
                timeWasted: longTasks.reduce((sum, t) => sum + t.duration, 0) * 0.3
            });
        }

        // Repetition waste
        const repetitiveTasks = this.findRepetitiveTasks(interactions);
        if (repetitiveTasks.length > 0) {
            wasteSources.push({
                category: 'REPETITION_WASTE',
                description: `${repetitiveTasks.length} repetitive task patterns detected`,
                impact: 'high',
                timeWasted: repetitiveTasks.reduce((sum, t) => sum + t.totalTime, 0) * 0.5
            });
        }

        return wasteSources;
    }

    /**
     * Find repetitive tasks
     */
    findRepetitiveTasks(interactions) {
        const taskGroups = new Map();

        for (const interaction of interactions) {
            const key = interaction.functionName || 'unknown';
            if (!taskGroups.has(key)) {
                taskGroups.set(key, []);
            }
            taskGroups.get(key).push(interaction);
        }

        return Array.from(taskGroups.entries())
            .filter(([key, tasks]) => tasks.length >= 5)
            .map(([key, tasks]) => ({
                taskName: key,
                count: tasks.length,
                totalTime: tasks.reduce((sum, t) => sum + (t.duration || 0), 0)
            }));
    }

    /**
     * Generate recommendations
     */
    generateRecommendations(interactions) {
        const recommendations = [];

        // High error rate
        const errorRate = interactions.filter(i => i.outcome === 'failure').length / interactions.length;
        if (errorRate > 0.2) {
            recommendations.push({
                type: 'training',
                priority: 'high',
                description: 'Consider additional training to reduce error rate',
                expectedImprovement: '15-25% time savings'
            });
        }

        // Repetitive tasks
        const repetitiveTasks = this.findRepetitiveTasks(interactions);
        if (repetitiveTasks.length > 0) {
            recommendations.push({
                type: 'automation',
                priority: 'medium',
                description: 'Automate repetitive tasks to save time',
                expectedImprovement: '30-50% time savings on repetitive work'
            });
        }

        return recommendations;
    }

    /**
     * Calculate overall efficiency score
     */
    calculateOverallEfficiency(metrics) {
        let score = 0;

        // Task completion rate (40% weight)
        score += metrics.taskCompletionRate * 40;

        // Error rate (30% weight, inverse)
        score += (1 - metrics.errorRate) * 30;

        // Time efficiency (30% weight)
        const timeEfficiency = metrics.productiveTime / Math.max(metrics.totalTime, 1);
        score += timeEfficiency * 30;

        return Math.round(score);
    }

    /**
     * Categorize efficiency score
     */
    categorizeEfficiency(score) {
        if (score >= 90) return 'excellent';
        if (score >= 75) return 'good';
        if (score >= 60) return 'average';
        return 'poor';
    }

    /**
     * Get service status
     */
    getStatus() {
        return {
            serviceId: this.serviceId,
            initialized: this.initialized,
            cachedAnalysis: this.metricsCache.size,
            benchmarks: this.benchmarks.size
        };
    }

    /**
     * Cleanup and shutdown
     */
    shutdown() {
        this.metricsCache.clear();
        this.benchmarks.clear();
        console.log('Efficiency Analyzer Service shutdown complete');
    }
}

module.exports = new EfficiencyAnalyzerService();