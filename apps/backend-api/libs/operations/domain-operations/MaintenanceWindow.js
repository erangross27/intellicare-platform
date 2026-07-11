/**
 * MaintenanceWindow Entity
 * Represents scheduled system maintenance periods
 */

class MaintenanceWindow {
  constructor({
    id,
    name,
    description,
    type, // planned, emergency, routine, security
    priority, // low, medium, high, critical
    startTime,
    endTime,
    duration, // in minutes
    timezone = 'UTC',
    recurrence, // none, weekly, monthly
    affectedServices = [],
    affectedUsers = [], // all, specific list, role-based
    tasks = [], // maintenance tasks to perform
    preMaintenanceChecks = [],
    postMaintenanceChecks = [],
    rollbackPlan = [],
    approvals = [], // required approvals
    notifications = [], // who to notify and when
    status = 'scheduled', // scheduled, in-progress, completed, cancelled, failed
    actualStartTime,
    actualEndTime,
    actualDuration,
    impact, // none, low, medium, high
    impactDescription,
    downtime = false, // whether system will be down
    downtimeExpected = 0, // expected downtime in minutes
    downtimeActual = 0, // actual downtime in minutes
    successCriteria = [],
    completionNotes,
    issuesEncountered = [],
    performedBy,
    approvedBy,
    createdBy,
    createdAt = new Date(),
    updatedAt = new Date()
  }) {
    this.id = id;
    this.name = name;
    this.description = description;
    this.type = type;
    this.priority = priority;
    this.startTime = startTime;
    this.endTime = endTime;
    this.duration = duration;
    this.timezone = timezone;
    this.recurrence = recurrence;
    this.affectedServices = affectedServices;
    this.affectedUsers = affectedUsers;
    this.tasks = tasks;
    this.preMaintenanceChecks = preMaintenanceChecks;
    this.postMaintenanceChecks = postMaintenanceChecks;
    this.rollbackPlan = rollbackPlan;
    this.approvals = approvals;
    this.notifications = notifications;
    this.status = status;
    this.actualStartTime = actualStartTime;
    this.actualEndTime = actualEndTime;
    this.actualDuration = actualDuration;
    this.impact = impact;
    this.impactDescription = impactDescription;
    this.downtime = downtime;
    this.downtimeExpected = downtimeExpected;
    this.downtimeActual = downtimeActual;
    this.successCriteria = successCriteria;
    this.completionNotes = completionNotes;
    this.issuesEncountered = issuesEncountered;
    this.performedBy = performedBy;
    this.approvedBy = approvedBy;
    this.createdBy = createdBy;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }

  addTask(task) {
    this.tasks.push({
      ...task,
      id: task.id || `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      status: 'pending',
      addedAt: new Date()
    });
    this.updatedAt = new Date();
    return this;
  }

  updateTaskStatus(taskId, status, notes = null) {
    const task = this.tasks.find(t => t.id === taskId);
    if (task) {
      task.status = status;
      task.updatedAt = new Date();
      if (notes) task.notes = notes;
      this.updatedAt = new Date();
    }
    return this;
  }

  addApproval(approval) {
    this.approvals.push({
      ...approval,
      id: approval.id || `approval_${Date.now()}`,
      status: 'pending',
      requestedAt: new Date()
    });
    this.updatedAt = new Date();
    return this;
  }

  approveBy(approverId, comments = null) {
    const approval = this.approvals.find(a => 
      a.approverId === approverId && a.status === 'pending'
    );
    
    if (approval) {
      approval.status = 'approved';
      approval.approvedAt = new Date();
      if (comments) approval.comments = comments;
      this.updatedAt = new Date();
    }
    
    return this;
  }

  rejectBy(approverId, reason) {
    const approval = this.approvals.find(a => 
      a.approverId === approverId && a.status === 'pending'
    );
    
    if (approval) {
      approval.status = 'rejected';
      approval.rejectedAt = new Date();
      approval.reason = reason;
      this.updatedAt = new Date();
    }
    
    return this;
  }

  isApproved() {
    if (this.approvals.length === 0) return true;
    return this.approvals.every(a => a.status === 'approved');
  }

  hasRejections() {
    return this.approvals.some(a => a.status === 'rejected');
  }

  start() {
    if (!this.isApproved()) {
      throw new Error('Cannot start maintenance without all approvals');
    }
    
    this.status = 'in-progress';
    this.actualStartTime = new Date();
    this.updatedAt = new Date();
    return this;
  }

  complete(notes = null) {
    this.status = 'completed';
    this.actualEndTime = new Date();
    
    if (this.actualStartTime) {
      this.actualDuration = Math.round(
        (this.actualEndTime - this.actualStartTime) / (1000 * 60)
      );
    }
    
    if (notes) {
      this.completionNotes = notes;
    }
    
    this.updatedAt = new Date();
    return this;
  }

  fail(reason, rollback = false) {
    this.status = 'failed';
    this.actualEndTime = new Date();
    
    if (this.actualStartTime) {
      this.actualDuration = Math.round(
        (this.actualEndTime - this.actualStartTime) / (1000 * 60)
      );
    }
    
    this.issuesEncountered.push({
      type: 'failure',
      reason,
      timestamp: new Date(),
      rollback
    });
    
    this.updatedAt = new Date();
    return this;
  }

  cancel(reason) {
    this.status = 'cancelled';
    this.issuesEncountered.push({
      type: 'cancellation',
      reason,
      timestamp: new Date()
    });
    this.updatedAt = new Date();
    return this;
  }

  addIssue(issue) {
    this.issuesEncountered.push({
      ...issue,
      timestamp: new Date()
    });
    this.updatedAt = new Date();
    return this;
  }

  isOverdue() {
    if (this.status !== 'scheduled') return false;
    return new Date() > this.endTime;
  }

  isUpcoming(hoursThreshold = 24) {
    if (this.status !== 'scheduled') return false;
    
    const hoursUntilStart = (this.startTime - new Date()) / (1000 * 60 * 60);
    return hoursUntilStart > 0 && hoursUntilStart <= hoursThreshold;
  }

  getDurationVariance() {
    if (!this.actualDuration || !this.duration) return null;
    return this.actualDuration - this.duration;
  }

  getCompletionRate() {
    if (this.tasks.length === 0) return 100;
    
    const completedTasks = this.tasks.filter(t => 
      t.status === 'completed' || t.status === 'verified'
    );
    
    return Math.round((completedTasks.length / this.tasks.length) * 100);
  }

  executePreMaintenanceChecks() {
    const results = this.preMaintenanceChecks.map(check => ({
      checkId: check.id,
      name: check.name,
      status: 'pending', // Would be updated by actual check execution
      executedAt: new Date()
    }));
    
    return results;
  }

  executePostMaintenanceChecks() {
    const results = this.postMaintenanceChecks.map(check => ({
      checkId: check.id,
      name: check.name,
      status: 'pending', // Would be updated by actual check execution
      executedAt: new Date()
    }));
    
    return results;
  }

  shouldNotify(event) {
    const now = new Date();
    
    return this.notifications.some(notification => {
      if (!notification.events.includes(event)) return false;
      if (!notification.enabled) return false;
      
      // Check timing for scheduled notifications
      if (event === 'reminder' && notification.reminderMinutes) {
        const reminderTime = new Date(this.startTime.getTime() - 
          (notification.reminderMinutes * 60 * 1000));
        return now >= reminderTime;
      }
      
      return true;
    });
  }

  validate() {
    const errors = [];
    
    if (!this.name) errors.push('Name is required');
    if (!this.type) errors.push('Type is required');
    if (!this.priority) errors.push('Priority is required');
    if (!this.startTime) errors.push('Start time is required');
    if (!this.endTime) errors.push('End time is required');
    
    if (this.startTime && this.endTime && this.startTime >= this.endTime) {
      errors.push('End time must be after start time');
    }
    
    if (this.tasks.length === 0) {
      errors.push('At least one task is required');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

module.exports = MaintenanceWindow;