/**
 * Efficiency Analyzer Service
 * 
 * Analyzes user and practice efficiency, identifies improvement areas,
 * and tracks the impact of implemented optimizations
 * 
 * Features:
 * - User efficiency scoring
 * - Practice-wide efficiency metrics
 * - Waste identification (time, resources, repetition)
 * - Improvement tracking
 * - Comparative analysis
 */

const SecureDataAccess = require('../secureDataAccess');
const serviceAccountManager = require('../serviceAccountManager');
const { learningEventBus } = require('./learningEventBus');
const learningDataAdapter = require('./learningDataAdapter');
const bottleneckDetectorService = require('./bottleneckDetectorService');
const automationOpportunityService = require('./automationOpportunityService');
const workflowPredictorService = require('./workflowPredictorService');
const userMemoryService = require('./userMemoryService');

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
        }

        // Subscribe to relevant events
        learningEventBus.subscribe('workflow.completed', 
            this.handleWorkflowCompleted.bind(this), 
            this.serviceId
        );
        
        learningEventBus.subscribe('error.occurred', 
            this.handleErrorOccurred.bind(this), 
            this.serviceId
        );
        
        learningEventBus.subscribe('automation.implemented', 
            this.handleAutomationImplemented.bind(this), 
            this.serviceId
        );

        // Load benchmarks
        await this.loadBenchmarks();
        
        // Start periodic analysis
        this.startPeriodicAnalysis();
        
        this.initialized = true;
        console.log('✅ EfficiencyAnalyzerService initialized');
    }

    /**
     * Analyze user efficiency
     */
    async analyzeUserEfficiency(userId, timeframe = '7d') {
        try {
            const analysis = {
                userId,
                timeframe,
                overallScore: 0,
                metrics: {},
                wasteAnalysis: {},
                improvements: [],
                comparisons: {},
                trends: {},
                recommendations: [],
                timestamp: new Date()
            };
            
            // Get user activity data
            const activities = await this.getUserActivities(userId, timeframe);
            
            // Calculate time efficiency
            analysis.metrics.timeEfficiency = await this.calculateTimeEfficiency(
                activities
            );
            
            // Calculate task completion rate
            analysis.metrics.completionRate = await this.calculateCompletionRate(
                activities
            );
            
            // Calculate error rate
            analysis.metrics.errorRate = await this.calculateErrorRate(
                userId,
                timeframe
            );
            
            // Calculate automation usage
            analysis.metrics.automationUsage = await this.calculateAutomationUsage(
                activities
            );
            
            // Analyze waste
            analysis.wasteAnalysis = await this.analyzeWaste(activities);
            
            // Calculate overall score
            analysis.overallScore = this.calculateOverallScore(analysis.metrics);
            
            // Get improvement opportunities
            analysis.improvements = await this.identifyImprovements(
                analysis.metrics,
                analysis.wasteAnalysis
            );
            
            // Compare to benchmarks
            analysis.comparisons = await this.compareToBenchmarks(
                analysis.metrics,
                userId
            );
            
            // Analyze trends
            analysis.trends = await this.analyzeTrends(userId, analysis.metrics);
            
            // Generate recommendations
            analysis.recommendations = await this.generateRecommendations(
                analysis
            );
            
            // Cache the analysis
            this.cacheAnalysis(userId, analysis);
            
            // Emit analysis event
            await learningEventBus.emit('efficiency.analyzed', {
                userId,
                score: analysis.overallScore,
                topIssues: analysis.wasteAnalysis,
                timestamp: new Date()
            });
            
            return analysis;
            
        } catch (error) {
            console.error('Error analyzing user efficiency:', error);
            return null;
        }
    }

    /**
     * Analyze practice-wide efficiency
     */
    async analyzeClinicEfficiency(practiceId, timeframe = '30d') {
        try {
            const analysis = {
                practiceId,
                timeframe,
                overallScore: 0,
                departmentScores: {},
                userScores: [],
                systemMetrics: {},
                bottlenecks: [],
                automationOpportunities: [],
                costAnalysis: {},
                comparisons: {},
                trends: {},
                recommendations: [],
                timestamp: new Date()
            };
            
            // Get all practice users
            const users = await this.getClinicUsers(practiceId);
            
            // Analyze each user
            for (const user of users) {
                const userAnalysis = await this.analyzeUserEfficiency(
                    user.id,
                    timeframe
                );
                analysis.userScores.push({
                    userId: user.id,
                    name: user.name,
                    department: user.department,
                    score: userAnalysis.overallScore,
                    topIssues: userAnalysis.wasteAnalysis
                });
            }
            
            // Aggregate by department
            analysis.departmentScores = this.aggregateByDepartment(
                analysis.userScores
            );
            
            // Calculate system-wide metrics
            analysis.systemMetrics = await this.calculateSystemMetrics(
                practiceId,
                timeframe
            );
            
            // Identify bottlenecks
            analysis.bottlenecks = await bottleneckDetectorService
                .analyzeWorkflowBottlenecks(practiceId);
            
            // Find automation opportunities
            analysis.automationOpportunities = await automationOpportunityService
                .discoverOpportunities(practiceId);
            
            // Perform cost analysis
            analysis.costAnalysis = await this.performCostAnalysis(
                analysis.wasteAnalysis,
                analysis.bottlenecks
            );
            
            // Calculate overall practice score
            analysis.overallScore = this.calculateClinicScore(analysis);
            
            // Compare to other practices
            analysis.comparisons = await this.compareToOtherClinics(
                analysis.overallScore,
                practiceId
            );
            
            // Analyze trends
            analysis.trends = await this.analyzeClinicTrends(
                practiceId,
                analysis.systemMetrics
            );
            
            // Generate strategic recommendations
            analysis.recommendations = await this.generateStrategicRecommendations(
                analysis
            );
            
            // Store analysis
            await this.storeClinicAnalysis(analysis);
            
            return analysis;
            
        } catch (error) {
            console.error('Error analyzing practice efficiency:', error);
            return null;
        }
    }

    /**
     * Track improvement impact
     */
    async trackImprovementImpact(improvementId, context) {
        try {
            const improvement = await this.getImprovement(improvementId);
            if (!improvement) return null;
            
            const impact = {
                improvementId,
                implementedAt: improvement.implementedAt,
                measurementPeriod: this.calculateMeasurementPeriod(improvement),
                metrics: {
                    before: {},
                    after: {},
                    change: {},
                    percentageChange: {}
                },
                financialImpact: {},
                userFeedback: [],
                success: false,
                recommendations: []
            };
            
            // Get before metrics
            impact.metrics.before = await this.getMetricsBeforeImprovement(
                improvement,
                context
            );
            
            // Get after metrics
            impact.metrics.after = await this.getMetricsAfterImprovement(
                improvement,
                context
            );
            
            // Calculate changes
            for (const metric in impact.metrics.before) {
                const before = impact.metrics.before[metric];
                const after = impact.metrics.after[metric];
                impact.metrics.change[metric] = after - before;
                impact.metrics.percentageChange[metric] = 
                    ((after - before) / before) * 100;
            }
            
            // Calculate financial impact
            impact.financialImpact = await this.calculateFinancialImpact(
                impact.metrics.change,
                context
            );
            
            // Collect user feedback
            impact.userFeedback = await this.collectUserFeedback(
                improvementId,
                context
            );
            
            // Determine success
            impact.success = this.isImprovementSuccessful(impact);
            
            // Generate recommendations
            impact.recommendations = await this.generateImpactRecommendations(
                impact
            );
            
            // Store impact analysis
            await this.storeImpactAnalysis(impact);
            
            // Emit impact event
            await learningEventBus.emit('improvement.impact.measured', {
                improvementId,
                success: impact.success,
                financialImpact: impact.financialImpact,
                timestamp: new Date()
            });
            
            return impact;
            
        } catch (error) {
            console.error('Error tracking improvement impact:', error);
            return null;
        }
    }

    /**
     * Calculate detailed time efficiency
     */
    async calculateTimeEfficiency(activities) {
        const efficiency = {
            score: 0,
            actualTime: 0,
            optimalTime: 0,
            wastedTime: 0,
            breakdown: {}
        };
        
        for (const activity of activities) {
            const optimal = await this.getOptimalTime(activity.type);
            const actual = activity.duration;
            
            efficiency.actualTime += actual;
            efficiency.optimalTime += optimal;
            efficiency.wastedTime += Math.max(0, actual - optimal);
            
            if (!efficiency.breakdown[activity.type]) {
                efficiency.breakdown[activity.type] = {
                    count: 0,
                    totalActual: 0,
                    totalOptimal: 0,
                    efficiency: 0
                };
            }
            
            const breakdown = efficiency.breakdown[activity.type];
            breakdown.count++;
            breakdown.totalActual += actual;
            breakdown.totalOptimal += optimal;
        }
        
        // Calculate efficiency scores
        efficiency.score = efficiency.optimalTime / 
                          (efficiency.actualTime || 1);
        
        for (const type in efficiency.breakdown) {
            const breakdown = efficiency.breakdown[type];
            breakdown.efficiency = breakdown.totalOptimal / 
                                  (breakdown.totalActual || 1);
        }
        
        return efficiency;
    }

    /**
     * Analyze different types of waste
     */
    async analyzeWaste(activities) {
        const waste = {};
        
        // Time waste analysis
        waste.timeWaste = await this.analyzeTimeWaste(activities);
        
        // Repetition waste analysis
        waste.repetitionWaste = await this.analyzeRepetitionWaste(activities);
        
        // Navigation waste analysis
        waste.navigationWaste = await this.analyzeNavigationWaste(activities);
        
        // Error waste analysis
        waste.errorWaste = await this.analyzeErrorWaste(activities);
        
        // Wait waste analysis
        waste.waitWaste = await this.analyzeWaitWaste(activities);
        
        // Search waste analysis
        waste.searchWaste = await this.analyzeSearchWaste(activities);
        
        // Calculate total waste
        waste.totalWasteTime = Object.values(waste)
            .reduce((sum, w) => sum + (w.totalTime || 0), 0);
        
        waste.totalWasteCost = await this.calculateWasteCost(
            waste.totalWasteTime
        );
        
        // Prioritize waste categories
        waste.priorities = this.prioritizeWaste(waste);
        
        return waste;
    }

    /**
     * Analyze time waste in detail
     */
    async analyzeTimeWaste(activities) {
        const timeWaste = {
            totalTime: 0,
            instances: [],
            patterns: [],
            causes: {}
        };
        
        for (const activity of activities) {
            const optimal = await this.getOptimalTime(activity.type);
            const waste = activity.duration - optimal;
            
            if (waste > optimal * 0.5) { // More than 50% over optimal
                timeWaste.totalTime += waste;
                timeWaste.instances.push({
                    activity: activity.type,
                    actual: activity.duration,
                    optimal,
                    waste,
                    timestamp: activity.timestamp
                });
                
                // Track causes
                const cause = await this.identifyTimeWasteCause(activity);
                timeWaste.causes[cause] = (timeWaste.causes[cause] || 0) + 1;
            }
        }
        
        // Identify patterns
        timeWaste.patterns = await this.findTimeWastePatterns(
            timeWaste.instances
        );
        
        return timeWaste;
    }

    /**
     * Generate efficiency recommendations
     */
    async generateRecommendations(analysis) {
        const recommendations = [];
        
        // Time efficiency recommendations
        if (analysis.metrics.timeEfficiency.score < 0.7) {
            recommendations.push({
                type: 'time_optimization',
                priority: 'high',
                title: 'Optimize Time Usage',
                description: `Your time efficiency is ${(analysis.metrics.timeEfficiency.score * 100).toFixed(1)}%. Consider using keyboard shortcuts and templates.`,
                expectedImpact: '20-30% time savings',
                steps: [
                    'Learn keyboard shortcuts for frequent actions',
                    'Create templates for common workflows',
                    'Use batch operations where possible'
                ]
            });
        }
        
        // Automation recommendations
        if (analysis.metrics.automationUsage < 0.3) {
            recommendations.push({
                type: 'increase_automation',
                priority: 'high',
                title: 'Increase Automation Usage',
                description: 'You\'re only using 30% of available automation features',
                expectedImpact: '40% reduction in manual tasks',
                steps: [
                    'Enable auto-complete for patient forms',
                    'Set up automated appointment reminders',
                    'Use bulk import for patient data'
                ]
            });
        }
        
        // Error reduction recommendations
        if (analysis.metrics.errorRate > 0.1) {
            recommendations.push({
                type: 'error_reduction',
                priority: 'medium',
                title: 'Reduce Error Rate',
                description: `Your error rate is ${(analysis.metrics.errorRate * 100).toFixed(1)}%. Focus on accuracy.`,
                expectedImpact: '15% time savings from fewer corrections',
                steps: [
                    'Double-check entries before submission',
                    'Use validation rules',
                    'Enable confirmation dialogs for critical actions'
                ]
            });
        }
        
        // Waste reduction recommendations
        for (const [wasteType, wasteData] of Object.entries(analysis.wasteAnalysis)) {
            if (wasteData.totalTime > 3600) { // More than 1 hour of waste
                recommendations.push({
                    type: 'waste_reduction',
                    priority: wasteData.totalTime > 7200 ? 'high' : 'medium',
                    title: `Reduce ${this.wasteCategories[wasteType]}`,
                    description: `You're losing ${(wasteData.totalTime / 3600).toFixed(1)} hours to ${wasteType.toLowerCase()}`,
                    expectedImpact: `Save ${(wasteData.totalTime / 3600 * 0.7).toFixed(1)} hours`,
                    steps: await this.getWasteReductionSteps(wasteType, wasteData)
                });
            }
        }
        
        // Workflow optimization recommendations
        const inefficientWorkflows = await this.findInefficientWorkflows(
            analysis.userId
        );
        for (const workflow of inefficientWorkflows) {
            recommendations.push({
                type: 'workflow_optimization',
                priority: 'medium',
                title: `Optimize ${workflow.name} Workflow`,
                description: `This workflow takes ${workflow.excessTime} minutes longer than needed`,
                expectedImpact: `Save ${workflow.excessTime} minutes per execution`,
                steps: workflow.optimizationSteps
            });
        }
        
        // Sort by priority and impact
        recommendations.sort((a, b) => {
            const priorityScore = { high: 3, medium: 2, low: 1 };
            return priorityScore[b.priority] - priorityScore[a.priority];
        });
        
        return recommendations.slice(0, 5); // Top 5 recommendations
    }

    /**
     * Compare user metrics to benchmarks
     */
    async compareToBenchmarks(metrics, userId) {
        const comparisons = {};
        
        // Get user role and department
        const userInfo = await this.getUserInfo(userId);
        
        // Compare to role benchmarks
        const roleBenchmark = this.benchmarks.get(userInfo.role) || {};
        for (const [metric, value] of Object.entries(metrics)) {
            const benchmark = roleBenchmark[metric];
            if (benchmark) {
                comparisons[metric] = {
                    userValue: value,
                    benchmark,
                    percentile: await this.calculatePercentile(
                        metric,
                        value,
                        userInfo.role
                    ),
                    status: value >= benchmark ? 'above' : 'below'
                };
            }
        }
        
        // Compare to department average
        const deptAverage = await this.getDepartmentAverage(
            userInfo.department,
            metrics
        );
        comparisons.departmentComparison = {
            average: deptAverage,
            userPerformance: this.compareToAverage(metrics, deptAverage)
        };
        
        // Compare to top performers
        const topPerformers = await this.getTopPerformers(userInfo.role);
        comparisons.topPerformerGap = this.calculateGapToTop(
            metrics,
            topPerformers
        );
        
        return comparisons;
    }

    /**
     * Periodic analysis runner
     */
    startPeriodicAnalysis() {
        // Daily user analysis
        setInterval(async () => {
            try {
                const users = await this.getActiveUsers();
                for (const user of users) {
                    await this.analyzeUserEfficiency(user.id, '1d');
                }
            } catch (error) {
                console.error('Error in periodic user analysis:', error);
            }
        }, 24 * 60 * 60 * 1000); // Every 24 hours
        
        // Weekly practice analysis
        setInterval(async () => {
            try {
                const practices = await this.getActiveClinics();
                for (const practice of practices) {
                    await this.analyzeClinicEfficiency(practice.id, '7d');
                }
            } catch (error) {
                console.error('Error in periodic practice analysis:', error);
            }
        }, 7 * 24 * 60 * 60 * 1000); // Every 7 days
    }

    /**
     * Event Handlers
     */
    async handleWorkflowCompleted(data) {
        const { userId, workflowId, duration, steps } = data;
        
        // Quick efficiency check
        const optimal = await this.getOptimalTime(workflowId);
        const efficiency = optimal / duration;
        
        if (efficiency < 0.5) {
            // Very inefficient - trigger immediate analysis
            await this.analyzeUserEfficiency(userId, '1d');
        }
    }

    async handleErrorOccurred(data) {
        const { userId, errorType, context } = data;
        
        // Check authentication before operations
        if (!this.serviceToken || !this.serviceToken.apiKey) {
            console.warn('EfficiencyAnalyzer not authenticated - skipping error tracking');
            return;
        }
        
        // Track error waste
        await SecureDataAccess.insert(
            'efficiency_waste_logs',
            {
                userId,
                wasteType: 'ERROR_WASTE',
                errorType,
                timestamp: new Date(),
                context
            },
            {
                serviceId: this.serviceId,
                apiKey: this.serviceToken.apiKey, // Guaranteed to exist now
                operation: 'logErrorWaste',
                practiceId: context.practiceId
            }
        );
    }

    async handleAutomationImplemented(data) {
        const { automationId, practiceId, expectedSavings } = data;
        
        // Start tracking impact
        setTimeout(async () => {
            await this.trackImprovementImpact(automationId, { practiceId });
        }, 7 * 24 * 60 * 60 * 1000); // Check impact after 7 days
    }

    /**
     * Helper Methods
     */
    async loadBenchmarks() {
        try {
            // Check authentication before operations
            if (!this.serviceToken || !this.serviceToken.apiKey) {
                console.warn('EfficiencyAnalyzer not authenticated - cannot load benchmarks');
                return;
            }
            
            const benchmarks = await SecureDataAccess.query(
                'efficiency_benchmarks',
                { active: true },
                {},
                {
                    serviceId: this.serviceId,
                    apiKey: this.serviceToken.apiKey, // Guaranteed to exist now
                    operation: 'loadBenchmarks',
                    practiceId: 'global'
                }
            );
            
            for (const benchmark of benchmarks) {
                this.benchmarks.set(benchmark.role, benchmark.metrics);
            }
            
            console.log(`Loaded ${benchmarks.length} efficiency benchmarks`);
        } catch (error) {
            console.error('Error loading benchmarks:', error);
        }
    }

    calculateOverallScore(metrics) {
        const weights = {
            timeEfficiency: 0.3,
            completionRate: 0.25,
            errorRate: 0.2,
            automationUsage: 0.25
        };
        
        let score = 0;
        score += (metrics.timeEfficiency?.score || 0) * weights.timeEfficiency;
        score += (metrics.completionRate || 0) * weights.completionRate;
        score += (1 - (metrics.errorRate || 0)) * weights.errorRate;
        score += (metrics.automationUsage || 0) * weights.automationUsage;
        
        return Math.min(1, Math.max(0, score));
    }

    cacheAnalysis(userId, analysis) {
        this.metricsCache.set(userId, {
            analysis,
            timestamp: new Date(),
            ttl: 3600000 // 1 hour
        });
        
        // Clean old cache entries
        for (const [key, value] of this.metricsCache.entries()) {
            if (Date.now() - value.timestamp > value.ttl) {
                this.metricsCache.delete(key);
            }
        }
    }

    async getOptimalTime(activityType) {
        const optimalTimes = {
            'patient_registration': 180, // 3 minutes
            'appointment_scheduling': 120, // 2 minutes
            'prescription_writing': 90, // 1.5 minutes
            'note_documentation': 300, // 5 minutes
            'lab_result_review': 120, // 2 minutes
            'referral_creation': 150 // 2.5 minutes
        };
        
        return optimalTimes[activityType] || 120; // Default 2 minutes
    }
}

// Create and export singleton instance
const efficiencyAnalyzerService = new EfficiencyAnalyzerService();

// Initialize on first import
if (!efficiencyAnalyzerService.initialized) {
    efficiencyAnalyzerService.initialize().catch(error => {
        console.error('Failed to initialize EfficiencyAnalyzerService:', error);
    });
}

module.exports = efficiencyAnalyzerService;