/**
 * LearningPath Entity
 * Represents structured learning journeys
 */

class LearningPath {
  constructor({
    id,
    title,
    description,
    category,
    level, // beginner, intermediate, advanced
    estimatedDuration, // in hours
    prerequisites = [],
    programs = [], // ordered list of training programs
    assessments = [],
    certificates = [],
    tags = [],
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
    this.estimatedDuration = estimatedDuration;
    this.prerequisites = prerequisites;
    this.programs = programs;
    this.assessments = assessments;
    this.certificates = certificates;
    this.tags = tags;
    this.status = status;
    this.createdBy = createdBy;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }

  addProgram(program, order) {
    const programEntry = {
      programId: program.id,
      title: program.title,
      order: order !== undefined ? order : this.programs.length + 1,
      required: true,
      addedAt: new Date()
    };
    
    this.programs.push(programEntry);
    this.reorderPrograms();
    this.updateEstimatedDuration();
    this.updatedAt = new Date();
    
    return this;
  }

  removeProgram(programId) {
    this.programs = this.programs.filter(p => p.programId !== programId);
    this.reorderPrograms();
    this.updateEstimatedDuration();
    this.updatedAt = new Date();
    
    return this;
  }

  reorderPrograms() {
    this.programs.sort((a, b) => a.order - b.order);
    this.programs.forEach((program, index) => {
      program.order = index + 1;
    });
  }

  updateEstimatedDuration() {
    // This would typically sum up durations from linked programs
    // For now, we'll keep it simple
    this.estimatedDuration = this.programs.length * 2; // 2 hours per program estimate
  }

  calculateProgress(userProgress) {
    if (this.programs.length === 0) return 0;
    
    const completedPrograms = this.programs.filter(program => {
      const progress = userProgress.find(p => p.programId === program.programId);
      return progress && progress.completed;
    });
    
    return Math.round((completedPrograms.length / this.programs.length) * 100);
  }

  getNextProgram(userProgress) {
    const completedProgramIds = userProgress
      .filter(p => p.completed)
      .map(p => p.programId);
    
    return this.programs.find(program => 
      !completedProgramIds.includes(program.programId)
    );
  }

  canUserStart(userProfile) {
    // Check prerequisites
    if (this.prerequisites.length > 0) {
      const hasPrerequisites = this.prerequisites.every(req => 
        userProfile.completedPrograms?.includes(req) ||
        userProfile.certificates?.some(cert => cert.programId === req)
      );
      
      if (!hasPrerequisites) return false;
    }
    
    // Check level compatibility
    if (this.level === 'advanced' && userProfile.experienceLevel === 'beginner') {
      return false;
    }
    
    return true;
  }

  addAssessment(assessment, programId = null) {
    const assessmentEntry = {
      assessmentId: assessment.id,
      title: assessment.title,
      programId, // null for path-level assessments
      required: true,
      addedAt: new Date()
    };
    
    this.assessments.push(assessmentEntry);
    this.updatedAt = new Date();
    
    return this;
  }

  getCertificationRequirements() {
    return {
      requiredPrograms: this.programs.filter(p => p.required),
      requiredAssessments: this.assessments.filter(a => a.required),
      minimumScore: 80, // configurable
      totalDuration: this.estimatedDuration
    };
  }

  clone() {
    return new LearningPath({
      ...this,
      id: undefined,
      title: `${this.title} (Copy)`,
      status: 'draft',
      createdAt: new Date(),
      updatedAt: new Date()
    });
  }

  validate() {
    const errors = [];
    
    if (!this.title) errors.push('Title is required');
    if (!this.category) errors.push('Category is required');
    if (!this.level) errors.push('Level is required');
    if (this.programs.length === 0) errors.push('At least one program is required');
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

module.exports = LearningPath;