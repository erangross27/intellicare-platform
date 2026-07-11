/**
 * TrainingProgram Entity
 * Represents a training program in the learning system
 */

class TrainingProgram {
  constructor({
    id,
    title,
    description,
    category,
    level, // beginner, intermediate, advanced
    duration, // in hours
    prerequisites = [],
    learningObjectives = [],
    modules = [],
    assessments = [],
    certificates = [],
    status = 'draft', // draft, published, archived
    createdBy,
    createdAt = new Date(),
    updatedAt = new Date()
  }) {
    this.id = id;
    this.title = title;
    this.description = description;
    this.category = category;
    this.level = level;
    this.duration = duration;
    this.prerequisites = prerequisites;
    this.learningObjectives = learningObjectives;
    this.modules = modules;
    this.assessments = assessments;
    this.certificates = certificates;
    this.status = status;
    this.createdBy = createdBy;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }

  addModule(module) {
    this.modules.push(module);
    this.updatedAt = new Date();
  }

  addAssessment(assessment) {
    this.assessments.push(assessment);
    this.updatedAt = new Date();
  }

  publish() {
    if (this.modules.length === 0) {
      throw new Error('Cannot publish program without modules');
    }
    this.status = 'published';
    this.updatedAt = new Date();
  }

  archive() {
    this.status = 'archived';
    this.updatedAt = new Date();
  }

  isEligibleForUser(userPrerequisites) {
    return this.prerequisites.every(req => 
      userPrerequisites.includes(req)
    );
  }

  getTotalDuration() {
    return this.modules.reduce((total, module) => 
      total + (module.duration || 0), 0
    );
  }

  validate() {
    const errors = [];
    
    if (!this.title) errors.push('Title is required');
    if (!this.category) errors.push('Category is required');
    if (!this.level) errors.push('Level is required');
    if (this.duration <= 0) errors.push('Duration must be positive');
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

module.exports = TrainingProgram;