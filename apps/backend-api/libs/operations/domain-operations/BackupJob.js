/**
 * BackupJob Entity
 * Represents automated backup operations
 */

class BackupJob {
  constructor({
    id,
    name,
    description,
    type, // full, incremental, differential, snapshot
    frequency, // hourly, daily, weekly, monthly, custom
    schedule, // cron expression for custom schedules
    targets = [], // databases, files, configurations
    destination, // backup storage location
    retention, // retention policy
    compression = true,
    encryption = true,
    status = 'scheduled', // scheduled, running, completed, failed, paused
    nextRunAt,
    lastRunAt,
    lastSuccessAt,
    lastFailureAt,
    runCount = 0,
    successCount = 0,
    failureCount = 0,
    lastSize = 0, // in bytes
    lastDuration = 0, // in seconds
    metadata = {},
    notifications = [], // notification settings
    createdBy,
    createdAt = new Date(),
    updatedAt = new Date()
  }) {
    this.id = id;
    this.name = name;
    this.description = description;
    this.type = type;
    this.frequency = frequency;
    this.schedule = schedule;
    this.targets = targets;
    this.destination = destination;
    this.retention = retention;
    this.compression = compression;
    this.encryption = encryption;
    this.status = status;
    this.nextRunAt = nextRunAt;
    this.lastRunAt = lastRunAt;
    this.lastSuccessAt = lastSuccessAt;
    this.lastFailureAt = lastFailureAt;
    this.runCount = runCount;
    this.successCount = successCount;
    this.failureCount = failureCount;
    this.lastSize = lastSize;
    this.lastDuration = lastDuration;
    this.metadata = metadata;
    this.notifications = notifications;
    this.createdBy = createdBy;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }

  addTarget(target) {
    this.targets.push({
      ...target,
      addedAt: new Date()
    });
    this.updatedAt = new Date();
    return this;
  }

  removeTarget(targetId) {
    this.targets = this.targets.filter(t => t.id !== targetId);
    this.updatedAt = new Date();
    return this;
  }

  start() {
    this.status = 'running';
    this.lastRunAt = new Date();
    this.runCount++;
    this.updatedAt = new Date();
    return this;
  }

  complete(size = 0, duration = 0) {
    this.status = 'scheduled';
    this.lastSuccessAt = new Date();
    this.lastSize = size;
    this.lastDuration = duration;
    this.successCount++;
    this.calculateNextRun();
    this.updatedAt = new Date();
    return this;
  }

  fail(error = null) {
    this.status = 'scheduled';
    this.lastFailureAt = new Date();
    this.failureCount++;
    
    if (error) {
      this.metadata.lastError = error;
    }
    
    this.calculateNextRun();
    this.updatedAt = new Date();
    return this;
  }

  pause() {
    this.status = 'paused';
    this.updatedAt = new Date();
    return this;
  }

  resume() {
    this.status = 'scheduled';
    this.calculateNextRun();
    this.updatedAt = new Date();
    return this;
  }

  calculateNextRun() {
    const now = new Date();
    
    switch (this.frequency) {
      case 'hourly':
        this.nextRunAt = new Date(now.getTime() + 60 * 60 * 1000);
        break;
      case 'daily':
        this.nextRunAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        break;
      case 'weekly':
        this.nextRunAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        break;
      case 'monthly':
        const nextMonth = new Date(now);
        nextMonth.setMonth(nextMonth.getMonth() + 1);
        this.nextRunAt = nextMonth;
        break;
      case 'custom':
        // Would implement cron parser here
        this.nextRunAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // Default to daily
        break;
      default:
        this.nextRunAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    }
    
    return this;
  }

  isReady() {
    return this.status === 'scheduled' && 
           this.nextRunAt && 
           new Date() >= this.nextRunAt;
  }

  getSuccessRate() {
    if (this.runCount === 0) return 100;
    return Math.round((this.successCount / this.runCount) * 100);
  }

  getAverageSize() {
    if (this.successCount === 0) return 0;
    // This would typically calculate from historical data
    return this.lastSize;
  }

  getAverageDuration() {
    if (this.successCount === 0) return 0;
    // This would typically calculate from historical data
    return this.lastDuration;
  }

  shouldRetain(backupDate) {
    if (!this.retention) return true;
    
    const now = new Date();
    const age = now - backupDate;
    
    switch (this.retention.type) {
      case 'days':
        return age <= this.retention.value * 24 * 60 * 60 * 1000;
      case 'weeks':
        return age <= this.retention.value * 7 * 24 * 60 * 60 * 1000;
      case 'months':
        return age <= this.retention.value * 30 * 24 * 60 * 60 * 1000;
      case 'years':
        return age <= this.retention.value * 365 * 24 * 60 * 60 * 1000;
      default:
        return true;
    }
  }

  addNotification(notification) {
    this.notifications.push({
      ...notification,
      addedAt: new Date()
    });
    this.updatedAt = new Date();
    return this;
  }

  shouldNotify(event) {
    return this.notifications.some(n => 
      n.events.includes(event) && n.enabled
    );
  }

  validate() {
    const errors = [];
    
    if (!this.name) errors.push('Name is required');
    if (!this.type) errors.push('Type is required');
    if (!this.frequency) errors.push('Frequency is required');
    if (!this.destination) errors.push('Destination is required');
    if (this.targets.length === 0) errors.push('At least one target is required');
    
    if (this.frequency === 'custom' && !this.schedule) {
      errors.push('Schedule is required for custom frequency');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

module.exports = BackupJob;