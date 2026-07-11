// Competency Assessment Service
// Migrated to DDD NX architecture - Learning & Training Context - Assessment Feature
// Manages competency frameworks and assessments for healthcare staff

const serviceAccountManager = require('../../../backend/services/serviceAccountManager');
const SecureDataAccess = require('../../../backend/services/secureDataAccess');
const encryptionService = require('../../../backend/services/encryptionService');
const productionKMS = require('../../../backend/services/productionKMS');

/**
 * Competency Assessment Service
 * Handles competency frameworks, assessments, and skill tracking
 */
class CompetencyAssessmentService {
  constructor() {
    this.serviceId = 'competency-assessment-service';
    this.serviceToken = null;
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return this;
    
    try {
      // Authenticate service with serviceAccountManager
      this.serviceToken = await serviceAccountManager.authenticate(this.serviceId);
      
      // Set initialized flag
      this.initialized = true;
      
      // Log initialization
      const context = {
        serviceId: this.serviceId,
        operation: 'initialize',
        practiceId: 'global'
      };
      
      await SecureDataAccess.create('audit_logs', {
        action: 'SERVICE_INITIALIZED',
        service: 'competencyAssessmentService',
        timestamp: new Date()
      }, context);
      
      console.log('✅ CompetencyAssessmentService initialized');
      return this;
    } catch (error) {
      console.error('❌ Failed to initialize CompetencyAssessmentService:', error);
      throw error;
    }
  }

  async createCompetencyFramework(frameworkData, practiceContext = {}) {
    if (!this.initialized) await this.initialize();

    try {
      const framework = {
        id: `framework_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: frameworkData.name,
        description: frameworkData.description,
        category: frameworkData.category, // clinical, technical, soft_skills, safety
        competencies: frameworkData.competencies || [],
        assessmentMethods: frameworkData.assessmentMethods || [],
        scoringCriteria: frameworkData.scoringCriteria || {},
        minimumPassingScore: frameworkData.minimumPassingScore || 70,
        validityPeriod: frameworkData.validityPeriod || 365, // days
        requiredFor: frameworkData.requiredFor || [], // roles that require this
        createdBy: practiceContext.userId,
        practiceId: practiceContext.practiceId || 'global',
        status: 'active',
        version: '1.0',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const context = {
        serviceId: this.serviceId,
        operation: 'create-competency-framework',
        practiceId: practiceContext.practiceId || 'global'
      };

      await SecureDataAccess.create('competency_frameworks', framework, context);

      return {
        success: true,
        frameworkId: framework.id,
        framework: framework
      };
    } catch (error) {
      console.error('Failed to create competency framework:', error);
      throw error;
    }
  }

  async conductAssessment(assessmentData, practiceContext = {}) {
    if (!this.initialized) await this.initialize();

    try {
      const assessment = {
        id: `assessment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        frameworkId: assessmentData.frameworkId,
        assesseeId: assessmentData.assesseeId,
        assessorId: practiceContext.userId,
        practiceId: practiceContext.practiceId || 'global',
        
        // Assessment details
        type: assessmentData.type || 'formal', // formal, informal, self_assessment
        method: assessmentData.method || 'observation', // observation, test, simulation, portfolio
        
        // Scores and results
        competencyScores: assessmentData.competencyScores || {},
        overallScore: this.calculateOverallScore(assessmentData.competencyScores || {}),
        passed: false, // Will be calculated
        
        // Assessment context
        assessmentDate: assessmentData.assessmentDate || new Date(),
        duration: assessmentData.duration, // minutes
        location: assessmentData.location,
        conditions: assessmentData.conditions || 'standard',
        
        // Documentation
        observations: assessmentData.observations || '',
        strengthsIdentified: assessmentData.strengthsIdentified || [],
        improvementAreas: assessmentData.improvementAreas || [],
        recommendedActions: assessmentData.recommendedActions || [],
        
        // Metadata
        status: 'completed',
        createdAt: new Date(),
        completedAt: new Date()
      };

      // Get framework to determine passing criteria
      const frameworkContext = {
        serviceId: this.serviceId,
        operation: 'get-framework',
        practiceId: practiceContext.practiceId || 'global'
      };

      const frameworks = await SecureDataAccess.query(
        'competency_frameworks',
        { id: assessmentData.frameworkId },
        { limit: 1 },
        frameworkContext
      );

      if (frameworks.length > 0) {
        const framework = frameworks[0];
        assessment.passed = assessment.overallScore >= (framework.minimumPassingScore || 70);
      }

      const context = {
        serviceId: this.serviceId,
        operation: 'conduct-assessment',
        practiceId: practiceContext.practiceId || 'global'
      };

      await SecureDataAccess.create('competency_assessments', assessment, context);

      // Update employee competency record
      await this.updateEmployeeCompetencyRecord(
        assessmentData.assesseeId,
        assessmentData.frameworkId,
        assessment,
        practiceContext
      );

      return {
        success: true,
        assessmentId: assessment.id,
        assessment: assessment
      };
    } catch (error) {
      console.error('Failed to conduct assessment:', error);
      throw error;
    }
  }

  async updateEmployeeCompetencyRecord(employeeId, frameworkId, assessment, practiceContext) {
    try {
      const context = {
        serviceId: this.serviceId,
        operation: 'update-employee-record',
        practiceId: practiceContext.practiceId || 'global'
      };

      // Get existing record
      const existingRecords = await SecureDataAccess.query(
        'employee_competencies',
        { employeeId: employeeId, frameworkId: frameworkId },
        { limit: 1 },
        context
      );

      const competencyRecord = {
        employeeId: employeeId,
        frameworkId: frameworkId,
        practiceId: practiceContext.practiceId || 'global',
        currentScore: assessment.overallScore,
        currentStatus: assessment.passed ? 'competent' : 'needs_improvement',
        lastAssessmentId: assessment.id,
        lastAssessmentDate: assessment.assessmentDate,
        nextAssessmentDue: this.calculateNextAssessmentDate(assessment.assessmentDate),
        assessmentHistory: [],
        updatedAt: new Date()
      };

      if (existingRecords.length > 0) {
        // Update existing record
        const existing = existingRecords[0];
        competencyRecord.assessmentHistory = existing.assessmentHistory || [];
        competencyRecord.assessmentHistory.push({
          assessmentId: assessment.id,
          score: assessment.overallScore,
          passed: assessment.passed,
          date: assessment.assessmentDate
        });

        await SecureDataAccess.update(
          'employee_competencies',
          { employeeId: employeeId, frameworkId: frameworkId },
          competencyRecord,
          context
        );
      } else {
        // Create new record
        competencyRecord.createdAt = new Date();
        competencyRecord.assessmentHistory = [{
          assessmentId: assessment.id,
          score: assessment.overallScore,
          passed: assessment.passed,
          date: assessment.assessmentDate
        }];

        await SecureDataAccess.create('employee_competencies', competencyRecord, context);
      }
    } catch (error) {
      console.error('Failed to update employee competency record:', error);
      throw error;
    }
  }

  async getEmployeeCompetencies(employeeId, practiceContext = {}) {
    if (!this.initialized) await this.initialize();

    try {
      const context = {
        serviceId: this.serviceId,
        operation: 'get-employee-competencies',
        practiceId: practiceContext.practiceId || 'global'
      };

      const competencies = await SecureDataAccess.query(
        'employee_competencies',
        { employeeId: employeeId, practiceId: practiceContext.practiceId || 'global' },
        {},
        context
      );

      return {
        success: true,
        employeeId: employeeId,
        competencies: competencies,
        totalCompetencies: competencies.length,
        competentCount: competencies.filter(c => c.currentStatus === 'competent').length
      };
    } catch (error) {
      console.error('Failed to get employee competencies:', error);
      throw error;
    }
  }

  async generateCompetencyReport(reportParams, practiceContext = {}) {
    if (!this.initialized) await this.initialize();

    try {
      const {
        employeeId,
        frameworkId,
        startDate,
        endDate,
        reportType = 'summary'
      } = reportParams;

      const context = {
        serviceId: this.serviceId,
        operation: 'generate-competency-report',
        practiceId: practiceContext.practiceId || 'global'
      };

      const filter = { practiceId: practiceContext.practiceId || 'global' };
      if (employeeId) filter.assesseeId = employeeId;
      if (frameworkId) filter.frameworkId = frameworkId;
      if (startDate || endDate) {
        filter.assessmentDate = {};
        if (startDate) filter.assessmentDate.$gte = new Date(startDate);
        if (endDate) filter.assessmentDate.$lte = new Date(endDate);
      }

      const assessments = await SecureDataAccess.query(
        'competency_assessments',
        filter,
        { sort: { assessmentDate: -1 } },
        context
      );

      const report = {
        reportType: reportType,
        generatedAt: new Date(),
        parameters: reportParams,
        
        summary: {
          totalAssessments: assessments.length,
          passedAssessments: assessments.filter(a => a.passed).length,
          failedAssessments: assessments.filter(a => !a.passed).length,
          averageScore: assessments.length > 0 ? 
            assessments.reduce((sum, a) => sum + a.overallScore, 0) / assessments.length : 0
        },
        
        assessmentsByFramework: this.groupAssessmentsByFramework(assessments),
        assessmentsByEmployee: this.groupAssessmentsByEmployee(assessments),
        competencyTrends: this.analyzeCompetencyTrends(assessments),
        
        recommendations: this.generateCompetencyRecommendations(assessments)
      };

      return {
        success: true,
        report: report
      };
    } catch (error) {
      console.error('Failed to generate competency report:', error);
      throw error;
    }
  }

  // Utility methods
  calculateOverallScore(competencyScores) {
    const scores = Object.values(competencyScores);
    if (scores.length === 0) return 0;
    return scores.reduce((sum, score) => sum + score, 0) / scores.length;
  }

  calculateNextAssessmentDate(lastAssessmentDate, validityPeriod = 365) {
    const nextDate = new Date(lastAssessmentDate);
    nextDate.setDate(nextDate.getDate() + validityPeriod);
    return nextDate;
  }

  groupAssessmentsByFramework(assessments) {
    return assessments.reduce((acc, assessment) => {
      const frameworkId = assessment.frameworkId;
      if (!acc[frameworkId]) {
        acc[frameworkId] = {
          total: 0,
          passed: 0,
          failed: 0,
          averageScore: 0
        };
      }
      acc[frameworkId].total++;
      if (assessment.passed) {
        acc[frameworkId].passed++;
      } else {
        acc[frameworkId].failed++;
      }
      acc[frameworkId].averageScore = (acc[frameworkId].averageScore * (acc[frameworkId].total - 1) + assessment.overallScore) / acc[frameworkId].total;
      return acc;
    }, {});
  }

  groupAssessmentsByEmployee(assessments) {
    return assessments.reduce((acc, assessment) => {
      const employeeId = assessment.assesseeId;
      if (!acc[employeeId]) {
        acc[employeeId] = {
          total: 0,
          passed: 0,
          failed: 0,
          averageScore: 0,
          lastAssessment: null
        };
      }
      acc[employeeId].total++;
      if (assessment.passed) {
        acc[employeeId].passed++;
      } else {
        acc[employeeId].failed++;
      }
      acc[employeeId].averageScore = (acc[employeeId].averageScore * (acc[employeeId].total - 1) + assessment.overallScore) / acc[employeeId].total;
      
      if (!acc[employeeId].lastAssessment || new Date(assessment.assessmentDate) > new Date(acc[employeeId].lastAssessment.assessmentDate)) {
        acc[employeeId].lastAssessment = assessment;
      }
      return acc;
    }, {});
  }

  analyzeCompetencyTrends(assessments) {
    // Simple trend analysis - would be more sophisticated in production
    const monthlyData = {};
    
    assessments.forEach(assessment => {
      const month = new Date(assessment.assessmentDate).toISOString().substr(0, 7); // YYYY-MM
      if (!monthlyData[month]) {
        monthlyData[month] = { total: 0, passed: 0, averageScore: 0 };
      }
      monthlyData[month].total++;
      if (assessment.passed) monthlyData[month].passed++;
      monthlyData[month].averageScore = (monthlyData[month].averageScore * (monthlyData[month].total - 1) + assessment.overallScore) / monthlyData[month].total;
    });
    
    return monthlyData;
  }

  generateCompetencyRecommendations(assessments) {
    const recommendations = [];
    
    const passRate = assessments.filter(a => a.passed).length / assessments.length;
    
    if (passRate < 0.7) {
      recommendations.push({
        type: 'training_needed',
        priority: 'high',
        description: 'Low overall pass rate indicates need for additional training programs'
      });
    }
    
    return recommendations;
  }

  /**
   * Get service status
   */
  getStatus() {
    return {
      serviceId: this.serviceId,
      initialized: this.initialized
    };
  }
}

// Create and export singleton
const competencyAssessmentService = new CompetencyAssessmentService();
module.exports = competencyAssessmentService;