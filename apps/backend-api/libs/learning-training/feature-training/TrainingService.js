/**
 * Training Service
 * Core service for managing training programs
 */

const serviceAccountManager = require('../../../services/serviceAccountManager');
const learningDataAccess = require('../data-access-learning');
const TrainingProgram = require('../domain-education/TrainingProgram');

class TrainingService {
  constructor() {
    this.serviceToken = null;
  }

  async initialize() {
    this.serviceToken = await serviceAccountManager.authenticate('training-service');
  }

  async createProgram(programData, context) {
    try {
      // Validate program data
      const program = new TrainingProgram(programData);
      const validation = program.validate();
      
      if (!validation.isValid) {
        throw new Error(`Invalid program data: ${validation.errors.join(', ')}`);
      }

      // Create program in database
      const result = await learningDataAccess.createProgram({
        ...program,
        createdAt: new Date(),
        updatedAt: new Date()
      }, context);

      return {
        success: true,
        programId: result.insertedId,
        message: 'Training program created successfully'
      };

    } catch (error) {
      console.error('Error creating training program:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async getProgram(programId, context) {
    try {
      const programs = await learningDataAccess.findProgramById(programId, context);
      
      if (!programs || programs.length === 0) {
        return {
          success: false,
          error: 'Program not found'
        };
      }

      return {
        success: true,
        program: programs[0]
      };

    } catch (error) {
      console.error('Error getting training program:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async updateProgram(programId, updateData, context) {
    try {
      // Update timestamp
      updateData.updatedAt = new Date();

      const result = await learningDataAccess.updateProgram(programId, updateData, context);

      if (result.matchedCount === 0) {
        return {
          success: false,
          error: 'Program not found'
        };
      }

      return {
        success: true,
        message: 'Training program updated successfully'
      };

    } catch (error) {
      console.error('Error updating training program:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async publishProgram(programId, context) {
    try {
      // Get program to validate
      const programResult = await this.getProgram(programId, context);
      
      if (!programResult.success) {
        return programResult;
      }

      const program = new TrainingProgram(programResult.program);
      
      // Validate program can be published
      if (program.modules.length === 0) {
        return {
          success: false,
          error: 'Cannot publish program without modules'
        };
      }

      // Update status to published
      const result = await learningDataAccess.updateProgram(programId, {
        status: 'published',
        publishedAt: new Date(),
        updatedAt: new Date()
      }, context);

      return {
        success: true,
        message: 'Training program published successfully'
      };

    } catch (error) {
      console.error('Error publishing training program:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async archiveProgram(programId, context) {
    try {
      const result = await learningDataAccess.updateProgram(programId, {
        status: 'archived',
        archivedAt: new Date(),
        updatedAt: new Date()
      }, context);

      if (result.matchedCount === 0) {
        return {
          success: false,
          error: 'Program not found'
        };
      }

      return {
        success: true,
        message: 'Training program archived successfully'
      };

    } catch (error) {
      console.error('Error archiving training program:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async getProgramsByCategory(category, context) {
    try {
      const programs = await learningDataAccess.findProgramsByCategory(category, context);

      return {
        success: true,
        programs: programs || [],
        count: programs ? programs.length : 0
      };

    } catch (error) {
      console.error('Error getting programs by category:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async addModuleToProgram(programId, moduleData, context) {
    try {
      // Get current program
      const programResult = await this.getProgram(programId, context);
      
      if (!programResult.success) {
        return programResult;
      }

      const program = new TrainingProgram(programResult.program);
      
      // Add module
      program.addModule({
        ...moduleData,
        id: moduleData.id || `module_${Date.now()}`,
        createdAt: new Date()
      });

      // Update program
      const result = await learningDataAccess.updateProgram(programId, {
        modules: program.modules,
        updatedAt: new Date()
      }, context);

      return {
        success: true,
        message: 'Module added to program successfully'
      };

    } catch (error) {
      console.error('Error adding module to program:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async removeModuleFromProgram(programId, moduleId, context) {
    try {
      // Get current program
      const programResult = await this.getProgram(programId, context);
      
      if (!programResult.success) {
        return programResult;
      }

      const program = new TrainingProgram(programResult.program);
      
      // Remove module
      program.modules = program.modules.filter(m => m.id !== moduleId);

      // Update program
      const result = await learningDataAccess.updateProgram(programId, {
        modules: program.modules,
        updatedAt: new Date()
      }, context);

      return {
        success: true,
        message: 'Module removed from program successfully'
      };

    } catch (error) {
      console.error('Error removing module from program:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async getDraftPrograms(context) {
    try {
      const programs = await learningDataAccess.query('training_programs', 
        { status: 'draft' }, 
        { sort: { updatedAt: -1 } }, 
        {
          serviceId: 'training-service',
          operation: 'get-draft-programs',
          practiceId: context.practiceId
        }
      );

      return {
        success: true,
        programs: programs || [],
        count: programs ? programs.length : 0
      };

    } catch (error) {
      console.error('Error getting draft programs:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async duplicateProgram(programId, context) {
    try {
      // Get original program
      const programResult = await this.getProgram(programId, context);
      
      if (!programResult.success) {
        return programResult;
      }

      const originalProgram = new TrainingProgram(programResult.program);
      
      // Create duplicate
      const duplicateProgram = new TrainingProgram({
        ...originalProgram,
        id: undefined,
        title: `${originalProgram.title} (Copy)`,
        status: 'draft',
        createdAt: new Date(),
        updatedAt: new Date()
      });

      // Save duplicate
      const result = await learningDataAccess.createProgram(duplicateProgram, context);

      return {
        success: true,
        programId: result.insertedId,
        message: 'Program duplicated successfully'
      };

    } catch (error) {
      console.error('Error duplicating program:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = TrainingService;