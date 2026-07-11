/**
 * 🎓 SECURITY TRAINING SERVICE
 * 
 * Provides security awareness training, compliance education, and certification tracking
 * for healthcare staff. Ensures regulatory compliance and security best practices.
 * 
 * SECURITY: Training content delivery with progress tracking.
 * COMPLIANCE: Training completion tracked for regulatory compliance requirements.
 */

const crypto = require('crypto');
const serviceAccountManager = require('../../../backend/services/serviceAccountManager');
const SecureDataAccess = require('../../../backend/services/secureDataAccess');

class SecurityTrainingService {
  constructor() {
    this.serviceToken = null;
    this.initialized = false;
    
    // Training modules
    this.trainingModules = new Map();
    
    // User progress tracking
    this.userProgress = new Map();
    
    // Training statistics
    this.stats = {
      totalModules: 0,
      activeUsers: 0,
      completedTrainings: 0,
      certificationIssued: 0
    };
  }

  async initialize() {
    if (this.initialized) return;

    try {
      this.serviceToken = await serviceAccountManager.authenticate('security-training-service');
      await this.loadTrainingModules();
      this.initialized = true;
      console.log('✅ Security Training Service initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Security Training Service:', error);
      throw error;
    }
  }

  /**
   * Load training modules
   */
  async loadTrainingModules() {
    try {
      // Define core security training modules
      const modules = [
        {
          id: 'hipaa-basics',
          title: 'HIPAA Compliance Fundamentals',
          description: 'Essential HIPAA privacy and security requirements',
          duration: 60, // minutes
          mandatory: true,
          category: 'compliance'
        },
        {
          id: 'phishing-awareness',
          title: 'Phishing and Social Engineering Defense',
          description: 'Identify and respond to phishing attacks',
          duration: 45,
          mandatory: true,
          category: 'security'
        },
        {
          id: 'password-security',
          title: 'Password Security Best Practices',
          description: 'Creating and managing secure passwords',
          duration: 30,
          mandatory: true,
          category: 'security'
        },
        {
          id: 'data-handling',
          title: 'Secure Data Handling Procedures',
          description: 'Proper handling of patient health information',
          duration: 90,
          mandatory: true,
          category: 'compliance'
        },
        {
          id: 'incident-response',
          title: 'Security Incident Response',
          description: 'How to report and respond to security incidents',
          duration: 75,
          mandatory: true,
          category: 'security'
        }
      ];

      for (const module of modules) {
        this.trainingModules.set(module.id, {
          ...module,
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }

      this.stats.totalModules = this.trainingModules.size;
      console.log(`📚 Loaded ${this.stats.totalModules} training modules`);
    } catch (error) {
      console.error('Failed to load training modules:', error);
      throw error;
    }
  }

  /**
   * Enroll user in training
   */
  async enrollUser(userId, moduleId, practiceId) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      const module = this.trainingModules.get(moduleId);
      if (!module) {
        throw new Error(`Training module not found: ${moduleId}`);
      }

      const enrollment = {
        id: crypto.randomUUID(),
        userId,
        moduleId,
        practiceId,
        enrolledAt: new Date(),
        status: 'enrolled',
        progress: 0,
        attempts: 0,
        completedAt: null,
        certificateId: null
      };

      const context = {
        serviceId: 'security-training-service',
        operation: 'enroll-user',
        practiceId
      };

      await SecureDataAccess.create('training_enrollments', enrollment, context);

      // Update user progress tracking
      if (!this.userProgress.has(userId)) {
        this.userProgress.set(userId, new Map());
      }
      this.userProgress.get(userId).set(moduleId, enrollment);

      console.log(`📝 User ${userId} enrolled in ${moduleId}`);
      return enrollment.id;
    } catch (error) {
      console.error('Failed to enroll user:', error);
      throw error;
    }
  }

  /**
   * Update training progress
   */
  async updateProgress(userId, moduleId, progress, practiceId) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      const userModules = this.userProgress.get(userId);
      if (!userModules || !userModules.has(moduleId)) {
        throw new Error(`User not enrolled in module: ${moduleId}`);
      }

      const enrollment = userModules.get(moduleId);
      enrollment.progress = Math.max(enrollment.progress, progress);
      enrollment.updatedAt = new Date();

      // Check for completion
      if (progress >= 100 && enrollment.status !== 'completed') {
        enrollment.status = 'completed';
        enrollment.completedAt = new Date();
        
        // Generate certificate
        const certificateId = await this.generateCertificate(userId, moduleId, practiceId);
        enrollment.certificateId = certificateId;

        this.stats.completedTrainings++;
        this.stats.certificationIssued++;
      }

      // Update in database
      const context = {
        serviceId: 'security-training-service',
        operation: 'update-progress',
        practiceId
      };

      await SecureDataAccess.update('training_enrollments',
        { userId, moduleId },
        enrollment,
        context
      );

      console.log(`📈 Progress updated: ${userId} - ${moduleId}: ${progress}%`);
      return enrollment;
    } catch (error) {
      console.error('Failed to update progress:', error);
      throw error;
    }
  }

  /**
   * Generate training certificate
   */
  async generateCertificate(userId, moduleId, practiceId) {
    try {
      const module = this.trainingModules.get(moduleId);
      const certificateId = crypto.randomUUID();

      const certificate = {
        id: certificateId,
        userId,
        moduleId,
        practiceId,
        moduleTitle: module.title,
        issuedAt: new Date(),
        validUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
        verificationCode: crypto.randomBytes(16).toString('hex')
      };

      const context = {
        serviceId: 'security-training-service',
        operation: 'generate-certificate',
        practiceId
      };

      await SecureDataAccess.create('training_certificates', certificate, context);

      console.log(`🎖️ Certificate generated: ${certificateId} for ${userId}`);
      return certificateId;
    } catch (error) {
      console.error('Failed to generate certificate:', error);
      throw error;
    }
  }

  /**
   * Get user training status
   */
  async getUserTrainingStatus(userId, practiceId) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      const context = {
        serviceId: 'security-training-service',
        operation: 'get-user-status',
        practiceId
      };

      const enrollments = await SecureDataAccess.query('training_enrollments',
        { userId },
        { sort: { enrolledAt: -1 } },
        context
      );

      const status = {
        userId,
        totalModules: this.trainingModules.size,
        enrolledModules: enrollments.length,
        completedModules: enrollments.filter(e => e.status === 'completed').length,
        inProgressModules: enrollments.filter(e => e.status === 'in_progress').length,
        overallProgress: 0,
        certificates: [],
        complianceStatus: 'incomplete'
      };

      if (enrollments.length > 0) {
        status.overallProgress = enrollments.reduce((sum, e) => sum + e.progress, 0) / enrollments.length;
      }

      // Check compliance status
      const mandatoryModules = Array.from(this.trainingModules.values()).filter(m => m.mandatory);
      const completedMandatory = enrollments.filter(e => 
        e.status === 'completed' && mandatoryModules.some(m => m.id === e.moduleId)
      );

      status.complianceStatus = completedMandatory.length >= mandatoryModules.length ? 'compliant' : 'incomplete';

      return status;
    } catch (error) {
      console.error('Failed to get user training status:', error);
      throw error;
    }
  }

  /**
   * Get training statistics
   */
  getTrainingStats() {
    return {
      ...this.stats,
      modulesByCategory: this.getModulesByCategory(),
      activeUsers: this.userProgress.size,
      averageCompletion: this.calculateAverageCompletion(),
      initialized: this.initialized
    };
  }

  /**
   * Get modules by category
   */
  getModulesByCategory() {
    const categories = {};
    for (const module of this.trainingModules.values()) {
      if (!categories[module.category]) {
        categories[module.category] = 0;
      }
      categories[module.category]++;
    }
    return categories;
  }

  /**
   * Calculate average completion rate
   */
  calculateAverageCompletion() {
    let totalProgress = 0;
    let totalEnrollments = 0;

    for (const userModules of this.userProgress.values()) {
      for (const enrollment of userModules.values()) {
        totalProgress += enrollment.progress;
        totalEnrollments++;
      }
    }

    return totalEnrollments > 0 ? totalProgress / totalEnrollments : 0;
  }

  /**
   * Health check
   */
  healthCheck() {
    return {
      status: 'healthy',
      modules: this.stats.totalModules,
      activeUsers: this.stats.activeUsers,
      completedTrainings: this.stats.completedTrainings,
      certificationsIssued: this.stats.certificationIssued,
      initialized: this.initialized,
      timestamp: new Date()
    };
  }
}

// Export singleton instance
module.exports = new SecurityTrainingService();