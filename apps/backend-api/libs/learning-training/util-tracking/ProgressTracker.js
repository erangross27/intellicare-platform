/**
 * Progress Tracker Utility
 * Tracks user progress through learning content
 */

const learningDataAccess = require('../data-access-learning');
const Progress = require('../domain-education/Progress');

class ProgressTracker {
  constructor() {
    this.serviceId = 'progress-tracker';
  }

  async startProgress(userId, userName, programId, type = 'program', context) {
    try {
      const progress = new Progress({
        userId,
        userName,
        programId,
        type,
        status: 'in-progress',
        startedAt: new Date(),
        lastAccessedAt: new Date()
      });

      const result = await learningDataAccess.createProgress(progress, context);

      return {
        success: true,
        progressId: result.insertedId,
        message: 'Progress tracking started'
      };

    } catch (error) {
      console.error('Error starting progress:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async updateProgress(progressId, updateData, context) {
    try {
      const result = await learningDataAccess.updateProgress(progressId, {
        ...updateData,
        lastAccessedAt: new Date(),
        updatedAt: new Date()
      }, context);

      return {
        success: true,
        message: 'Progress updated successfully'
      };

    } catch (error) {
      console.error('Error updating progress:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async recordTimeSpent(progressId, minutes, context) {
    try {
      const progressResult = await learningDataAccess.findProgressById(progressId, context);
      
      if (!progressResult || progressResult.length === 0) {
        return {
          success: false,
          error: 'Progress record not found'
        };
      }

      const currentProgress = progressResult[0];
      const newTimeSpent = (currentProgress.timeSpent || 0) + minutes;

      const result = await learningDataAccess.updateProgress(progressId, {
        timeSpent: newTimeSpent,
        lastAccessedAt: new Date(),
        updatedAt: new Date()
      }, context);

      return {
        success: true,
        totalTimeSpent: newTimeSpent,
        message: `${minutes} minutes recorded`
      };

    } catch (error) {
      console.error('Error recording time spent:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async completeModule(progressId, moduleId, score = null, context) {
    try {
      const progressResult = await learningDataAccess.findProgressById(progressId, context);
      
      if (!progressResult || progressResult.length === 0) {
        return {
          success: false,
          error: 'Progress record not found'
        };
      }

      const currentProgress = new Progress(progressResult[0]);
      
      // Complete the module
      currentProgress.completeModule(moduleId, score);

      // Update in database
      const result = await learningDataAccess.updateProgress(progressId, {
        moduleProgress: currentProgress.moduleProgress,
        progress: currentProgress.progress,
        status: currentProgress.status,
        completedAt: currentProgress.completedAt,
        lastAccessedAt: new Date(),
        updatedAt: new Date()
      }, context);

      return {
        success: true,
        moduleCompleted: true,
        overallProgress: currentProgress.progress,
        programCompleted: currentProgress.status === 'completed',
        message: 'Module completed successfully'
      };

    } catch (error) {
      console.error('Error completing module:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async addAssessmentResult(progressId, assessmentResult, context) {
    try {
      const progressResult = await learningDataAccess.findProgressById(progressId, context);
      
      if (!progressResult || progressResult.length === 0) {
        return {
          success: false,
          error: 'Progress record not found'
        };
      }

      const currentProgress = new Progress(progressResult[0]);
      
      // Add assessment result
      currentProgress.addAssessmentResult(assessmentResult);

      // Update in database
      const result = await learningDataAccess.updateProgress(progressId, {
        assessmentResults: currentProgress.assessmentResults,
        lastAccessedAt: new Date(),
        updatedAt: new Date()
      }, context);

      return {
        success: true,
        bestScore: currentProgress.getBestAssessmentScore(assessmentResult.assessmentId),
        averageScore: currentProgress.getAverageScore(),
        message: 'Assessment result recorded'
      };

    } catch (error) {
      console.error('Error adding assessment result:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async getUserProgress(userId, context) {
    try {
      const progressRecords = await learningDataAccess.findProgressByUser(userId, context);

      const summary = {
        totalPrograms: progressRecords.length,
        completed: progressRecords.filter(p => p.status === 'completed').length,
        inProgress: progressRecords.filter(p => p.status === 'in-progress').length,
        failed: progressRecords.filter(p => p.status === 'failed').length,
        totalTimeSpent: progressRecords.reduce((sum, p) => sum + (p.timeSpent || 0), 0),
        averageScore: this.calculateAverageScore(progressRecords)
      };

      return {
        success: true,
        progressRecords,
        summary
      };

    } catch (error) {
      console.error('Error getting user progress:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  calculateAverageScore(progressRecords) {
    const scores = progressRecords
      .flatMap(p => p.assessmentResults || [])
      .map(r => r.score)
      .filter(s => s !== null && s !== undefined);
    
    if (scores.length === 0) return null;
    
    return Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length);
  }

  async getStaleProgress(daysThreshold = 30, context) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysThreshold);

      const staleProgress = await learningDataAccess.query('user_progress', 
        {
          status: 'in-progress',
          lastAccessedAt: { $lt: cutoffDate }
        },
        {},
        {
          serviceId: this.serviceId,
          operation: 'get-stale-progress',
          practiceId: context.practiceId
        }
      );

      return {
        success: true,
        staleProgress: staleProgress || [],
        count: staleProgress ? staleProgress.length : 0
      };

    } catch (error) {
      console.error('Error getting stale progress:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = ProgressTracker;