/**
 * Bottleneck Detector Service - Modular Version
 * 
 * Analyzes workflow patterns to identify bottlenecks and inefficiencies.
 * Discovers repetitive tasks that are candidates for automation.
 */

const path = require('path');
const serviceAccountManager = require(path.resolve(__dirname, '../../../backend/services/serviceAccountManager'));
const SecureDataAccess = require(path.resolve(__dirname, '../../../backend/services/secureDataAccess'));

class BottleneckDetectorService {
  constructor() {
    this.serviceId = 'bottleneck-detector-service';
    this.serviceToken = null;
    this.eventBus = null;
    this.config = null;
    this.bottlenecks = new Map(); // bottleneckId -> bottleneck data
    this.workflowAnalysis = new Map(); // workflowId -> analysis
    this.clinicBottlenecks = new Map(); // practiceId -> bottlenecks
    this.initialized = false;
    this.stats = {
      totalBottlenecks: 0,
      totalTimeLost: 0,
      automationCandidates: 0
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
      
      // Start periodic analysis
      this.startBottleneckAnalysis();
      
      // Log initialization using SecureDataAccess
      const context = {
        serviceId: this.serviceId,
        operation: 'initialize',
        practiceId: 'global'
      };
      
      await SecureDataAccess.create('audit_logs', {
        action: 'SERVICE_INITIALIZED',
        service: 'bottleneck-detector-service',
        timestamp: new Date()
      }, context);
      
      this.initialized = true;
      console.log('✅ Bottleneck Detector Service initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Bottleneck Detector Service:', error);
      throw error;
    }
  }

  /**
   * Load configuration
   */
  loadConfig() {
    this.minRepetitions = 10;
    this.minTimeSaving = 300000; // 5 minutes
    this.analysisWindow = 7 * 24 * 60 * 60 * 1000; // 7 days
  }

  /**
   * Analyze workflow bottlenecks for a practice
   */
  async analyzeWorkflowBottlenecks(practiceId) {
    try {
      const analysis = {
        practiceId: practiceId,
        analysisId: `analysis_${Date.now()}`,
        timestamp: new Date(),
        bottlenecks: [],
        metrics: {
          totalWorkflows: 0,
          inefficientWorkflows: 0,
          totalTimeLost: 0,
          automationPotential: 0
        }
      };
      
      // Get all user patterns for the practice
      const userPatterns = await this.getClinicUserPatterns(practiceId);
      
      // Analyze each workflow pattern
      for (const pattern of userPatterns) {
        const bottleneck = await this.analyzePattern(pattern, practiceId);
        
        if (bottleneck) {
          analysis.bottlenecks.push(bottleneck);
          analysis.metrics.inefficientWorkflows++;
          analysis.metrics.totalTimeLost += bottleneck.impact.timeLost;
        }
        
        analysis.metrics.totalWorkflows++;
      }
      
      // Calculate automation potential
      analysis.metrics.automationPotential = this.calculateAutomationPotential(analysis.bottlenecks);
      
      // Store analysis using SecureDataAccess
      const context = {
        serviceId: this.serviceId,
        operation: 'store_analysis',
        practiceId: practiceId
      };
      
      await SecureDataAccess.create('bottleneck_analysis', analysis, context);
      
      // Store analysis
      this.workflowAnalysis.set(practiceId, analysis);
      
      // Store individual bottlenecks
      for (const bottleneck of analysis.bottlenecks) {
        this.bottlenecks.set(bottleneck.id, bottleneck);
        
        // Store bottleneck in database
        await SecureDataAccess.create('bottlenecks', bottleneck, context);
      }
      
      // Update practice bottlenecks
      this.clinicBottlenecks.set(practiceId, analysis.bottlenecks);
      
      // Update statistics
      this.updateStatistics(analysis);
      
      return analysis;
      
    } catch (error) {
      console.error(`Error analyzing bottlenecks for practice ${practiceId}:`, error);
      throw error;
    }
  }

  /**
   * Identify repetitive tasks
   */
  async identifyRepetitiveTasks(patterns) {
    const repetitiveTasks = [];
    
    // Group patterns by function sequence
    const taskGroups = new Map();
    
    for (const pattern of patterns) {
      if (pattern.type === 'sequence' && pattern.frequency >= this.minRepetitions) {
        const key = JSON.stringify(pattern.sequence || pattern.pattern);
        
        if (!taskGroups.has(key)) {
          taskGroups.set(key, {
            sequence: pattern.sequence || pattern.pattern,
            occurrences: [],
            totalTime: 0,
            users: new Set()
          });
        }
        
        const group = taskGroups.get(key);
        group.occurrences.push(pattern);
        group.totalTime += pattern.metadata?.averageDuration || 0;
        group.users.add(pattern.userId);
      }
    }
    
    // Identify tasks that are truly repetitive
    for (const [key, group] of taskGroups) {
      if (group.occurrences.length >= this.minRepetitions) {
        repetitiveTasks.push({
          id: `task_${Date.now()}_${Math.random()}`,
          sequence: group.sequence,
          frequency: group.occurrences.length,
          userCount: group.users.size,
          averageTime: group.totalTime / group.occurrences.length,
          totalTimeLost: group.totalTime,
          automationCandidate: true,
          reason: 'High frequency repetitive task'
        });
      }
    }
    
    return repetitiveTasks;
  }

  /**
   * Calculate time loss from bottlenecks
   */
  calculateTimeLoss(bottleneck) {
    const baseTime = bottleneck.optimalTime || 60000; // 1 minute default
    const actualTime = bottleneck.averageTime || 180000; // 3 minutes default
    const frequency = bottleneck.frequency || 1;
    
    const timeLostPerInstance = Math.max(0, actualTime - baseTime);
    const totalTimeLost = timeLostPerInstance * frequency;
    
    return {
      perInstance: timeLostPerInstance,
      total: totalTimeLost,
      daily: totalTimeLost / 7, // Assuming weekly data
      monthly: totalTimeLost * 4.3 / 7
    };
  }

  /**
   * Analyze a specific pattern for bottlenecks
   */
  async analyzePattern(pattern, practiceId) {
    try {
      // Check if pattern represents a bottleneck
      if (!this.isBottleneck(pattern)) {
        return null;
      }
      
      const bottleneck = {
        id: `bottleneck_${Date.now()}_${Math.random()}`,
        practiceId: practiceId,
        type: this.classifyBottleneck(pattern),
        pattern: pattern,
        description: this.describeBottleneck(pattern),
        impact: {
          frequency: pattern.frequency,
          averageTime: pattern.metadata?.averageDuration || 0,
          timeLost: 0,
          affectedUsers: pattern.metadata?.userCount || 1,
          severity: 'medium'
        },
        causes: await this.identifyCauses(pattern),
        solutions: await this.suggestSolutions(pattern),
        automationPotential: this.assessAutomationPotential(pattern),
        priority: 0
      };
      
      // Calculate time loss
      const timeLoss = this.calculateTimeLoss(bottleneck);
      bottleneck.impact.timeLost = timeLoss.total;
      
      // Determine severity
      bottleneck.impact.severity = this.determineSeverity(bottleneck);
      
      // Calculate priority
      bottleneck.priority = this.calculatePriority(bottleneck);
      
      return bottleneck;
      
    } catch (error) {
      console.error('Error analyzing pattern:', error);
      return null;
    }
  }

  /**
   * Check if pattern represents a bottleneck
   */
  isBottleneck(pattern) {
    // High frequency with low confidence indicates inefficiency
    if (pattern.frequency >= this.minRepetitions && pattern.confidence < 0.7) {
      return true;
    }
    
    // Patterns with high error rates
    if (pattern.metadata?.errorRate > 0.2) {
      return true;
    }
    
    // Time-consuming repetitive tasks
    if (pattern.frequency >= 5 && 
        pattern.metadata?.averageDuration > 120000) { // > 2 minutes
      return true;
    }
    
    return false;
  }

  /**
   * Classify bottleneck type
   */
  classifyBottleneck(pattern) {
    if (pattern.metadata?.errorRate > 0.2) {
      return 'error_prone';
    }
    
    if (pattern.frequency >= 20) {
      return 'high_frequency';
    }
    
    if (pattern.metadata?.averageDuration > 300000) { // > 5 minutes
      return 'time_consuming';
    }
    
    if (pattern.metadata?.userCount > 5) {
      return 'widespread';
    }
    
    return 'general';
  }

  /**
   * Describe bottleneck in human-readable form
   */
  describeBottleneck(pattern) {
    const sequence = pattern.sequence || pattern.pattern || [];
    const frequency = pattern.frequency;
    const users = pattern.metadata?.userCount || 1;
    
    if (pattern.type === 'sequence') {
      return `Workflow "${sequence.slice(0, 3).join(' → ')}..." repeated ${frequency} times by ${users} user(s)`;
    } else if (pattern.type === 'temporal') {
      return `Time-based pattern occurring ${frequency} times during ${pattern.metadata?.timeOfDay || 'workday'}`;
    } else {
      return `Repetitive pattern detected ${frequency} times`;
    }
  }

  /**
   * Identify causes of bottleneck
   */
  async identifyCauses(pattern) {
    const causes = [];
    
    // Manual repetition
    if (pattern.frequency >= this.minRepetitions) {
      causes.push({
        type: 'manual_repetition',
        description: 'Task performed manually multiple times',
        evidence: `${pattern.frequency} repetitions detected`
      });
    }
    
    // Lack of automation
    if (pattern.metadata?.automatable !== false) {
      causes.push({
        type: 'no_automation',
        description: 'No automation available for this workflow',
        evidence: 'Workflow can be automated'
      });
    }
    
    // Inefficient process
    if (pattern.confidence < 0.6) {
      causes.push({
        type: 'inefficient_process',
        description: 'Process has low success rate',
        evidence: `${Math.round(pattern.confidence * 100)}% success rate`
      });
    }
    
    // System limitations
    if (pattern.metadata?.systemDelays) {
      causes.push({
        type: 'system_limitations',
        description: 'System performance issues',
        evidence: 'Delays detected in execution'
      });
    }
    
    return causes;
  }

  /**
   * Suggest solutions for bottleneck
   */
  async suggestSolutions(pattern) {
    const solutions = [];
    
    // Automation solution
    if (pattern.frequency >= this.minRepetitions) {
      solutions.push({
        type: 'automation',
        description: `Automate the "${pattern.sequence?.[0] || 'workflow'}" process`,
        implementation: 'Create automated workflow',
        estimatedTimeSaving: pattern.frequency * (pattern.metadata?.averageDuration || 60000),
        complexity: 'medium',
        priority: 'high'
      });
    }
    
    // Batch processing
    if (pattern.frequency >= 20) {
      solutions.push({
        type: 'batch_processing',
        description: 'Process multiple items at once',
        implementation: 'Implement batch operations',
        estimatedTimeSaving: pattern.frequency * 30000, // 30 seconds per item
        complexity: 'low',
        priority: 'medium'
      });
    }
    
    // Process optimization
    if (pattern.confidence < 0.7) {
      solutions.push({
        type: 'process_optimization',
        description: 'Optimize workflow steps',
        implementation: 'Streamline process flow',
        estimatedTimeSaving: pattern.frequency * 60000 * 0.2, // 20% improvement
        complexity: 'medium',
        priority: 'medium'
      });
    }
    
    // Training
    if (pattern.metadata?.errorRate > 0.1) {
      solutions.push({
        type: 'training',
        description: 'Provide user training',
        implementation: 'Create training materials',
        estimatedTimeSaving: pattern.frequency * 30000 * pattern.metadata.errorRate,
        complexity: 'low',
        priority: 'low'
      });
    }
    
    return solutions;
  }

  /**
   * Assess automation potential
   */
  assessAutomationPotential(pattern) {
    let score = 0;
    
    // Frequency factor (0-40 points)
    score += Math.min(40, pattern.frequency * 2);
    
    // Time saving factor (0-30 points)
    const timeSaving = pattern.frequency * (pattern.metadata?.averageDuration || 60000);
    score += Math.min(30, timeSaving / 600000); // 10 minutes = 30 points
    
    // User impact factor (0-20 points)
    score += Math.min(20, (pattern.metadata?.userCount || 1) * 4);
    
    // Complexity factor (0-10 points)
    const complexity = pattern.sequence?.length || 1;
    score += Math.max(0, 10 - complexity); // Simpler = higher score
    
    return {
      score: score,
      percentage: score, // Out of 100
      feasibility: score > 70 ? 'high' : score > 40 ? 'medium' : 'low',
      recommendation: score > 70 ? 'Automate immediately' : 
                     score > 40 ? 'Consider automation' : 
                     'Monitor for changes'
    };
  }

  /**
   * Determine severity of bottleneck
   */
  determineSeverity(bottleneck) {
    const timeLost = bottleneck.impact.timeLost;
    const frequency = bottleneck.impact.frequency;
    const users = bottleneck.impact.affectedUsers;
    
    const severityScore = (timeLost / 3600000) + // Hours lost
                          (frequency / 10) + 
                          (users * 2);
    
    if (severityScore > 50) return 'critical';
    if (severityScore > 20) return 'high';
    if (severityScore > 10) return 'medium';
    return 'low';
  }

  /**
   * Calculate priority for addressing bottleneck
   */
  calculatePriority(bottleneck) {
    let priority = 0;
    
    // Severity weight (0-40)
    const severityWeights = { critical: 40, high: 30, medium: 20, low: 10 };
    priority += severityWeights[bottleneck.impact.severity] || 0;
    
    // Automation potential weight (0-30)
    priority += bottleneck.automationPotential.score * 0.3;
    
    // Time loss weight (0-20)
    priority += Math.min(20, bottleneck.impact.timeLost / 3600000); // Hours
    
    // User impact weight (0-10)
    priority += Math.min(10, bottleneck.impact.affectedUsers * 2);
    
    return Math.round(priority);
  }

  /**
   * Get practice user patterns
   */
  async getClinicUserPatterns(practiceId) {
    try {
      const context = {
        serviceId: this.serviceId,
        operation: 'get_patterns',
        practiceId: practiceId
      };
      
      // Query user patterns from database
      const patterns = await SecureDataAccess.query('user_patterns', { practiceId }, {}, context);
      return patterns || [];
    } catch (error) {
      console.error('Error getting practice user patterns:', error);
      return [];
    }
  }

  /**
   * Get practice users
   */
  async getClinicUsers(practiceId) {
    try {
      const context = {
        serviceId: this.serviceId,
        operation: 'get_users',
        practiceId: practiceId
      };
      
      const users = await SecureDataAccess.query('users', { practiceId }, {}, context);
      return users?.map(u => u._id) || [];
    } catch (error) {
      console.error('Error getting practice users:', error);
      return [];
    }
  }

  /**
   * Calculate automation potential for all bottlenecks
   */
  calculateAutomationPotential(bottlenecks) {
    if (bottlenecks.length === 0) return 0;
    
    const totalPotential = bottlenecks.reduce((sum, b) => 
      sum + b.automationPotential.score, 0
    );
    
    return totalPotential / bottlenecks.length;
  }

  /**
   * Update statistics
   */
  updateStatistics(analysis) {
    this.stats.totalBottlenecks += analysis.bottlenecks.length;
    this.stats.totalTimeLost += analysis.metrics.totalTimeLost;
    
    const automationCandidates = analysis.bottlenecks.filter(b => 
      b.automationPotential.feasibility === 'high'
    ).length;
    
    this.stats.automationCandidates += automationCandidates;
  }

  /**
   * Get top bottlenecks for practice
   */
  async getTopBottlenecks(practiceId, count = 5) {
    const clinicBottlenecks = this.clinicBottlenecks.get(practiceId) || [];
    
    return clinicBottlenecks
      .sort((a, b) => b.priority - a.priority)
      .slice(0, count);
  }

  /**
   * Generate bottleneck report
   */
  async generateBottleneckReport(practiceId) {
    const analysis = this.workflowAnalysis.get(practiceId);
    
    if (!analysis) {
      return null;
    }
    
    const report = {
      practiceId: practiceId,
      generatedAt: new Date(),
      summary: {
        totalBottlenecks: analysis.bottlenecks.length,
        criticalBottlenecks: analysis.bottlenecks.filter(b => b.impact.severity === 'critical').length,
        totalTimeLost: analysis.metrics.totalTimeLost,
        dailyTimeLost: analysis.metrics.totalTimeLost / 7,
        automationPotential: analysis.metrics.automationPotential
      },
      topBottlenecks: await this.getTopBottlenecks(practiceId, 10),
      recommendations: this.generateRecommendations(analysis),
      estimatedSavings: this.calculateEstimatedSavings(analysis)
    };
    
    return report;
  }

  /**
   * Generate recommendations
   */
  generateRecommendations(analysis) {
    const recommendations = [];
    
    // High-priority automations
    const highPriorityBottlenecks = analysis.bottlenecks.filter(b => b.priority > 70);
    
    if (highPriorityBottlenecks.length > 0) {
      recommendations.push({
        type: 'immediate_action',
        title: 'Automate High-Impact Workflows',
        description: `${highPriorityBottlenecks.length} workflows should be automated immediately`,
        impact: 'high',
        bottlenecks: highPriorityBottlenecks.map(b => b.id)
      });
    }
    
    // Training needs
    const errorProneBottlenecks = analysis.bottlenecks.filter(b => b.type === 'error_prone');
    
    if (errorProneBottlenecks.length > 0) {
      recommendations.push({
        type: 'training',
        title: 'Staff Training Required',
        description: `${errorProneBottlenecks.length} workflows have high error rates`,
        impact: 'medium',
        bottlenecks: errorProneBottlenecks.map(b => b.id)
      });
    }
    
    // Process optimization
    const inefficientBottlenecks = analysis.bottlenecks.filter(b => 
      b.pattern.confidence < 0.6
    );
    
    if (inefficientBottlenecks.length > 0) {
      recommendations.push({
        type: 'optimization',
        title: 'Process Optimization Needed',
        description: `${inefficientBottlenecks.length} workflows need optimization`,
        impact: 'medium',
        bottlenecks: inefficientBottlenecks.map(b => b.id)
      });
    }
    
    return recommendations;
  }

  /**
   * Calculate estimated savings
   */
  calculateEstimatedSavings(analysis) {
    const hourlyRate = 50; // $50/hour default
    
    const timeSavings = {
      daily: analysis.metrics.totalTimeLost / 7,
      weekly: analysis.metrics.totalTimeLost,
      monthly: analysis.metrics.totalTimeLost * 4.3,
      yearly: analysis.metrics.totalTimeLost * 52
    };
    
    const costSavings = {
      daily: (timeSavings.daily / 3600000) * hourlyRate,
      weekly: (timeSavings.weekly / 3600000) * hourlyRate,
      monthly: (timeSavings.monthly / 3600000) * hourlyRate,
      yearly: (timeSavings.yearly / 3600000) * hourlyRate
    };
    
    return {
      time: timeSavings,
      cost: costSavings,
      roi: {
        paybackPeriod: 'Calculated based on implementation cost',
        yearlyReturn: costSavings.yearly
      }
    };
  }

  /**
   * Start periodic bottleneck analysis
   */
  startBottleneckAnalysis() {
    this.analysisInterval = setInterval(async () => {
      await this.performPeriodicAnalysis();
    }, 3600000); // Every hour
  }

  /**
   * Perform periodic analysis
   */
  async performPeriodicAnalysis() {
    try {
      // Get all active practices (placeholder)
      const practices = ['clinic1', 'clinic2'];
      
      for (const practiceId of practices) {
        await this.analyzeWorkflowBottlenecks(practiceId);
      }
      
    } catch (error) {
      console.error('Error in periodic bottleneck analysis:', error);
    }
  }

  /**
   * Get service statistics
   */
  getStats() {
    return {
      ...this.stats,
      activeBottlenecks: this.bottlenecks.size,
      analyzedClinics: this.workflowAnalysis.size
    };
  }

  /**
   * Get service status
   */
  getStatus() {
    return {
      serviceId: this.serviceId,
      initialized: this.initialized,
      bottlenecksCount: this.bottlenecks.size,
      analyzedClinics: this.workflowAnalysis.size,
      stats: this.getStats()
    };
  }

  /**
   * Cleanup and shutdown
   */
  shutdown() {
    if (this.analysisInterval) {
      clearInterval(this.analysisInterval);
    }
    
    console.log('Bottleneck Detector Service shutdown complete');
  }
}

module.exports = new BottleneckDetectorService();