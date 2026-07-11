/**
 * Progress Entity
 * Tracks user progress through training programs and learning paths
 */

class Progress {
  constructor({
    id,
    userId,
    userName,
    programId,
    pathId,
    type, // program, path, assessment
    status = 'not-started', // not-started, in-progress, completed, failed
    startedAt,
    completedAt,
    lastAccessedAt,
    progress = 0, // percentage (0-100)
    moduleProgress = {}, // { moduleId: { completed: boolean, score: number, completedAt: date } }
    assessmentResults = [], // assessment attempts and scores
    timeSpent = 0, // in minutes
    bookmarks = [], // saved positions/content
    notes = [], // user notes
    metadata = {},
    createdAt = new Date(),
    updatedAt = new Date()
  }) {
    this.id = id;
    this.userId = userId;
    this.userName = userName;
    this.programId = programId;
    this.pathId = pathId;
    this.type = type;
    this.status = status;
    this.startedAt = startedAt;
    this.completedAt = completedAt;
    this.lastAccessedAt = lastAccessedAt;
    this.progress = progress;
    this.moduleProgress = moduleProgress;
    this.assessmentResults = assessmentResults;
    this.timeSpent = timeSpent;
    this.bookmarks = bookmarks;
    this.notes = notes;
    this.metadata = metadata;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }

  startProgress() {
    if (this.status === 'not-started') {
      this.status = 'in-progress';
      this.startedAt = new Date();
      this.lastAccessedAt = new Date();
      this.updatedAt = new Date();
    }
    return this;
  }

  updateModuleProgress(moduleId, data) {
    this.moduleProgress[moduleId] = {
      ...this.moduleProgress[moduleId],
      ...data,
      updatedAt: new Date()
    };
    
    this.calculateOverallProgress();
    this.lastAccessedAt = new Date();
    this.updatedAt = new Date();
    
    return this;
  }

  completeModule(moduleId, score = null) {
    this.updateModuleProgress(moduleId, {
      completed: true,
      score,
      completedAt: new Date()
    });
    
    return this;
  }

  calculateOverallProgress() {
    const moduleIds = Object.keys(this.moduleProgress);
    if (moduleIds.length === 0) return;
    
    const completedModules = moduleIds.filter(id => 
      this.moduleProgress[id].completed
    );
    
    this.progress = Math.round((completedModules.length / moduleIds.length) * 100);
    
    // Check if all modules completed
    if (this.progress === 100 && this.status === 'in-progress') {
      this.complete();
    }
  }

  complete(score = null) {
    this.status = 'completed';
    this.progress = 100;
    this.completedAt = new Date();
    this.updatedAt = new Date();
    
    if (score !== null) {
      this.metadata.finalScore = score;
    }
    
    return this;
  }

  fail(reason = null) {
    this.status = 'failed';
    this.updatedAt = new Date();
    
    if (reason) {
      this.metadata.failureReason = reason;
    }
    
    return this;
  }

  addAssessmentResult(result) {
    this.assessmentResults.push({
      ...result,
      attemptedAt: new Date()
    });
    
    this.updatedAt = new Date();
    return this;
  }

  getBestAssessmentScore(assessmentId = null) {
    const results = assessmentId 
      ? this.assessmentResults.filter(r => r.assessmentId === assessmentId)
      : this.assessmentResults;
    
    if (results.length === 0) return null;
    
    return Math.max(...results.map(r => r.score || 0));
  }

  getAverageScore() {
    const scores = this.assessmentResults
      .map(r => r.score)
      .filter(s => s !== null && s !== undefined);
    
    if (scores.length === 0) return null;
    
    return Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length);
  }

  addTimeSpent(minutes) {
    this.timeSpent += minutes;
    this.lastAccessedAt = new Date();
    this.updatedAt = new Date();
    return this;
  }

  addBookmark(bookmark) {
    this.bookmarks.push({
      ...bookmark,
      createdAt: new Date()
    });
    
    this.updatedAt = new Date();
    return this;
  }

  removeBookmark(bookmarkId) {
    this.bookmarks = this.bookmarks.filter(b => b.id !== bookmarkId);
    this.updatedAt = new Date();
    return this;
  }

  addNote(note) {
    this.notes.push({
      ...note,
      id: note.id || this.generateNoteId(),
      createdAt: new Date()
    });
    
    this.updatedAt = new Date();
    return this;
  }

  updateNote(noteId, content) {
    const note = this.notes.find(n => n.id === noteId);
    if (note) {
      note.content = content;
      note.updatedAt = new Date();
      this.updatedAt = new Date();
    }
    return this;
  }

  generateNoteId() {
    return `note_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  getCompletionRate() {
    return this.progress;
  }

  getTimeSpentHours() {
    return Math.round(this.timeSpent / 60 * 100) / 100; // 2 decimal places
  }

  getDaysInProgress() {
    if (!this.startedAt) return 0;
    
    const msPerDay = 24 * 60 * 60 * 1000;
    return Math.ceil((new Date() - this.startedAt) / msPerDay);
  }

  isStale(daysThreshold = 30) {
    if (!this.lastAccessedAt) return true;
    
    const msPerDay = 24 * 60 * 60 * 1000;
    const daysSinceAccess = (new Date() - this.lastAccessedAt) / msPerDay;
    
    return daysSinceAccess > daysThreshold;
  }

  validate() {
    const errors = [];
    
    if (!this.userId) errors.push('User ID is required');
    if (!this.type) errors.push('Type is required');
    if (this.progress < 0 || this.progress > 100) {
      errors.push('Progress must be between 0 and 100');
    }
    if (this.timeSpent < 0) {
      errors.push('Time spent cannot be negative');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

module.exports = Progress;