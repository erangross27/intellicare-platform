/**
 * Learning Data Access Layer
 * Handles all database operations for learning and training
 */

const SecureDataAccess = require('../../../services/secureDataAccess');

class LearningDataAccess {
  constructor() {
    this.serviceId = 'learning-data-access';
  }

  // Training Programs
  async createProgram(programData, context) {
    return await SecureDataAccess.insert('training_programs', programData, {
      serviceId: this.serviceId,
      operation: 'create-program',
      practiceId: context.practiceId
    });
  }

  async findProgramById(programId, context) {
    return await SecureDataAccess.query('training_programs', 
      { id: programId }, 
      { limit: 1 }, 
      {
        serviceId: this.serviceId,
        operation: 'find-program',
        practiceId: context.practiceId
      }
    );
  }

  async findProgramsByCategory(category, context) {
    return await SecureDataAccess.query('training_programs', 
      { category, status: 'published' }, 
      {}, 
      {
        serviceId: this.serviceId,
        operation: 'find-programs-by-category',
        practiceId: context.practiceId
      }
    );
  }

  async updateProgram(programId, updateData, context) {
    return await SecureDataAccess.update('training_programs',
      { id: programId },
      updateData,
      {
        serviceId: this.serviceId,
        operation: 'update-program',
        practiceId: context.practiceId
      }
    );
  }

  // Assessments
  async createAssessment(assessmentData, context) {
    return await SecureDataAccess.insert('assessments', assessmentData, {
      serviceId: this.serviceId,
      operation: 'create-assessment',
      practiceId: context.practiceId
    });
  }

  async findAssessmentById(assessmentId, context) {
    return await SecureDataAccess.query('assessments', 
      { id: assessmentId }, 
      { limit: 1 }, 
      {
        serviceId: this.serviceId,
        operation: 'find-assessment',
        practiceId: context.practiceId
      }
    );
  }

  async findAssessmentsByProgram(programId, context) {
    return await SecureDataAccess.query('assessments', 
      { programId }, 
      {}, 
      {
        serviceId: this.serviceId,
        operation: 'find-assessments-by-program',
        practiceId: context.practiceId
      }
    );
  }

  // Certificates
  async createCertificate(certificateData, context) {
    return await SecureDataAccess.insert('certificates', certificateData, {
      serviceId: this.serviceId,
      operation: 'create-certificate',
      practiceId: context.practiceId
    });
  }

  async findCertificateByNumber(certificateNumber, context) {
    return await SecureDataAccess.query('certificates', 
      { certificateNumber }, 
      { limit: 1 }, 
      {
        serviceId: this.serviceId,
        operation: 'find-certificate-by-number',
        practiceId: context.practiceId
      }
    );
  }

  async findCertificatesByUser(userId, context) {
    return await SecureDataAccess.query('certificates', 
      { userId, status: 'active' }, 
      { sort: { completionDate: -1 } }, 
      {
        serviceId: this.serviceId,
        operation: 'find-certificates-by-user',
        practiceId: context.practiceId
      }
    );
  }

  async verifyCertificate(verificationCode, context) {
    return await SecureDataAccess.query('certificates', 
      { verificationCode, status: 'active' }, 
      { limit: 1 }, 
      {
        serviceId: this.serviceId,
        operation: 'verify-certificate',
        practiceId: context.practiceId
      }
    );
  }

  // Learning Paths
  async createLearningPath(pathData, context) {
    return await SecureDataAccess.insert('learning_paths', pathData, {
      serviceId: this.serviceId,
      operation: 'create-learning-path',
      practiceId: context.practiceId
    });
  }

  async findLearningPathById(pathId, context) {
    return await SecureDataAccess.query('learning_paths', 
      { id: pathId }, 
      { limit: 1 }, 
      {
        serviceId: this.serviceId,
        operation: 'find-learning-path',
        practiceId: context.practiceId
      }
    );
  }

  async findLearningPathsByUser(userId, context) {
    return await SecureDataAccess.query('learning_paths', 
      { 
        $or: [
          { 'enrollments.userId': userId },
          { isPublic: true }
        ]
      }, 
      {}, 
      {
        serviceId: this.serviceId,
        operation: 'find-learning-paths-by-user',
        practiceId: context.practiceId
      }
    );
  }

  // Progress Tracking
  async createProgress(progressData, context) {
    return await SecureDataAccess.insert('user_progress', progressData, {
      serviceId: this.serviceId,
      operation: 'create-progress',
      practiceId: context.practiceId
    });
  }

  async findProgressById(progressId, context) {
    return await SecureDataAccess.query('user_progress', 
      { id: progressId }, 
      { limit: 1 }, 
      {
        serviceId: this.serviceId,
        operation: 'find-progress',
        practiceId: context.practiceId
      }
    );
  }

  async findProgressByUserAndProgram(userId, programId, context) {
    return await SecureDataAccess.query('user_progress', 
      { userId, programId }, 
      { limit: 1 }, 
      {
        serviceId: this.serviceId,
        operation: 'find-progress-by-user-program',
        practiceId: context.practiceId
      }
    );
  }

  async updateProgress(progressId, updateData, context) {
    return await SecureDataAccess.update('user_progress',
      { id: progressId },
      updateData,
      {
        serviceId: this.serviceId,
        operation: 'update-progress',
        practiceId: context.practiceId
      }
    );
  }

  async findProgressByUser(userId, context) {
    return await SecureDataAccess.query('user_progress', 
      { userId }, 
      { sort: { updatedAt: -1 } }, 
      {
        serviceId: this.serviceId,
        operation: 'find-progress-by-user',
        practiceId: context.practiceId
      }
    );
  }

  // Analytics and Reporting
  async getCompletionStats(programId, context) {
    return await SecureDataAccess.query('user_progress', 
      { programId }, 
      {}, 
      {
        serviceId: this.serviceId,
        operation: 'get-completion-stats',
        practiceId: context.practiceId
      }
    );
  }

  async getUserLearningAnalytics(userId, context) {
    return await SecureDataAccess.query('user_progress', 
      { userId }, 
      {}, 
      {
        serviceId: this.serviceId,
        operation: 'get-user-analytics',
        practiceId: context.practiceId
      }
    );
  }

  async getProgramAnalytics(programId, context) {
    return await SecureDataAccess.query('user_progress', 
      { programId }, 
      {}, 
      {
        serviceId: this.serviceId,
        operation: 'get-program-analytics',
        practiceId: context.practiceId
      }
    );
  }

  // Knowledge Base
  async createKnowledgeItem(itemData, context) {
    return await SecureDataAccess.insert('knowledge_base', itemData, {
      serviceId: this.serviceId,
      operation: 'create-knowledge-item',
      practiceId: context.practiceId
    });
  }

  async searchKnowledge(query, context) {
    return await SecureDataAccess.query('knowledge_base', 
      { 
        $or: [
          { title: { $regex: query, $options: 'i' } },
          { content: { $regex: query, $options: 'i' } },
          { tags: { $in: [query] } }
        ],
        status: 'published'
      }, 
      {}, 
      {
        serviceId: this.serviceId,
        operation: 'search-knowledge',
        practiceId: context.practiceId
      }
    );
  }

  async findKnowledgeByCategory(category, context) {
    return await SecureDataAccess.query('knowledge_base', 
      { category, status: 'published' }, 
      { sort: { updatedAt: -1 } }, 
      {
        serviceId: this.serviceId,
        operation: 'find-knowledge-by-category',
        practiceId: context.practiceId
      }
    );
  }
}

module.exports = new LearningDataAccess();